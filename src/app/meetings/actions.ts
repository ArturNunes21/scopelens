"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { extractTranscript } from "./transcript";
import { runExtractionPipeline } from "@/lib/ai/pipeline";
import { isOverFreePlanMeetingLimit, monthStartUtc } from "@/lib/billing";

const MEETING_TYPES = ["daily", "planning", "retro", "kickoff"] as const;

export type CreateMeetingState = { error: string | null };

export async function createMeeting(
  _prevState: CreateMeetingState,
  formData: FormData
): Promise<CreateMeetingState> {
  const title = formData.get("title");
  const meetingType = formData.get("meeting_type");
  const occurredAt = formData.get("occurred_at");
  const pastedText = formData.get("transcript_text");
  const file = formData.get("transcript_file");

  if (typeof title !== "string" || !title.trim()) {
    return { error: "Title is required." };
  }
  if (
    typeof meetingType !== "string" ||
    !MEETING_TYPES.includes(meetingType as (typeof MEETING_TYPES)[number])
  ) {
    return { error: "Choose a valid meeting type." };
  }
  if (typeof occurredAt !== "string" || !occurredAt) {
    return { error: "Meeting date is required." };
  }

  let source: "paste" | "upload";
  let raw: string;
  let filename = "";

  if (file instanceof File && file.size > 0) {
    source = "upload";
    filename = file.name;
    raw = await file.text();
  } else if (typeof pastedText === "string" && pastedText.trim()) {
    source = "paste";
    raw = pastedText;
  } else {
    return { error: "Paste a transcript or upload a .txt/.vtt file." };
  }

  const parsed = extractTranscript(filename, raw);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { supabase, user, workspaceId } = await requireWorkspace();

  // Feature gate by plan (ROADMAP.md Phase 7): checked here, the actual
  // insert boundary, rather than in the UI alone.
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("plan")
    .eq("id", workspaceId)
    .single();
  if (workspaceError || !workspace) {
    return { error: "Could not verify workspace plan." };
  }

  const { count: meetingsThisMonth, error: countError } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", monthStartUtc().toISOString());
  if (countError) {
    return { error: "Could not verify plan usage." };
  }
  if (isOverFreePlanMeetingLimit(workspace.plan, meetingsThisMonth ?? 0)) {
    return {
      error: "Free plan meeting limit reached for this month. Upgrade to Pro on the Billing page to keep going.",
    };
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      workspace_id: workspaceId,
      title: title.trim(),
      meeting_type: meetingType,
      source,
      transcript_raw: parsed.text,
      occurred_at: new Date(occurredAt).toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !meeting) {
    return { error: error?.message ?? "Could not save the meeting." };
  }

  // No queue for the MVP — processing runs in the same request that received
  // the upload (ARCHITECTURE.md section 3). Errors are recorded on the
  // meeting itself (status='failed'), never thrown back to the form.
  await runExtractionPipeline(meeting.id, workspaceId);

  redirect(`/meetings`);
}

// User-triggered retry (ARCHITECTURE.md section 3, resolves GAPS.md G13): the
// pipeline itself is idempotent — re-running it clears any prior
// findings/diagnostic_notes/suggested_actions for this meeting and starts
// fresh from Stage 1. Workspace membership is re-verified here rather than
// trusting the meetingId from the form.
export async function retryMeeting(meetingId: string): Promise<void> {
  const { supabase, workspaceId } = await requireWorkspace();

  // Verify via the user-scoped (RLS-respecting) client that this meeting
  // actually belongs to the caller's workspace before running the
  // service-role pipeline on it — the pipeline itself trusts workspaceId as
  // given, so this check is what stands between a caller and a cross-tenant
  // write (ARCHITECTURE.md section 2 auth pattern). Also require status
  // 'failed': a stale/duplicate client call (page not yet re-rendered after
  // a Realtime status push, or a direct call bypassing the UI) must not
  // start a second concurrent pipeline run on a meeting already pending/
  // processing/completed — that would interleave two runs' deletes/inserts
  // across findings/diagnostic_notes/suggested_actions.
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("workspace_id", workspaceId)
    .eq("status", "failed")
    .single();
  if (error || !meeting) return;

  await runExtractionPipeline(meetingId, workspaceId);
  revalidatePath(`/meetings/${meetingId}`);
}

// Populates a brand-new workspace with a browsable sample (ROADMAP.md Phase
// 8 — "the product needs to survive a recruiter's first, unsupervised
// contact with it"). Only allowed while the workspace has zero meetings, so
// this can't be used to spam demo rows into a real, in-use workspace.
export async function seedDemoData(): Promise<void> {
  const { supabase, user, workspaceId } = await requireWorkspace();

  const { count, error: countError } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (countError || (count ?? 0) > 0) return;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const meetingA = { id: crypto.randomUUID(), occurred_at: new Date(now - 14 * day) };
  const meetingB = { id: crypto.randomUUID(), occurred_at: new Date(now - 7 * day) };
  const meetingC = { id: crypto.randomUUID(), occurred_at: new Date(now) };

  const { error: meetingsError } = await supabase.from("meetings").insert([
    {
      id: meetingA.id,
      workspace_id: workspaceId,
      title: "Sprint 14 Planning",
      meeting_type: "planning",
      source: "paste",
      transcript_raw: "(sample data — no real transcript)",
      occurred_at: meetingA.occurred_at.toISOString(),
      status: "completed",
      executive_summary:
        "Checkout redesign scoped for the sprint; already at risk on the payments team's webhook contract and a pending design handoff.",
      created_by: user.id,
    },
    {
      id: meetingB.id,
      workspace_id: workspaceId,
      title: "Daily standup",
      meeting_type: "daily",
      source: "paste",
      transcript_raw: "(sample data — no real transcript)",
      occurred_at: meetingB.occurred_at.toISOString(),
      status: "completed",
      executive_summary:
        "Checkout work still blocked on the payments webhook contract; a new vendor rate-limit risk surfaced.",
      created_by: user.id,
    },
    {
      id: meetingC.id,
      workspace_id: workspaceId,
      title: "Sprint 14 Retro",
      meeting_type: "retro",
      source: "paste",
      transcript_raw: "(sample data — no real transcript)",
      occurred_at: meetingC.occurred_at.toISOString(),
      status: "completed",
      executive_summary:
        "Both blockers from planning cleared this sprint; shipping the checkout redesign next sprint pending a load-test owner.",
      created_by: user.id,
    },
  ]);
  if (meetingsError) return;

  const blockerGroup = crypto.randomUUID();
  const dependencyGroup = crypto.randomUUID();
  const decisionA = crypto.randomUUID();
  const riskB = crypto.randomUUID();
  const decisionB = crypto.randomUUID();
  const riskC = crypto.randomUUID();
  const decisionC = crypto.randomUUID();

  // Every row gets an explicit id: PostgREST builds one INSERT statement
  // from the union of keys across the whole array, so a row that omitted
  // `id` here (relying on the column default) would have it sent as an
  // explicit NULL instead — violating the not-null constraint. Standalone
  // (non-recurring) findings set recurrence_group_id to their own id, the
  // same convention the real extraction pipeline uses (src/lib/ai/pipeline.ts).
  await supabase.from("findings").insert([
    {
      id: blockerGroup,
      workspace_id: workspaceId,
      meeting_id: meetingA.id,
      finding_type: "blocker",
      description: "Design handoff for the new checkout page is still pending from the design team.",
      status: "open",
      recurrence_group_id: blockerGroup,
    },
    {
      id: dependencyGroup,
      workspace_id: workspaceId,
      meeting_id: meetingA.id,
      finding_type: "dependency",
      description: "Checkout redesign is blocked on the payments team delivering the new webhook contract.",
      status: "open",
      recurrence_group_id: dependencyGroup,
    },
    {
      id: decisionA,
      workspace_id: workspaceId,
      meeting_id: meetingA.id,
      finding_type: "decision",
      description: "Move the checkout redesign to next sprint rather than rush the payments dependency.",
      decision_status: "taken",
      status: "open",
      recurrence_group_id: decisionA,
    },
    {
      id: riskB,
      workspace_id: workspaceId,
      meeting_id: meetingB.id,
      finding_type: "risk",
      description: "Third-party vendor API rate limits may throttle checkout under peak load.",
      status: "open",
      recurrence_group_id: riskB,
    },
    {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      meeting_id: meetingB.id,
      finding_type: "dependency",
      description: "Still blocked on the payments team's webhook contract for checkout.",
      status: "open",
      recurrence_group_id: dependencyGroup,
    },
    {
      id: decisionB,
      workspace_id: workspaceId,
      meeting_id: meetingB.id,
      finding_type: "decision",
      description: "Run a load test against the vendor API before the checkout launch.",
      decision_status: "pending",
      status: "open",
      recurrence_group_id: decisionB,
    },
    {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      meeting_id: meetingC.id,
      finding_type: "dependency",
      description: "Payments team delivered the webhook contract — checkout integration unblocked.",
      status: "resolved",
      resolved_at: meetingC.occurred_at.toISOString(),
      recurrence_group_id: dependencyGroup,
    },
    {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      meeting_id: meetingC.id,
      finding_type: "blocker",
      description: "Design handoff for checkout completed and merged.",
      status: "resolved",
      resolved_at: meetingC.occurred_at.toISOString(),
      recurrence_group_id: blockerGroup,
    },
    {
      id: riskC,
      workspace_id: workspaceId,
      meeting_id: meetingC.id,
      finding_type: "risk",
      description: "Cart abandonment spike observed after the last deploy.",
      status: "resolved",
      resolved_at: meetingC.occurred_at.toISOString(),
      recurrence_group_id: riskC,
    },
    {
      id: decisionC,
      workspace_id: workspaceId,
      meeting_id: meetingC.id,
      finding_type: "decision",
      description: "Ship the checkout redesign next sprint.",
      decision_status: "taken",
      status: "open",
      recurrence_group_id: decisionC,
    },
  ]);

  await supabase.from("diagnostic_notes").insert([
    {
      workspace_id: workspaceId,
      meeting_id: meetingA.id,
      lens: "contradiction",
      content:
        "The payments team said the webhook contract would be ready \"this week,\" but no committed date appears in the planning notes — worth confirming directly with their lead.",
    },
    {
      workspace_id: workspaceId,
      meeting_id: meetingB.id,
      lens: "continuity",
      content:
        "This is the second meeting in a row where the payments webhook dependency has blocked checkout work without a named resolution owner.",
    },
    {
      workspace_id: workspaceId,
      meeting_id: meetingC.id,
      lens: "decision_gap",
      content:
        "The decision to ship next sprint doesn't assign anyone to verify the vendor rate-limit risk before launch.",
    },
  ]);

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

// Manual resolve/reopen toggle (Phase 6 prerequisite): `findings.status` had
// no writer anywhere until now, so the trend dashboard's "open vs. resolved"
// view had no resolved data to show. Workspace membership is re-verified via
// the user-scoped client, same pattern as retryMeeting above.
//
// Excludes finding_type='decision': a decision's lifecycle is
// decision_status (taken/pending), not status — see ARCHITECTURE.md 2.3
// "Resolution." The UI already hides this toggle for decisions; this is the
// actual trust boundary in case that's ever bypassed.
export async function toggleFindingStatus(
  findingId: string,
  nextStatus: "open" | "resolved"
): Promise<void> {
  const { supabase, workspaceId } = await requireWorkspace();

  const { data: finding, error } = await supabase
    .from("findings")
    .update({
      status: nextStatus,
      resolved_at: nextStatus === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", findingId)
    .eq("workspace_id", workspaceId)
    .neq("finding_type", "decision")
    .select("id, meeting_id")
    .single();
  if (error || !finding) return;

  revalidatePath(`/meetings/${finding.meeting_id}`);
  // The Phase 6 dashboard's stat tiles/trend/recurring-issues list all read
  // from this same status column — without this, a soft-navigation back to
  // /dashboard after a manual resolve/reopen can render from a stale
  // router-cache entry.
  revalidatePath("/dashboard");
}
