"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createMeeting } from "../actions";
import { MAX_TRANSCRIPT_CHARS } from "../transcript";

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
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <Link
          href="/meetings"
          className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Meetings
        </Link>

        <h1 className="mt-4 text-xl font-semibold text-black dark:text-zinc-50">
          New meeting
        </h1>

        <form
          action={formAction}
          className="mt-6 flex flex-col gap-4 rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="text-sm font-medium text-black dark:text-zinc-50">
              Title
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="Sprint 12 daily standup"
              className="rounded border border-black/[.08] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/30"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="meeting_type" className="text-sm font-medium text-black dark:text-zinc-50">
                Type
              </label>
              <select
                id="meeting_type"
                name="meeting_type"
                required
                defaultValue="daily"
                className="rounded border border-black/[.08] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/30"
              >
                {MEETING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="occurred_at" className="text-sm font-medium text-black dark:text-zinc-50">
                Date
              </label>
              <input
                id="occurred_at"
                name="occurred_at"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="rounded border border-black/[.08] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/30"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-black dark:text-zinc-50">
                Transcript
              </span>
              <div className="flex gap-1 rounded-full border border-black/[.08] p-0.5 text-xs dark:border-white/[.145]">
                <button
                  type="button"
                  onClick={() => setMode("paste")}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    mode === "paste"
                      ? "bg-foreground text-background"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => setMode("upload")}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    mode === "upload"
                      ? "bg-foreground text-background"
                      : "text-zinc-600 dark:text-zinc-400"
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
                  className="resize-y rounded border border-black/[.08] bg-transparent px-3 py-2 font-mono text-xs text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/30"
                />
                <p
                  className={`text-right text-xs ${
                    pastedText.length > MAX_TRANSCRIPT_CHARS
                      ? "text-red-600 dark:text-red-400"
                      : "text-zinc-500 dark:text-zinc-400"
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
                className="rounded border border-black/[.08] bg-transparent px-3 py-2 text-sm text-black outline-none file:mr-3 file:rounded file:border-0 file:bg-black/[.06] file:px-2 file:py-1 file:text-xs dark:border-white/[.145] dark:text-zinc-50 dark:file:bg-white/[.08]"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={pending || pastedText.length > MAX_TRANSCRIPT_CHARS}
            className="mt-2 rounded bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {pending ? "Saving…" : "Save meeting"}
          </button>

          {state.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
