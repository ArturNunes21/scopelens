-- Initial schema — ScopeLens
-- Implements ARCHITECTURE.md section 2, resolving GAPS.md G1-G6, G9 (Etapa C).

-- 2.6 Required extensions
create extension if not exists pg_trgm;
create extension if not exists vector;

-- 2.1 Multi-tenancy and auth

create table workspaces (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  stripe_customer_id      text null,
  stripe_subscription_id  text null,
  plan                    text not null default 'free' check (plan in ('free', 'pro')),
  created_at              timestamptz not null default now()
);

create table workspace_members (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('owner', 'admin', 'member')),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on workspace_members(user_id);

-- Helper function used by every RLS policy (resolves G3 — avoids recursive policies
-- on workspaces/workspace_members themselves).
create function is_workspace_member(target_workspace_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  );
$$;

-- Auto-provisioning: on first signup, create a workspace + owner membership
-- (resolves ARCHITECTURE.md 2.1 onboarding trigger; scope decision G8 — single-owner, no invite flow).
create function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into workspaces (name)
  values (coalesce(new.raw_user_meta_data->>'name', new.email, 'My Workspace'))
  returning id into new_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2.2 Meetings

create table meetings (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  title              text not null,
  meeting_type       text not null check (meeting_type in ('daily', 'planning', 'retro', 'kickoff')),
  source             text not null check (source in ('paste', 'upload')),
  transcript_raw     text not null check (char_length(transcript_raw) <= 50000),
  occurred_at        timestamptz not null,
  status             text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message      text null,
  executive_summary  text null,
  created_by         uuid not null references auth.users(id),
  created_at         timestamptz not null default now()
);

create index meetings_workspace_occurred_idx on meetings(workspace_id, occurred_at desc);

-- 2.3 Findings

create table findings (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  meeting_id            uuid not null references meetings(id) on delete cascade,
  finding_type          text not null check (finding_type in ('blocker', 'risk', 'dependency', 'decision')),
  description           text not null,
  owner                 text null,
  decision_status       text null check (decision_status in ('taken', 'pending')),
  status                text not null default 'open' check (status in ('open', 'resolved')),
  recurrence_group_id   uuid not null,
  embedding             vector(1536) null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  resolved_at           timestamptz null,
  constraint findings_recurrence_group_id_fkey
    foreign key (recurrence_group_id) references findings(id)
);

create index findings_workspace_type_status_idx on findings(workspace_id, finding_type, status);
create index findings_description_trgm_idx on findings using gin (description gin_trgm_ops);
create index findings_recurrence_group_id_idx on findings(recurrence_group_id);

-- 2.4 Diagnosis and suggestions

create table diagnostic_notes (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  meeting_id            uuid not null references meetings(id) on delete cascade,
  lens                  text not null check (lens in ('contradiction', 'continuity', 'decision_gap')),
  content               text not null,
  related_finding_ids   uuid[] null,
  created_at            timestamptz not null default now()
);

create table suggested_actions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  meeting_id    uuid not null references meetings(id) on delete cascade,
  description   text not null,
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status        text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at    timestamptz not null default now()
);

create index diagnostic_notes_meeting_id_idx on diagnostic_notes(meeting_id);
create index suggested_actions_meeting_id_idx on suggested_actions(meeting_id);

-- 2.5 AI cost logging

create table ai_calls (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  meeting_id    uuid not null references meetings(id) on delete cascade,
  stage         text not null check (stage in ('extraction', 'diagnostic', 'synthesis')),
  model         text not null,
  tokens_in     int not null,
  tokens_out    int not null,
  cost_usd      numeric null,
  latency_ms    int not null,
  created_at    timestamptz not null default now()
);

create index ai_calls_workspace_created_idx on ai_calls(workspace_id, created_at);

-- updated_at maintenance on findings

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger findings_set_updated_at
  before update on findings
  for each row execute function set_updated_at();

-- Row Level Security — every domain table, workspace-scoped (resolves G3)

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table meetings enable row level security;
alter table findings enable row level security;
alter table diagnostic_notes enable row level security;
alter table suggested_actions enable row level security;
alter table ai_calls enable row level security;

create policy workspace_isolation on workspaces
  for all using (is_workspace_member(id));

create policy workspace_isolation on workspace_members
  for all using (is_workspace_member(workspace_id));

create policy workspace_isolation on meetings
  for all using (is_workspace_member(workspace_id));

create policy workspace_isolation on findings
  for all using (is_workspace_member(workspace_id));

create policy workspace_isolation on diagnostic_notes
  for all using (is_workspace_member(workspace_id));

create policy workspace_isolation on suggested_actions
  for all using (is_workspace_member(workspace_id));

create policy workspace_isolation on ai_calls
  for all using (is_workspace_member(workspace_id));
