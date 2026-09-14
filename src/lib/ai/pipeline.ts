import { randomUUID } from "node:crypto";
import { getEnvNumber } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { extractFindings } from "./extraction";
import { findRecurrenceMatch } from "./recurrence";

const DEFAULT_MONTHLY_BUDGET_USD = 5;

function getMonthlyBudgetUsd(): number {
  return getEnvNumber("AI_MONTHLY_BUDGET_USD", DEFAULT_MONTHLY_BUDGET_USD);
}

// Cost ceiling enforcement (ARCHITECTURE.md section 2.5, resolves GAPS.md G12):
// a blunt guardrail against runaway AI spend, checked before every Stage 1 call.
async function isOverMonthlyBudget(
  supabase: ReturnType<typeof createServiceRoleClient>,
  workspaceId: string
): Promise<boolean> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("ai_calls")
    .select("cost_usd")
    .eq("workspace_id", workspaceId)
    .gte("created_at", monthStart.toISOString());

  if (error) throw new Error(`Could not check AI budget: ${error.message}`);

  const spent = (data ?? []).reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
  return spent >= getMonthlyBudgetUsd();
}

// Runs Stage 1 (extraction) for a meeting: pending -> processing -> completed/failed.
// Uses the service-role client — safe here because the caller (createMeeting
// server action) already verified workspace membership via requireWorkspace()
// before this meeting was ever inserted (ARCHITECTURE.md section 2 auth pattern).
export async function runExtractionPipeline(
  meetingId: string,
  workspaceId: string
): Promise<void> {
  const supabase = createServiceRoleClient();

  if (await isOverMonthlyBudget(supabase, workspaceId)) {
    await supabase
      .from("meetings")
      .update({
        status: "failed",
        error_message: "Monthly AI budget reached for this workspace.",
      })
      .eq("id", meetingId);
    return;
  }

  await supabase.from("meetings").update({ status: "processing" }).eq("id", meetingId);

  // Idempotent retry safety (resolves GAPS.md G13): clear any findings left
  // over from a previous attempt on this meeting before writing new ones.
  await supabase.from("findings").delete().eq("meeting_id", meetingId);

  const { data: meeting, error: fetchError } = await supabase
    .from("meetings")
    .select("transcript_raw, meeting_type")
    .eq("id", meetingId)
    .single();

  if (fetchError || !meeting) {
    await supabase
      .from("meetings")
      .update({ status: "failed", error_message: "Meeting not found." })
      .eq("id", meetingId);
    return;
  }

  try {
    const result = await extractFindings(meeting.transcript_raw, meeting.meeting_type);

    const extracted = [
      ...result.data.blockers.map((f) => ({ ...f, finding_type: "blocker" as const })),
      ...result.data.risks.map((f) => ({ ...f, finding_type: "risk" as const })),
      ...result.data.dependencies.map((f) => ({
        ...f,
        finding_type: "dependency" as const,
      })),
      ...result.data.decisions.map((f) => ({ ...f, finding_type: "decision" as const })),
    ];

    // Matching must only ever see findings already committed from OTHER
    // meetings (ARCHITECTURE.md section 2.3, Phase 4) — this meeting's own
    // rows aren't inserted until after Promise.all below resolves, which is
    // what keeps same-meeting findings from matching each other. Safe to run
    // in parallel: every match call only reads already-committed rows, and
    // that read set doesn't change based on ordering among these calls.
    const rows = await Promise.all(
      extracted.map(async (f) => {
        const id = randomUUID();
        const match = await findRecurrenceMatch(
          supabase,
          workspaceId,
          f.finding_type,
          f.description
        );
        return {
          id,
          workspace_id: workspaceId,
          meeting_id: meetingId,
          finding_type: f.finding_type,
          description: f.description,
          owner: f.owner,
          decision_status: "decision_status" in f ? f.decision_status : null,
          recurrence_group_id: match ? match.recurrenceGroupId : id,
        };
      })
    );

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("findings").insert(rows);
      if (insertError) throw new Error(`Could not save findings: ${insertError.message}`);
    }

    const { error: aiCallError } = await supabase.from("ai_calls").insert({
      workspace_id: workspaceId,
      meeting_id: meetingId,
      stage: "extraction",
      model: "claude-haiku-4-5",
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd: result.costUsd,
      latency_ms: result.latencyMs,
    });
    if (aiCallError) throw new Error(`Could not log AI call: ${aiCallError.message}`);

    await supabase.from("meetings").update({ status: "completed" }).eq("id", meetingId);
  } catch (error) {
    // No partial data left behind (resolves GAPS.md G13): drop whatever
    // findings this failed attempt may have inserted before the error.
    await supabase.from("findings").delete().eq("meeting_id", meetingId);
    await supabase
      .from("meetings")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Extraction failed.",
      })
      .eq("id", meetingId);
  }
}
