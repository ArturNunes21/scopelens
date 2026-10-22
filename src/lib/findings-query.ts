import type { SupabaseClient } from "@supabase/supabase-js";
import type { FindingRow } from "./dashboard";

// Shared read for every page that aggregates findings (dashboard, brief,
// decision log, public share page). The !inner embed is what makes the
// Phase 9 project filter possible: findings carry no project_id of their
// own, they reach it through their meeting.
const FINDING_COLUMNS =
  "id, finding_type, description, status, decision_status, resolved_at, recurrence_group_id, owner, due_date, meeting:meetings!inner(id, title, occurred_at, project_id)";

// PostgREST silently truncates any unlimited query at its configured
// max_rows (1000 in supabase/config.toml) — without an explicit limit here,
// a workspace that ever crosses that count would get wrong cumulative
// aggregates with no error surfaced. Ordering DESC + limiting, then
// reversing back to ascending below, keeps the MOST RECENT findings when a
// cap is hit rather than the oldest — the more useful half to keep correct
// for a dashboard, at the cost of undercounting older history. Placeholder
// ceiling for the MVP, same spirit as the 50k-char transcript cap (GAPS.md
// G17) — a real fix once a workspace nears this is a server-side aggregate
// query instead of fetching every row to reduce client-side.
export const FINDINGS_QUERY_CAP = 1000;

export async function fetchScopedFindings(
  supabase: SupabaseClient,
  workspaceId: string,
  projectId: string | null
): Promise<{ findings: FindingRow[]; truncated: boolean; error: { message: string } | null }> {
  let query = supabase
    .from("findings")
    .select(FINDING_COLUMNS)
    .eq("workspace_id", workspaceId);
  if (projectId) query = query.eq("meeting.project_id", projectId);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(FINDINGS_QUERY_CAP);

  const findings = ((data ?? []) as unknown as FindingRow[]).reverse();
  return { findings, truncated: findings.length === FINDINGS_QUERY_CAP, error };
}
