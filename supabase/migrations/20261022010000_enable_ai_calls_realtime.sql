-- Phase 10: the meeting detail page shows the analysis pipeline's 3 stages
-- (extraction -> diagnosis -> synthesis) as they finish. Each stage already
-- logs a row to ai_calls when it completes, so streaming those inserts gives
-- real progress with no polling and no new column. RLS on ai_calls
-- (workspace_isolation) still applies to postgres_changes, so a subscriber
-- only ever receives rows from their own workspace. Without this migration
-- the page still works; the stages just advance only on the final refresh.
alter publication supabase_realtime add table ai_calls;
