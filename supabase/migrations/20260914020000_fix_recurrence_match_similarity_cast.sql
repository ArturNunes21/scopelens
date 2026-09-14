-- Fixes a real bug caught by manual Phase 5 testing (2026-09-14): calling
-- match_recurrence_finding threw "structure of query does not match
-- function result type". pg_trgm's similarity() returns `real` (float4),
-- but the function is declared `returns table (..., similarity float)`
-- (float8) — plpgsql's RETURN QUERY is strict about this mismatch, unlike
-- the original `language sql` version (which relied on the looser implicit
-- coercion plain SQL functions get). Explicit cast fixes it without
-- changing the function's public signature.
create or replace function match_recurrence_finding(
  p_workspace_id uuid,
  p_finding_type text,
  p_description text,
  p_threshold float
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
      and f.description % p_description
    order by similarity desc, f.created_at asc
    limit 1;
end;
$$;

grant execute on function match_recurrence_finding(uuid, text, text, float) to service_role;
