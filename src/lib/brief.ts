import {
  buildOpenIssues,
  daysSince,
  isOverdue,
  meetingOf,
  type FindingRow,
  type OpenIssue,
} from "./dashboard";

// Phase 9 — pre-meeting brief: turns the backlog of open issues into the
// agenda for the NEXT meeting. Assembled from data already in the database
// (no AI call), and exportable as Markdown to paste into Slack/email/a doc.

export type BriefNote = { lens: string; content: string };

export type BriefSection = { key: string; title: string; items: OpenIssue[] };

export type Brief = {
  sections: BriefSection[];
  // Diagnostic notes from the most recent analyzed meeting — the questions
  // the last meeting left unanswered.
  lastMeeting: { title: string; occurredAt: string; notes: BriefNote[] } | null;
  totalItems: number;
};

const LENS_LABEL: Record<string, string> = {
  contradiction: "Contradiction",
  continuity: "Continuity",
  decision_gap: "Decision gap",
};

export function buildBrief(
  findings: FindingRow[],
  today: string,
  lastMeeting: Brief["lastMeeting"]
): Brief {
  const issues = buildOpenIssues(findings);

  // Each issue is listed once, under the most urgent section it qualifies for.
  const overdue = issues.filter((i) => isOverdue(i.finding, today));
  const rest = issues.filter((i) => !isOverdue(i.finding, today));
  const ofType = (type: FindingRow["finding_type"]) =>
    rest.filter((i) => i.finding.finding_type === type);

  const sections: BriefSection[] = [
    { key: "overdue", title: "Overdue", items: overdue },
    { key: "blocker", title: "Blockers to unblock", items: ofType("blocker") },
    { key: "decision", title: "Decisions to make", items: ofType("decision") },
    { key: "dependency", title: "Dependencies to chase", items: ofType("dependency") },
    { key: "risk", title: "Risks to review", items: ofType("risk") },
  ].filter((section) => section.items.length > 0);

  return { sections, lastMeeting, totalItems: issues.length };
}

export function describeIssue(issue: OpenIssue, today: string): string {
  const parts: string[] = [];
  const age = daysSince(issue.firstSeen, today);
  if (age !== null && age > 0) parts.push(`open ${age}d`);
  if (issue.occurrences > 1) parts.push(`raised ${issue.occurrences}×`);
  if (issue.finding.owner) parts.push(`owner: ${issue.finding.owner}`);
  else if (issue.finding.finding_type !== "decision") parts.push("no owner");
  if (issue.finding.due_date) parts.push(`due ${issue.finding.due_date}`);
  return parts.join(" · ");
}

export function briefToMarkdown(brief: Brief, projectName: string, today: string): string {
  const lines: string[] = [`# Pre-meeting brief — ${projectName}`, "", `_${today}_`, ""];

  if (brief.sections.length === 0) {
    lines.push("Nothing open — no blockers, risks, dependencies, or pending decisions.", "");
  }

  for (const section of brief.sections) {
    lines.push(`## ${section.title} (${section.items.length})`, "");
    for (const issue of section.items) {
      const meta = describeIssue(issue, today);
      const meeting = meetingOf(issue.finding.meeting);
      const source = meeting?.title ? ` — from "${meeting.title}"` : "";
      lines.push(`- [ ] ${issue.finding.description}${meta ? ` _(${meta})_` : ""}${source}`);
    }
    lines.push("");
  }

  if (brief.lastMeeting && brief.lastMeeting.notes.length > 0) {
    lines.push(`## Left open by "${brief.lastMeeting.title}"`, "");
    for (const note of brief.lastMeeting.notes) {
      lines.push(`- **${LENS_LABEL[note.lens] ?? note.lens}:** ${note.content}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export { LENS_LABEL };
