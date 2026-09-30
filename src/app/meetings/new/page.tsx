"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createMeeting } from "../actions";
import { MAX_TRANSCRIPT_CHARS } from "../transcript";
import { buttonClass, CARD, ErrorText, FIELD_CLASS } from "@/components/ui";

const MEETING_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "planning", label: "Planning" },
  { value: "retro", label: "Retro" },
  { value: "kickoff", label: "Kickoff" },
] as const;

export default function NewMeetingPage() {
  const [state, formAction, pending] = useActionState(createMeeting, {
    error: null,
  });
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [pastedText, setPastedText] = useState("");

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <Link href="/meetings" className="text-sm text-secondary hover:text-foreground">
          ← Meetings
        </Link>

        <h1 className="mt-4 text-xl font-semibold text-foreground">New meeting</h1>

        <form action={formAction} className={`mt-6 flex flex-col gap-4 ${CARD}`}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="text-sm font-medium text-foreground">
              Title
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="Sprint 12 daily standup"
              className={FIELD_CLASS}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="meeting_type" className="text-sm font-medium text-foreground">
                Type
              </label>
              <select
                id="meeting_type"
                name="meeting_type"
                required
                defaultValue="daily"
                className={FIELD_CLASS}
              >
                {MEETING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="occurred_at" className="text-sm font-medium text-foreground">
                Date
              </label>
              <input
                id="occurred_at"
                name="occurred_at"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Transcript</span>
              <div className="flex gap-1 rounded-full border border-border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("paste")}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    mode === "paste" ? "bg-accent text-accent-foreground" : "text-secondary"
                  }`}
                >
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => setMode("upload")}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    mode === "upload" ? "bg-accent text-accent-foreground" : "text-secondary"
                  }`}
                >
                  Upload
                </button>
              </div>
            </div>

            {mode === "paste" ? (
              <>
                <textarea
                  name="transcript_text"
                  rows={10}
                  value={pastedText}
                  onChange={(event) => setPastedText(event.target.value)}
                  placeholder="Paste the meeting transcript here…"
                  className={`resize-y font-mono text-xs ${FIELD_CLASS}`}
                />
                <p
                  className={`text-right text-xs ${
                    pastedText.length > MAX_TRANSCRIPT_CHARS ? "text-status-critical" : "text-secondary"
                  }`}
                >
                  {pastedText.length.toLocaleString()} / {MAX_TRANSCRIPT_CHARS.toLocaleString()}
                </p>
              </>
            ) : (
              <input
                type="file"
                name="transcript_file"
                accept=".txt,.vtt,text/plain,text/vtt"
                className={`file:mr-3 file:rounded file:border-0 file:bg-accent/10 file:px-2 file:py-1 file:text-xs file:text-accent ${FIELD_CLASS}`}
              />
            )}
          </div>

          <button
            type="submit"
            disabled={pending || pastedText.length > MAX_TRANSCRIPT_CHARS}
            className={`mt-2 ${buttonClass("primary")}`}
          >
            {pending ? "Saving…" : "Save meeting"}
          </button>

          {state.error && <ErrorText>{state.error}</ErrorText>}
        </form>
      </div>
    </div>
  );
}
