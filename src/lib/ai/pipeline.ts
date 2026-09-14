import { randomUUID } from "node:crypto";
import { getEnvNumber } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { extractFindings } from "./extraction";
import { findRecurrenceMatch } from "./recurrence";
import { diagnoseMeeting, type FindingForDiagnosis } from "./diagnosis";
import { synthesizeMeeting } from "./synthesis";

// Capped sample of other open findings fed to the continuity lens (Stage 2) —
// bounds prompt size as a workspace accumulates history; recent issues are
// the most relevant continuity signal anyway.
const PRIOR_FINDINGS_LIMIT = 50;

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

  // Idempotent retry safety (resolves GAPS.md G13): clear any rows left over
  // from a previous attempt on this meeting, from every stage, before
  // writing new ones.
  await supabase.from("findings").delete().eq("meeting_id", meetingId);
  await supabase.from("diagnostic_notes").delete().eq("meeting_id", meetingId);
  await supabase.from("suggested_actions").delete().eq("meeting_id", meetingId);

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

    const currentFindings: FindingForDiagnosis[] = rows.map((r) => ({
      id: r.id,
      finding_type: r.finding_type,
      description: r.description,
      owner: r.owner,
    }));

    // Continuity lens input: other open findings in this workspace, excluding
    // this meeting's own (already inserted above by the time this runs).
    const { data: priorFindingsRaw, error: priorFindingsError } = await supabase
      .from("findings")
      .select("id, finding_type, description, owner")
      .eq("workspace_id", workspaceId)
      .eq("status", "open")
      .neq("meeting_id", meetingId)
      .order("created_at", { ascending: false })
      .limit(PRIOR_FINDINGS_LIMIT);
    if (priorFindingsError) {
      throw new Error(`Could not load prior findings: ${priorFindingsError.message}`);
    }
    const priorFindings: FindingForDiagnosis[] = priorFindingsRaw ?? [];

    const diagnosis = await diagnoseMeeting(meeting.transcript_raw, currentFindings, priorFindings);

    if (diagnosis.data.notes.length > 0) {
      const { error: notesError } = await supabase.from("diagnostic_notes").insert(
        diagnosis.data.notes.map((note) => ({
          id: randomUUID(),
          workspace_id: workspaceId,
          meeting_id: meetingId,
          lens: note.lens,
          content: note.content,
          related_finding_ids: note.related_finding_ids,
        }))
      );
      if (notesError) throw new Error(`Could not save diagnostic notes: ${notesError.message}`);
    }

    const { error: diagnosisAiCallError } = await supabase.from("ai_calls").insert({
      workspace_id: workspaceId,
      meeting_id: meetingId,
      stage: "diagnostic",
      model: "claude-sonnet-5",
      tokens_in: diagnosis.tokensIn,
      tokens_out: diagnosis.tokensOut,
      cost_usd: diagnosis.costUsd,
      latency_ms: diagnosis.latencyMs,
    });
    if (diagnosisAiCallError) {
      throw new Error(`Could not log AI call: ${diagnosisAiCallError.message}`);
    }

    const synthesis = await synthesizeMeeting(
      meeting.transcript_raw,
      currentFindings,
      diagnosis.data.notes
    );

    if (synthesis.data.suggested_actions.length > 0) {
      const { error: actionsError } = await supabase.from("suggested_actions").insert(
        synthesis.data.suggested_actions.map((action) => ({
          id: randomUUID(),
          workspace_id: workspaceId,
          meeting_id: meetingId,
          description: action.description,
          priority: action.priority,
        }))
      );
      if (actionsError) throw new Error(`Could not save suggested actions: ${actionsError.message}`);
    }

    const { error: synthesisAiCallError } = await supabase.from("ai_calls").insert({
      workspace_id: workspaceId,
      meeting_id: meetingId,
      stage: "synthesis",
      model: "claude-opus-5",
      tokens_in: synthesis.tokensIn,
      tokens_out: synthesis.tokensOut,
      cost_usd: synthesis.costUsd,
      latency_ms: synthesis.latencyMs,
    });
    if (synthesisAiCallError) {
      throw new Error(`Could not log AI call: ${synthesisAiCallError.message}`);
    }

    await supabase
      .from("meetings")
      .update({ status: "completed", executive_summary: synthesis.data.executive_summary })
      .eq("id", meetingId);
  } catch (error) {
    // No partial data left behind (resolves GAPS.md G13): drop whatever any
    // stage of this failed attempt may have inserted before the error.
    await supabase.from("findings").delete().eq("meeting_id", meetingId);
    await supabase.from("diagnostic_notes").delete().eq("meeting_id", meetingId);
    await supabase.from("suggested_actions").delete().eq("meeting_id", meetingId);
    await supabase
      .from("meetings")
      .update({
        status: "failed",
        executive_summary: null,
        error_message: error instanceof Error ? error.message : "Extraction failed.",
      })
      .eq("id", meetingId);
  }
}
