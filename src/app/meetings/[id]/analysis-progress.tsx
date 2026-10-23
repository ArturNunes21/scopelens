"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The 3 pipeline stages, in order (ARCHITECTURE.md section 3). `key` matches
// ai_calls.stage, which the pipeline writes as each stage finishes.
const STAGES = [
  {
    key: "extraction",
    label: "Extraction",
    detail: "Pulling blockers, risks, dependencies and decisions out of the transcript.",
  },
  {
    key: "diagnostic",
    label: "Diagnosis",
    detail: "Checking for contradictions, links to earlier meetings, and decisions left unmade.",
  },
  {
    key: "synthesis",
    label: "Synthesis",
    detail: "Writing the summary and the suggested next actions.",
  },
] as const;

// Real progress, not a timer: each finished stage logs a row to ai_calls,
// and this subscribes to those inserts via Realtime (RLS still applies, see
// the enable_ai_calls_realtime migration). The final completed/failed
// transition is handled by MeetingStatusBadge, which refreshes the page.
export function AnalysisProgress({
  meetingId,
  initialDone,
}: {
  meetingId: string;
  initialDone: string[];
}) {
  const [done, setDone] = useState<string[]>(initialDone);

  // Same prop-resync pattern as status-badge.tsx: a server refresh may hand
  // us stages this component hasn't heard about over Realtime.
  const initialKey = initialDone.join(",");
  const [prevInitialKey, setPrevInitialKey] = useState(initialKey);
  if (initialKey !== prevInitialKey) {
    setPrevInitialKey(initialKey);
    setDone((current) => Array.from(new Set([...current, ...initialDone])));
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ai-calls-${meetingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_calls", filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          const stage = (payload.new as { stage: string }).stage;
          setDone((current) => (current.includes(stage) ? current : [...current, stage]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  const activeIndex = STAGES.findIndex((stage) => !done.includes(stage.key));

  return (
    <section aria-live="polite" className="max-w-2xl">
      <h2 className="font-display text-xl text-foreground">Analyzing this meeting</h2>
      <p className="mt-1.5 text-sm text-secondary">
        Usually under a minute. This page updates on its own when each step finishes.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-1.5" aria-hidden>
        {STAGES.map((stage, index) => (
          <div key={stage.key} className="relative h-0.5 overflow-hidden rounded-full bg-border">
            {index < activeIndex || activeIndex === -1 ? (
              <div className="absolute inset-0 bg-accent" />
            ) : index === activeIndex ? (
              <div className="anim-scan absolute inset-y-0 w-1/4 bg-accent" />
            ) : null}
          </div>
        ))}
      </div>

      <ol className="mt-6 flex flex-col">
        {STAGES.map((stage, index) => {
          const state =
            activeIndex === -1 || index < activeIndex ? "done" : index === activeIndex ? "active" : "waiting";
          return (
            <li key={stage.key} className="flex gap-4 border-b border-border py-4 last:border-b-0">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                {state === "done" ? (
                  <svg viewBox="0 0 16 16" className="size-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5l3 3 7-7" />
                  </svg>
                ) : state === "active" ? (
                  <span className="relative flex size-2.5">
                    <span className="absolute inset-0 rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                    <span className="relative size-2.5 rounded-full bg-accent" />
                  </span>
                ) : (
                  <span className="size-2.5 rounded-full border border-muted" />
                )}
              </span>
              <div>
                <p className={`text-sm font-medium ${state === "waiting" ? "text-muted" : "text-foreground"}`}>
                  {stage.label}
                  <span className="sr-only">
                    {state === "done" ? " (done)" : state === "active" ? " (in progress)" : " (waiting)"}
                  </span>
                </p>
                <p className={`mt-0.5 text-sm ${state === "waiting" ? "text-muted" : "text-secondary"}`}>
                  {stage.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
