-- Phase 4 — recurrence matching function, called via supabase.rpc() from
-- src/lib/ai/recurrence.ts. A dedicated function because pg_trgm's
-- similarity()/ORDER BY similarity() can't be expressed through PostgREST's
-- query builder.
--
-- security invoker (not definer, unlike is_workspace_member): this is only
-- ever called from the service-role client, which already bypasses RLS —
-- no reason to grant elevated rights it doesn't need.
--
-- status = 'open' filter is intentional (ARCHITECTURE.md 2.3 "Reopened
-- findings"): a resolved finding resurfacing starts a NEW recurrence_group_id
-- chain, not a continuation of the old one.
--
-- Same-meeting findings are never visible here in practice: the caller
-- resolves all of a new meeting's matches BEFORE inserting any of that
-- meeting's own findings (see pipeline.ts comment at the call site — if a
-- future refactor starts inserting findings one at a time instead of
-- batching, this implicit protection breaks).

create or replace function match_recurrence_finding(
  p_workspace_id uuid,
  p_finding_type text,
  p_description text,
  p_threshold float
)
returns table (recurrence_group_id uuid, similarity float)
language sql
stable
security invoker
as $$
  select f.recurrence_group_id, similarity(f.description, p_description) as similarity
  from findings f
  where f.workspace_id = p_workspace_id
    and f.finding_type = p_finding_type
    and f.status = 'open'
    and similarity(f.description, p_description) > p_threshold
  order by similarity desc, f.created_at asc
  limit 1;
$$;

grant execute on function match_recurrence_finding(uuid, text, text, float) to service_role;
