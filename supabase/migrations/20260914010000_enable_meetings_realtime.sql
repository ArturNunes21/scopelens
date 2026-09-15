-- Phase 5 (ARCHITECTURE.md section 3): the meeting detail page subscribes to
-- a single meeting row via Supabase Realtime to reflect pending -> processing
-- -> completed/failed without polling or a page refresh. Realtime only
-- streams changes for tables added to the supabase_realtime publication;
-- existing RLS on meetings (workspace_isolation) still applies to postgres_changes,
-- so a subscriber only ever receives rows from their own workspace.
alter publication supabase_realtime add table meetings;
