"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { extractTranscript } from "./transcript";
import { runExtractionPipeline } from "@/lib/ai/pipeline";

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
