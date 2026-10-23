"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { extractTranscript } from "./transcript";
import { runExtractionPipeline } from "@/lib/ai/pipeline";
import { isOverFreePlanMeetingLimit, monthStartUtc } from "@/lib/billing";
import { withProject } from "@/lib/projects";

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
  const projectId = formData.get("project_id");

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
  if (typeof projectId !== "string" || !projectId) {
    return { error: "Choose a project." };
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

  // The composite FK on meetings(project_id, workspace_id) already rejects a
  // foreign project at insert time; checking here just turns that into a
  // readable form error instead of a raw constraint message.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!project) {
    return { error: "That project no longer exists." };
  }

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
      project_id: project.id,
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

  // Land on the result (or its failure + Retry), not back on the list.
  redirect(`/meetings/${meeting.id}`);
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
//
// Phase 9: the sample lives in its own project and carries short real
// transcripts, so the project switcher, transcript evidence, due dates,
// health score and decision log all have something to show.
export async function seedDemoData(): Promise<void> {
  const { supabase, user, workspaceId } = await requireWorkspace();

  const { count, error: countError } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (countError || (count ?? 0) > 0) return;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ workspace_id: workspaceId, name: "Checkout redesign (sample)" })
    .select("id")
    .single();
  if (projectError || !project) return;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const meetingA = { id: crypto.randomUUID(), occurred_at: new Date(now - 14 * day) };
  const meetingB = { id: crypto.randomUUID(), occurred_at: new Date(now - 7 * day) };
  const meetingC = { id: crypto.randomUUID(), occurred_at: new Date(now) };
  const resolvedAt = meetingC.occurred_at.toISOString();

  const { error: meetingsError } = await supabase.from("meetings").insert([
    {
      id: meetingA.id,
      workspace_id: workspaceId,
      project_id: project.id,
      title: "Sprint 14 Planning",
      meeting_type: "planning",
      source: "paste",
      transcript_raw: [
        "Ana (PM): The goal for sprint 14 is the checkout redesign.",
        "Bruno (Eng): The design handoff for the new checkout page is still pending from the design team, so we can't start the UI.",
        "Carla (Eng): I'll follow up with design today.",
        "Bruno (Eng): We're also blocked on the payments team delivering the new webhook contract. Checkout can't integrate without it.",
        "Ana (PM): Payments said the contract would be ready this week, but nobody gave me a date.",
        "Diego (Tech lead): Then let's not rush it. Move the checkout redesign to next sprint rather than rush the payments dependency.",
        "Ana (PM): Agreed, that's the decision.",
      ].join("\n"),
      occurred_at: meetingA.occurred_at.toISOString(),
      status: "completed",
      executive_summary:
        "Checkout redesign scoped for the sprint; already at risk on the payments team's webhook contract and a pending design handoff.",
      created_by: user.id,
    },
    {
      id: meetingB.id,
      workspace_id: workspaceId,
      project_id: project.id,
      title: "Daily standup",
      meeting_type: "daily",
      source: "paste",
      transcript_raw: [
        "Carla (Eng): Quick update — still blocked on the payments team's webhook contract for checkout, no change since planning.",
        "Bruno (Eng): New concern: the third-party vendor API has rate limits that may throttle checkout under peak load.",
        "Ana (PM): Should we run a load test against the vendor API before the checkout launch? Let's decide that this week.",
        "Diego (Tech lead): I can own that call.",
      ].join("\n"),
      occurred_at: meetingB.occurred_at.toISOString(),
      status: "completed",
      executive_summary:
        "Checkout work still blocked on the payments webhook contract; a new vendor rate-limit risk surfaced.",
      created_by: user.id,
    },
    {
      id: meetingC.id,
      workspace_id: workspaceId,
      project_id: project.id,
      title: "Sprint 14 Retro",
      meeting_type: "retro",
      source: "paste",
      transcript_raw: [
        "Ana (PM): Good news first — the payments team delivered the webhook contract, so checkout integration is unblocked.",
        "Carla (Eng): And the design handoff for checkout was completed and merged on Tuesday.",
        "Bruno (Eng): The cart abandonment spike we saw after the last deploy was a tracking bug, it's fixed.",
        "Ana (PM): So the decision is: we ship the checkout redesign next sprint.",
        "Diego (Tech lead): One gap — the vendor API rate-limit risk is still unverified before launch.",
        "Bruno (Eng): Also, the load-test environment isn't provisioned yet, so the vendor load test can't start. I'll get it set up.",
      ].join("\n"),
      occurred_at: meetingC.occurred_at.toISOString(),
      status: "completed",
      executive_summary:
        "Both blockers from planning cleared this sprint; shipping the checkout redesign next sprint, pending the vendor load test.",
      created_by: user.id,
    },
  ]);
  if (meetingsError) return;

  const blockerGroup = crypto.randomUUID();
  const dependencyGroup = crypto.randomUUID();
  const vendorRiskGroup = crypto.randomUUID();
  const decisionA = crypto.randomUUID();
  const decisionB = crypto.randomUUID();
  const riskC = crypto.randomUUID();
  const decisionC = crypto.randomUUID();
  const blockerC = crypto.randomUUID();

  // Every row gets an explicit id: PostgREST builds one INSERT statement
  // from the union of keys across the whole array, so a row that omitted
  // `id` here (relying on the column default) would have it sent as an
  // explicit NULL instead — violating the not-null constraint. Standalone
  // (non-recurring) findings set recurrence_group_id to their own id, the
  // same convention the real extraction pipeline uses (src/lib/ai/pipeline.ts).
  // Same reasoning for status/owner/due_date/resolved_at: every row lists them.
  const finding = (row: {
    id: string;
    meeting_id: string;
    finding_type: "blocker" | "risk" | "dependency" | "decision";
    description: string;
    recurrence_group_id: string;
    status?: "open" | "resolved";
    decision_status?: "taken" | "pending";
    owner?: string;
    due_date?: string;
  }) => ({
    workspace_id: workspaceId,
    status: "open",
    decision_status: null,
    owner: null,
    due_date: null,
    ...row,
    resolved_at: row.status === "resolved" ? resolvedAt : null,
  });

  await supabase.from("findings").insert([
    finding({
      id: blockerGroup,
      meeting_id: meetingA.id,
      finding_type: "blocker",
      description: "Design handoff for the new checkout page is still pending from the design team.",
      status: "resolved",
      owner: "Carla",
      recurrence_group_id: blockerGroup,
    }),
    finding({
      id: dependencyGroup,
      meeting_id: meetingA.id,
      finding_type: "dependency",
      description: "Checkout redesign is blocked on the payments team delivering the new webhook contract.",
      status: "resolved",
      recurrence_group_id: dependencyGroup,
    }),
    finding({
      id: decisionA,
      meeting_id: meetingA.id,
      finding_type: "decision",
      description: "Move the checkout redesign to next sprint rather than rush the payments dependency.",
      decision_status: "taken",
      owner: "Diego",
      recurrence_group_id: decisionA,
    }),
    finding({
      id: vendorRiskGroup,
      meeting_id: meetingB.id,
      finding_type: "risk",
      description: "Third-party vendor API rate limits may throttle checkout under peak load.",
      recurrence_group_id: vendorRiskGroup,
    }),
    finding({
      id: crypto.randomUUID(),
      meeting_id: meetingB.id,
      finding_type: "dependency",
      description: "Still blocked on the payments team's webhook contract for checkout.",
      status: "resolved",
      recurrence_group_id: dependencyGroup,
    }),
    finding({
      id: decisionB,
      meeting_id: meetingB.id,
      finding_type: "decision",
      description: "Run a load test against the vendor API before the checkout launch.",
      decision_status: "pending",
      owner: "Diego",
      due_date: isoDate(now - 3 * day),
      recurrence_group_id: decisionB,
    }),
    finding({
      id: crypto.randomUUID(),
      meeting_id: meetingC.id,
      finding_type: "dependency",
      description: "Payments team delivered the webhook contract — checkout integration unblocked.",
      status: "resolved",
      recurrence_group_id: dependencyGroup,
    }),
    finding({
      id: crypto.randomUUID(),
      meeting_id: meetingC.id,
      finding_type: "blocker",
      description: "Design handoff for checkout completed and merged.",
      status: "resolved",
      recurrence_group_id: blockerGroup,
    }),
    finding({
      id: riskC,
      meeting_id: meetingC.id,
      finding_type: "risk",
      description: "Cart abandonment spike observed after the last deploy.",
      status: "resolved",
      recurrence_group_id: riskC,
    }),
    finding({
      id: crypto.randomUUID(),
      meeting_id: meetingC.id,
      finding_type: "risk",
      description: "Vendor API rate-limit risk is still unverified before the checkout launch.",
      recurrence_group_id: vendorRiskGroup,
    }),
    finding({
      id: decisionC,
      meeting_id: meetingC.id,
      finding_type: "decision",
      description: "Ship the checkout redesign next sprint.",
      decision_status: "taken",
      recurrence_group_id: decisionC,
    }),
    finding({
      id: blockerC,
      meeting_id: meetingC.id,
      finding_type: "blocker",
      description: "Load-test environment isn't provisioned yet, so the vendor load test can't start.",
      owner: "Bruno",
      due_date: isoDate(now + 2 * day),
      recurrence_group_id: blockerC,
    }),
  ]);

  await supabase.from("diagnostic_notes").insert([
    {
      workspace_id: workspaceId,
      meeting_id: meetingA.id,
      lens: "contradiction",
      content:
        "The payments team said the webhook contract would be ready \"this week,\" but no committed date appears in the planning notes — worth confirming directly with their lead.",
      related_finding_ids: [dependencyGroup],
    },
    {
      workspace_id: workspaceId,
      meeting_id: meetingB.id,
      lens: "continuity",
      content:
        "This is the second meeting in a row where the payments webhook dependency has blocked checkout work without a named resolution owner.",
      related_finding_ids: [dependencyGroup],
    },
    {
      workspace_id: workspaceId,
      meeting_id: meetingC.id,
      lens: "decision_gap",
      content:
        "The decision to ship next sprint doesn't assign anyone to verify the vendor rate-limit risk before launch.",
      related_finding_ids: [decisionC],
    },
    {
      workspace_id: workspaceId,
      meeting_id: meetingC.id,
      lens: "contradiction",
      content:
        "Shipping next sprint was decided while the vendor load-test decision from the daily is still pending — the launch date depends on a call nobody has made yet.",
      related_finding_ids: [decisionC, decisionB],
    },
  ]);

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect(withProject("/meetings", project.id));
}

// Owner + due date, edited by hand from the meeting page (Phase 9). The AI
// pipeline already extracts an owner when one is named; this lets the team
// correct it and commit to a date. Workspace membership is re-verified via
// the user-scoped client, same pattern as toggleFindingStatus below.
export async function updateFindingAssignment(
  findingId: string,
  owner: string,
  dueDate: string
): Promise<{ error: string | null }> {
  const trimmedOwner = owner.trim().slice(0, 80);
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { error: "Invalid date." };
  }

  const { supabase, workspaceId } = await requireWorkspace();
  const { data: finding, error } = await supabase
    .from("findings")
    .update({ owner: trimmedOwner || null, due_date: dueDate || null })
    .eq("id", findingId)
    .eq("workspace_id", workspaceId)
    .select("meeting_id")
    .single();
  if (error || !finding) return { error: "Could not save." };

  revalidateFindingViews(finding.meeting_id);
  return { error: null };
}

// Decisions move pending -> taken (or back) by hand from the meeting page or
// the decision log (Phase 9) — decision_status is a decision's lifecycle, the
// same way status is for every other finding type.
export async function setDecisionStatus(
  findingId: string,
  nextStatus: "taken" | "pending"
): Promise<void> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data: finding, error } = await supabase
    .from("findings")
    .update({ decision_status: nextStatus })
    .eq("id", findingId)
    .eq("workspace_id", workspaceId)
    .eq("finding_type", "decision")
    .select("meeting_id")
    .single();
  if (error || !finding) return;

  revalidateFindingViews(finding.meeting_id);
}

// Every page that aggregates findings — a soft navigation back to any of
// them after an edit must not render from a stale router-cache entry.
function revalidateFindingViews(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/dashboard");
  revalidatePath("/decisions");
  revalidatePath("/brief");
  revalidatePath("/projects");
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

  // The Phase 6 dashboard's stat tiles/trend/recurring-issues list (and the
  // Phase 9 brief/health score/decision log) all read this same column.
  revalidateFindingViews(finding.meeting_id);
}
