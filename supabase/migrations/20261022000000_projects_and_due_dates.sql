-- Phase 9 — projects inside a workspace, plus a manual due date on findings.
--
-- A workspace can now hold several projects; every meeting belongs to
-- exactly one. Findings/diagnostic_notes/suggested_actions are NOT
-- denormalized with a project_id — they reach their project through
-- meetings.meeting_id, so moving a meeting between projects (or deleting a
-- project) never leaves a stale copy behind.

create table projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  -- Public read-only status report link (/share/[token]). Null = sharing off.
  -- Regenerating the token revokes every previously shared link.
  share_token  uuid null unique,
  created_at   timestamptz not null default now(),
  -- Target of the composite FK below: guarantees a meeting can only point
  -- at a project from its OWN workspace, at the schema level — RLS alone
  -- would let a member reference a project id they can't even read.
  unique (id, workspace_id)
);

create index projects_workspace_created_idx on projects(workspace_id, created_at);

alter table projects enable row level security;

create policy workspace_isolation on projects
  for all using (is_workspace_member(workspace_id));

-- Every workspace always starts with one project, so existing callers that
-- insert a meeting without a project_id (and the test suites, which create
-- workspaces directly) keep working.
create function create_default_project()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into projects (workspace_id, name) values (new.id, 'General');
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on workspaces
  for each row execute function create_default_project();

-- Backfill: one 'General' project per existing workspace, then attach every
-- existing meeting to it (each workspace has exactly one project here).
insert into projects (workspace_id, name)
select w.id, 'General'
from workspaces w
where not exists (select 1 from projects p where p.workspace_id = w.id);

alter table meetings add column project_id uuid null;

update meetings m
set project_id = p.id
from projects p
where p.workspace_id = m.workspace_id;

-- Fills project_id with the workspace's oldest project when a caller omits
-- it. security invoker on purpose: under a user-scoped client the lookup
-- runs through projects' RLS, so it can never resolve another tenant's id.
create function set_meeting_default_project()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.project_id is null then
    select id into new.project_id
    from projects
    where workspace_id = new.workspace_id
    order by created_at, id
    limit 1;

    if new.project_id is null then
      insert into projects (workspace_id, name)
      values (new.workspace_id, 'General')
      returning id into new.project_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger meetings_set_default_project
  before insert on meetings
  for each row execute function set_meeting_default_project();

alter table meetings alter column project_id set not null;

-- Default NO ACTION (not RESTRICT): deleting a workspace cascades to both
-- meetings and projects in one statement, and NO ACTION defers the check to
-- the end of it. A project with meetings still can't be deleted on its own.
alter table meetings
  add constraint meetings_project_fkey
  foreign key (project_id, workspace_id) references projects(id, workspace_id);

create index meetings_project_occurred_idx on meetings(project_id, occurred_at desc);

-- Manual due date (set from the meeting page). Deliberately not extracted by
-- the AI pipeline yet — that would add output tokens to every Stage 1 call.
alter table findings add column due_date date null;

-- Recurrence and resolution matching are now scoped to one project: the same
-- wording in two unrelated projects is two different issues. p_project_id
-- defaults to null (no project filter) so older callers keep their exact
-- previous behavior. create or replace can't add a parameter, so the old
-- signatures are dropped first.

drop function if exists match_recurrence_finding(uuid, text, text, float);

create function match_recurrence_finding(
  p_workspace_id uuid,
  p_finding_type text,
  p_description text,
  p_threshold float,
  p_project_id uuid default null
)
returns table (recurrence_group_id uuid, similarity float)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  perform set_config('pg_trgm.similarity_threshold', p_threshold::text, true);

  return query
    select f.recurrence_group_id, similarity(f.description, p_description)::double precision as similarity
    from findings f
    join meetings m on m.id = f.meeting_id
    where f.workspace_id = p_workspace_id
      and f.finding_type = p_finding_type
      and f.status = 'open'
      and (p_project_id is null or m.project_id = p_project_id)
      and f.description % p_description
    order by similarity desc, f.created_at asc
    limit 1;
end;
$$;

grant execute on function match_recurrence_finding(uuid, text, text, float, uuid) to service_role;

drop function if exists match_finding_to_resolve(uuid, text, text, float, uuid);

create function match_finding_to_resolve(
  p_workspace_id uuid,
  p_finding_type text,
  p_description text,
  p_threshold float,
  p_exclude_meeting_id uuid,
  p_project_id uuid default null
)
returns table (recurrence_group_id uuid, similarity float)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  perform set_config('pg_trgm.similarity_threshold', p_threshold::text, true);

  return query
    select f.recurrence_group_id, similarity(f.description, p_description)::double precision as similarity
    from findings f
    join meetings m on m.id = f.meeting_id
    where f.workspace_id = p_workspace_id
      and f.finding_type = p_finding_type
      and f.status = 'open'
      and f.meeting_id != p_exclude_meeting_id
      and (p_project_id is null or m.project_id = p_project_id)
      and f.description % p_description
    order by similarity desc, f.created_at asc
    limit 1;
end;
$$;

grant execute on function match_finding_to_resolve(uuid, text, text, float, uuid, uuid) to service_role;
