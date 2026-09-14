-- Phase 4 follow-up (code review before merging #11): the original
-- match_recurrence_finding filtered with a bare `similarity(...) > p_threshold`
-- function call, which pg_trgm's GIN opclass has no index support for — only
-- the %/<%/%> operators do (findings_description_trgm_idx, initial schema
-- migration). Every call was doing a sequential scan over the workspace/type/
-- status-filtered rows. Switched to the `%` operator, whose threshold is the
-- session GUC pg_trgm.similarity_threshold — set per-call via set_config with
-- is_local=true so it never leaks past this transaction.
--
-- Also pins search_path = public, matching the pattern already used by
-- is_workspace_member() and the workspace-creation trigger function in the
-- initial schema migration (Postgres/Supabase lint: function_search_path_mutable).

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
    select f.recurrence_group_id, similarity(f.description, p_description) as similarity
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
