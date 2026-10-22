import { meetingOf, occurredAt, type FindingRow, type MeetingRef } from "./dashboard";

// Phase 9 — decision log: every decision ever recorded, newest first, with
// the context that answers "didn't we already decide this?" — how many
// times it came up, whether a later meeting revisited it, and any
// contradiction the diagnosis stage flagged against it. Pure data shaping,
// no AI call.

export type DecisionNote = { lens: string; content: string; related_finding_ids: string[] | null };

export type DecisionEntry = {
  id: string;
  description: string;
  decisionStatus: "taken" | "pending";
  owner: string | null;
  dueDate: string | null;
  meeting: MeetingRef | null;
  occurrences: number;
  // A later meeting restated this same decision (same recurrence group).
  revisitedLater: boolean;
  contradictions: string[];
};

export function buildDecisionLog(findings: FindingRow[], notes: DecisionNote[]): DecisionEntry[] {
  const decisions = findings.filter((f) => f.finding_type === "decision");

  const groups = new Map<string, FindingRow[]>();
  for (const d of decisions) {
    const list = groups.get(d.recurrence_group_id) ?? [];
    list.push(d);
    groups.set(d.recurrence_group_id, list);
  }

  const contradictionsByFinding = new Map<string, string[]>();
  for (const note of notes) {
    if (note.lens !== "contradiction") continue;
    for (const id of note.related_finding_ids ?? []) {
      const list = contradictionsByFinding.get(id) ?? [];
      list.push(note.content);
      contradictionsByFinding.set(id, list);
    }
  }

  return decisions
    .map((d) => {
      const group = groups.get(d.recurrence_group_id) ?? [d];
      const at = occurredAt(d.meeting) ?? "";
      return {
        id: d.id,
        description: d.description,
        decisionStatus: d.decision_status === "taken" ? ("taken" as const) : ("pending" as const),
        owner: d.owner ?? null,
        dueDate: d.due_date ?? null,
        meeting: meetingOf(d.meeting),
        occurrences: group.length,
        revisitedLater: group.some((other) => (occurredAt(other.meeting) ?? "") > at),
        contradictions: contradictionsByFinding.get(d.id) ?? [],
      };
    })
    .sort((a, b) => (b.meeting?.occurred_at ?? "").localeCompare(a.meeting?.occurred_at ?? ""));
}
