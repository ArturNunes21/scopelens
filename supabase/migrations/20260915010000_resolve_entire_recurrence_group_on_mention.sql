-- Fixes a real gap found in code review before merge (2026-09-15): the
-- original match_finding_to_resolve (20260915000000) only identified the
-- single best-matching finding row. A recurring issue (Phase 4) can have
-- MULTIPLE open rows sharing one recurrence_group_id — e.g. the same blocker
-- raised in meeting1 and again in meeting2 are two distinct open rows in one
-- chain. A mention explicitly resolving the issue should close every open
-- occurrence in that chain, not just whichever single row scored highest
-- similarity, or the others stay open forever with no way to close them
-- (resolved_mentions is the only path to automatic resolution by design —
-- see ARCHITECTURE.md 2.3 "Resolution").
--
-- Return type changes from (finding_id, similarity) to
-- (recurrence_group_id, similarity) — the caller (src/lib/ai/recurrence.ts)
-- now bulk-resolves every open finding in that group instead of updating one
-- row by id. create or replace can't change a function's return type, so the
-- old signature is dropped first.

drop function if exists match_finding_to_resolve(uuid, text, text, float, uuid);

create function match_finding_to_resolve(
  p_workspace_id uuid,
  p_finding_type text,
  p_description text,
  p_threshold float,
  p_exclude_meeting_id uuid
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
    where f.workspace_id = p_workspace_id
      and f.finding_type = p_finding_type
      and f.status = 'open'
      and f.meeting_id != p_exclude_meeting_id
      and f.description % p_description
    order by similarity desc, f.created_at asc
    limit 1;
end;
$$;

grant execute on function match_finding_to_resolve(uuid, text, text, float, uuid) to service_role;
