-- Phase 7 (billing) — webhook idempotency table.
-- ARCHITECTURE.md section 3 "Billing" / GAPS.md G20: the Stripe webhook
-- handler must dedupe by event.id before applying it, on top of verifying
-- the signature. No RLS/workspace_id here — this table is never read by a
-- user-scoped client, only written by the webhook route via the service-role
-- client, and its only key is Stripe's own global event id.
create table stripe_webhook_events (
  id          text primary key,
  created_at  timestamptz not null default now()
);

-- RLS enabled with no policy (default deny): the prior migration grants
-- `anon`/`authenticated` table-level access by default (needed for every
-- other domain table's PostgREST access), which would otherwise expose this
-- table to any client with the anon key. Only the service-role client (which
-- bypasses RLS) ever touches this table.
alter table stripe_webhook_events enable row level security;
