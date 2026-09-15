-- Phase 6 prerequisite — automatic resolution detection: Stage 1 extraction
-- (src/lib/ai/extraction.ts) also returns `resolved_mentions` when a
-- transcript explicitly states a previously-discussed blocker/risk/
-- dependency is now resolved. This function finds the OPEN finding that
-- mention refers to, the same way match_recurrence_finding finds a
-- recurrence match, but:
--
--   - excludes the meeting doing the mentioning (`p_exclude_meeting_id`):
--     unlike match_recurrence_finding, the caller runs this AFTER inserting
--     the current meeting's own findings (a resolution mention refers to an
--     EARLIER meeting's issue), so same-meeting rows are visible here and
--     must be filtered explicitly rather than relying on insert ordering.
--   - otherwise identical matching semantics (type + workspace scoped,
--     status = 'open', pg_trgm similarity above threshold) — see
--     20260914020000_fix_recurrence_match_similarity_cast.sql for why this
--     is plpgsql with an explicit float8 cast rather than plain SQL.

create function match_finding_to_resolve(
  p_workspace_id uuid,
  p_finding_type text,
  p_description text,
  p_threshold float,
  p_exclude_meeting_id uuid
)
returns table (finding_id uuid, similarity float)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  perform set_config('pg_trgm.similarity_threshold', p_threshold::text, true);

  return query
    select f.id, similarity(f.description, p_description)::double precision as similarity
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
