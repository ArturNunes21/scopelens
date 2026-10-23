"use client";

import { useState } from "react";

// A static replica of the meeting page's core idea: every finding points
// back to the transcript lines it came from. Content is the sample
// project's real planning meeting (seedDemoData in meetings/actions.ts).
const LINES = [
  ["Ana (PM)", "The goal for sprint 14 is the checkout redesign."],
  ["Bruno (Eng)", "The design handoff for the new checkout page is still pending from the design team, so we can't start the UI."],
  ["Carla (Eng)", "I'll follow up with design today."],
  ["Bruno (Eng)", "We're also blocked on the payments team delivering the new webhook contract. Checkout can't integrate without it."],
  ["Ana (PM)", "Payments said the contract would be ready this week, but nobody gave me a date."],
  ["Diego (Tech lead)", "Then let's not rush it. Move the checkout redesign to next sprint rather than rush the payments dependency."],
  ["Ana (PM)", "Agreed, that's the decision."],
] as const;

const FINDINGS = [
  {
    type: "Blocker",
    text: "Checkout can't integrate until the payments team delivers the webhook contract.",
    lines: [4],
  },
  {
    type: "Dependency",
    text: "Design handoff for the checkout page is still pending from the design team.",
    lines: [2, 3],
    note: "Owner: Carla",
  },
  {
    type: "Risk",
    text: "The contract's \"this week\" has no committed date behind it.",
    lines: [5],
    note: "Nobody called this a risk out loud.",
    inferred: true,
  },
  {
    type: "Decision",
    text: "Move the checkout redesign to next sprint.",
    lines: [6, 7],
    note: "Decided",
  },
] as const;

export function TranscriptDemo() {
  const [active, setActive] = useState<number | null>(null);
  const highlighted = new Set<number>(active === null ? [] : FINDINGS[active].lines);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 text-xs sm:px-5">
        <span className="font-medium text-foreground">Sprint 14 Planning</span>
        <span className="text-muted">7 lines, 4 findings</span>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <ol className="flex flex-col gap-0.5 border-b border-border p-2 sm:p-3 md:border-r md:border-b-0">
          {LINES.map(([speaker, text], index) => {
            const lit = highlighted.has(index + 1);
            return (
              <li
                key={index}
                className={`grid grid-cols-[1.5rem_1fr] gap-1 rounded px-2 py-1.5 transition-colors duration-200 ${
                  lit ? "bg-status-serious-bg shadow-[inset_2px_0_0_var(--accent)]" : ""
                }`}
              >
                <span className="pt-0.5 text-[0.7rem] tabular-nums text-muted">{index + 1}</span>
                <p className={`font-serif text-[0.95rem] leading-relaxed ${lit ? "text-foreground" : "text-secondary"}`}>
                  <span className="block font-sans text-xs font-medium text-muted">{speaker}</span>
                  {text}
                </p>
              </li>
            );
          })}
        </ol>
        <ul className="flex flex-col p-2 sm:p-3" onMouseLeave={() => setActive(null)}>
          {FINDINGS.map((finding, index) => (
            <li key={index}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-pressed={active === index}
                className={`w-full rounded px-3 py-3 text-left transition-colors ${
                  active === index ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <span className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-secondary">{finding.type}</span>
                  <span className="tabular-nums text-accent-ink">
                    L{finding.lines.join("–")}
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-snug text-foreground">{finding.text}</span>
                {"note" in finding && (
                  <span
                    className={`mt-1 block text-xs ${
                      "inferred" in finding ? "text-accent-ink" : "text-muted"
                    }`}
                  >
                    {finding.note}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
