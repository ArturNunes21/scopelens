-- Grants base table privileges to Supabase's built-in roles.
-- RLS filters *rows*, but the underlying table-level GRANT is still required
-- for the policy to ever be evaluated — this project's `supabase db push`
-- did not inherit the default privileges Supabase normally sets on the
-- `public` schema, which broke every query (including the service-role
-- client used by /api/health) with "permission denied for table ...".

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
