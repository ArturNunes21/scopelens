import { getEnvNumber } from "@/lib/env";
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
  return getEnvNumber("RECURRENCE_SIMILARITY_THRESHOLD", DEFAULT_RECURRENCE_SIMILARITY_THRESHOLD);
}

// Deliberately its own, independently tunable threshold — NOT the recurrence
// one above, even though both go through the same pg_trgm similarity
// mechanism. The two tasks have asymmetric failure costs: a recurrence false
// positive merges two distinct issues into one group (annoying, visible,
// recoverable by inspection); a resolution false positive silently closes a
// real, different, still-open issue with no path back except a manual
// toggle nobody knows to look for. 0.25 was tuned down from pg_trgm's own
// default (0.3) specifically to favor recall for grouping; resolution
// instead favors precision, so it uses pg_trgm's untuned default rather than
// the recall-favoring 0.25 — revisit with real resolved_mentions data once
// it exists (no calibration fixtures for this specific task yet, unlike
// RECURRENCE_SIMILARITY_THRESHOLD's tests/recurrence-matching.test.ts basis).
const DEFAULT_RESOLUTION_SIMILARITY_THRESHOLD = 0.3;

function getResolutionThreshold(): number {
  return getEnvNumber("RESOLUTION_SIMILARITY_THRESHOLD", DEFAULT_RESOLUTION_SIMILARITY_THRESHOLD);
}

export type RecurrenceMatch = { recurrenceGroupId: string; similarity: number } | null;

// Both match_recurrence_finding and match_finding_to_resolve return the same
// (recurrence_group_id, similarity) shape — this is the one place that reads
// an RPC result of that shape, shared by both wrapper functions below.
async function callGroupMatchRpc(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rpcName: "match_recurrence_finding" | "match_finding_to_resolve",
  params: Record<string, string | number>
): Promise<RecurrenceMatch> {
  const { data, error } = await supabase.rpc(rpcName, params);
  if (error) throw new Error(`${rpcName} query failed: ${error.message}`);
  const row = data?.[0];
  return row ? { recurrenceGroupId: row.recurrence_group_id, similarity: row.similarity } : null;
}

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
  return callGroupMatchRpc(supabase, "match_recurrence_finding", {
    p_workspace_id: workspaceId,
    p_finding_type: findingType,
    p_description: description,
    p_threshold: getRecurrenceThreshold(),
  });
}

// Looks for the recurrence_group_id a resolved_mention from THIS meeting's
// extraction refers to (Phase 6 prerequisite — the only writer of
// findings.status = 'resolved' besides the manual toggle). Same pg_trgm
// matching mechanism as findRecurrenceMatch but its own, stricter threshold
// (see getResolutionThreshold above); excludes the mentioning meeting's own
// findings since, unlike recurrence matching, this runs AFTER they're
// already inserted.
//
// Returns the GROUP id, not a single finding id: a recurring issue (Phase 4)
// can have multiple open rows sharing one recurrence_group_id (e.g. the same
// blocker raised in two prior meetings) — resolving an explicit mention must
// close every open occurrence in that chain, not just whichever single row
// scored highest similarity (migration 20260915010000). The caller is
// expected to bulk-update every OPEN finding in the returned group.
export async function findFindingToResolve(
  supabase: ReturnType<typeof createServiceRoleClient>,
  workspaceId: string,
  findingType: string,
  description: string,
  excludeMeetingId: string
): Promise<RecurrenceMatch> {
  return callGroupMatchRpc(supabase, "match_finding_to_resolve", {
    p_workspace_id: workspaceId,
    p_finding_type: findingType,
    p_description: description,
    p_threshold: getResolutionThreshold(),
    p_exclude_meeting_id: excludeMeetingId,
  });
}
