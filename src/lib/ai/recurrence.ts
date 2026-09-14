import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Calibrated against tests/recurrence-matching.test.ts fixtures: a genuine
// reworded restatement of the same blocker scored 0.32 trigram similarity;
// the closest pair of genuinely distinct blockers scored 0.092. 0.25 sits
// with margin above the false-positive ceiling while still catching real
// paraphrases, per the PRD 11.1 zero-false-positives bar (a false positive
// is explicitly costlier than a missed recurrence here). pg_trgm's own
// default GUC (pg_trgm.similarity_threshold) is 0.3 for reference.
const DEFAULT_RECURRENCE_SIMILARITY_THRESHOLD = 0.25;

function getRecurrenceThreshold(): number {
  const raw = process.env.RECURRENCE_SIMILARITY_THRESHOLD;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_RECURRENCE_SIMILARITY_THRESHOLD;
}

export type RecurrenceMatch = { recurrenceGroupId: string; similarity: number } | null;

// Looks for an existing OPEN finding of the same type/workspace whose
// description is a reworded restatement of `description`. Must be called
// BEFORE inserting the new finding it's matching on behalf of — see
// pipeline.ts for why (self-referencing NOT NULL FK on recurrence_group_id).
//
// Known, accepted gap: two meetings for the same workspace processed
// concurrently could both miss each other's yet-uninserted findings and
// both become distinct roots for the same issue — a missed recurrence
// (false negative), not a false positive, so it doesn't violate the PRD
// 11.1 zero-false-positives bar. No queue/locking infra exists to close
// this window; not worth building for an MVP whose only hard bar is on
// false positives.
export async function findRecurrenceMatch(
  supabase: ReturnType<typeof createServiceRoleClient>,
  workspaceId: string,
  findingType: string,
  description: string
): Promise<RecurrenceMatch> {
  const { data, error } = await supabase.rpc("match_recurrence_finding", {
    p_workspace_id: workspaceId,
    p_finding_type: findingType,
    p_description: description,
    p_threshold: getRecurrenceThreshold(),
  });
  if (error) throw new Error(`Recurrence match query failed: ${error.message}`);
  const row = data?.[0];
  return row ? { recurrenceGroupId: row.recurrence_group_id, similarity: row.similarity } : null;
}
