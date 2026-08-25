"use server";

import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { extractTranscript } from "./transcript";

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

  redirect(`/meetings`);
}
