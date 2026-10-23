"use client";

import { useActionState, useState } from "react";
import { createMeeting } from "../actions";
import { MAX_TRANSCRIPT_CHARS } from "../transcript";
import { buttonClass, ErrorText, FIELD_CLASS, PageHeader } from "@/components/ui";

const MEETING_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "planning", label: "Planning" },
  { value: "retro", label: "Retro" },
  { value: "kickoff", label: "Kickoff" },
] as const;

export function NewMeetingForm({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; name: string }[];
  defaultProjectId: string;
}) {
  const [state, formAction, pending] = useActionState(createMeeting, {
    error: null,
  });
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [pastedText, setPastedText] = useState("");

  return (
    <div className="max-w-2xl">
      <PageHeader
        back={{ href: `/meetings?project=${defaultProjectId}`, label: "Meetings" }}
        title="New meeting"
        subtitle="Paste or upload the transcript. The analysis starts as soon as you save and takes about a minute."
      />

      <form action={formAction} className="flex flex-col gap-5">
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="project_id" className="text-sm font-medium text-foreground">
            Project
          </label>
          <select
            id="project_id"
            name="project_id"
            required
            defaultValue={defaultProjectId}
            className={FIELD_CLASS}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
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

          <div className="flex flex-col gap-1.5">
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
            <div role="group" aria-label="Transcript source" className="flex rounded border border-border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("paste")}
                aria-pressed={mode === "paste"}
                className={`rounded-sm px-3 py-1 transition-colors ${
                  mode === "paste" ? "bg-surface-2 text-foreground" : "text-secondary hover:text-foreground"
                }`}
              >
                Paste
              </button>
              <button
                type="button"
                onClick={() => setMode("upload")}
                aria-pressed={mode === "upload"}
                className={`rounded-sm px-3 py-1 transition-colors ${
                  mode === "upload" ? "bg-surface-2 text-foreground" : "text-secondary hover:text-foreground"
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
                rows={12}
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                placeholder={
                  "Ana (PM): The goal for this sprint is the checkout redesign.\nBruno (Eng): We're still blocked on the payments webhook contract…"
                }
                className={`resize-y font-serif text-[0.95rem] leading-relaxed ${FIELD_CLASS}`}
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
              className={`file:mr-3 file:rounded file:border-0 file:bg-surface file:px-2.5 file:py-1 file:text-xs file:text-foreground ${FIELD_CLASS}`}
            />
          )}
        </div>

        <button
          type="submit"
          disabled={pending || pastedText.length > MAX_TRANSCRIPT_CHARS}
          className={`mt-1 self-start ${buttonClass("primary")}`}
        >
          {pending ? "Analyzing…" : "Save and analyze"}
        </button>

        {pending && (
          <p role="status" className="flex items-start gap-2.5 text-sm text-secondary">
            <span className="relative mt-1.5 flex size-2 shrink-0">
              <span className="absolute inset-0 rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
            Reading the transcript: extraction, diagnosis, then synthesis. Keep this tab open, it
            takes about a minute.
          </p>
        )}

        {state.error && <ErrorText>{state.error}</ErrorText>}
      </form>
    </div>
  );
}
