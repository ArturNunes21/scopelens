// Pure aggregation logic for the Phase 6 trend dashboard (ROADMAP.md: "open
// vs. resolved risks over time, grouped by meetings.occurred_at, aggregated
// by recurrence_group_id"). Split out from src/app/dashboard/page.tsx so it's
// unit-testable without a database — see tests/dashboard.test.ts.

// owner/due_date and the extra meeting fields are optional: the trend and
// recurrence aggregations below don't need them, while the Phase 9 health
// score / brief / decision log (src/lib/health.ts, brief.ts, decisions.ts)
// select them on top of the same row shape.
export type MeetingRef = { occurred_at: string; id?: string; title?: string; project_id?: string };

export type FindingRow = {
  id: string;
  finding_type: "blocker" | "risk" | "dependency" | "decision";
  description: string;
  status: "open" | "resolved";
  decision_status: "taken" | "pending" | null;
  resolved_at: string | null;
  recurrence_group_id: string;
  owner?: string | null;
  due_date?: string | null;
  meeting: MeetingRef | MeetingRef[] | null;
};

export type TrendPoint = { week: string; open: number; resolved: number };

export type RecurringGroup = {
  recurrenceGroupId: string;
  description: string;
  findingType: string;
  occurrences: number;
  anyOpen: boolean;
};

// Monday-anchored UTC week bucket — meetings/findings only carry a date, not
// a timezone-sensitive event, so UTC bucketing keeps this deterministic.
export function weekKey(iso: string): string {
  const d = new Date(iso);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
}

// PostgREST returns an embedded to-one relation as an object, but the
// untyped client can't know that and types it as possibly an array.
export function meetingOf(meeting: FindingRow["meeting"]): MeetingRef | null {
  if (!meeting) return null;
  return Array.isArray(meeting) ? (meeting[0] ?? null) : meeting;
}

export function occurredAt(meeting: FindingRow["meeting"]): string | null {
  return meetingOf(meeting)?.occurred_at ?? null;
}

export function buildOpenCounts(findings: FindingRow[]): {
  openCounts: Record<"blocker" | "risk" | "dependency", number>;
  pendingDecisions: number;
} {
  const openCounts = { blocker: 0, risk: 0, dependency: 0 };
  let pendingDecisions = 0;
  for (const f of findings) {
    if (f.finding_type === "decision") {
      if (f.decision_status === "pending") pendingDecisions += 1;
      continue;
    }
    if (f.status === "open") openCounts[f.finding_type] += 1;
  }
  return { openCounts, pendingDecisions };
}

// Decisions are excluded (like buildOpenCounts above) — their lifecycle is
// decision_status (taken/pending), not status, so status/resolved_at is
// never meaningfully set for them (see ARCHITECTURE.md 2.3 "Resolution").
// Counting them here would permanently inflate the "open" line with rows
// that can never move to "resolved".
export function buildTrend(findings: FindingRow[]): TrendPoint[] {
  const opened = new Map<string, number>();
  const resolved = new Map<string, number>();

  for (const f of findings) {
    if (f.finding_type === "decision") continue;
    const occurred = occurredAt(f.meeting);
    if (occurred) {
      const k = weekKey(occurred);
      opened.set(k, (opened.get(k) ?? 0) + 1);
    }
    if (f.resolved_at) {
      const k = weekKey(f.resolved_at);
      resolved.set(k, (resolved.get(k) ?? 0) + 1);
    }
  }

  const weeks = Array.from(new Set([...opened.keys(), ...resolved.keys()])).sort();

  let cumOpened = 0;
  let cumResolved = 0;
  return weeks.map((week) => {
    cumOpened += opened.get(week) ?? 0;
    cumResolved += resolved.get(week) ?? 0;
    return { week, open: Math.max(cumOpened - cumResolved, 0), resolved: cumResolved };
  });
}

// Unlike buildTrend, decisions are deliberately kept here: a decision that
// keeps getting re-raised across meetings is itself useful signal, even
// though its `anyOpen` badge is driven by `status` (which decisions never
// move off 'open' — see ARCHITECTURE.md 2.3) rather than `decision_status`.
// A recurring decision group will therefore always show "Open", which is an
// accepted simplification, not a bug: decision_status-aware badging is a
// bigger redesign than this pass covers.
export function buildRecurringGroups(findings: FindingRow[]): RecurringGroup[] {
  const groups = new Map<string, FindingRow[]>();
  for (const f of findings) {
    const list = groups.get(f.recurrence_group_id) ?? [];
    list.push(f);
    groups.set(f.recurrence_group_id, list);
  }

  return Array.from(groups.entries())
    .filter(([, members]) => members.length > 1)
    .map(([recurrenceGroupId, members]) => {
      const latest = members[members.length - 1];
      return {
        recurrenceGroupId,
        description: latest.description,
        findingType: latest.finding_type,
        occurrences: members.length,
        anyOpen: members.some((m) => m.status === "open"),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences);
}

// One entry per still-open ISSUE rather than per finding row (Phase 9): a
// blocker raised in three meetings is three open rows sharing one
// recurrence_group_id, but it's one problem. The entry carries the latest
// open restatement plus when the issue was first seen. Decisions count as
// open while the group's latest statement is still "pending" — a decision
// re-raised and finally taken closes it.
export type OpenIssue = {
  finding: FindingRow;
  occurrences: number;
  firstSeen: string | null;
};

export function buildOpenIssues(findings: FindingRow[]): OpenIssue[] {
  const groups = new Map<string, FindingRow[]>();
  for (const f of findings) {
    const list = groups.get(f.recurrence_group_id) ?? [];
    list.push(f);
    groups.set(f.recurrence_group_id, list);
  }

  const issues: OpenIssue[] = [];
  for (const members of groups.values()) {
    const ordered = [...members].sort((a, b) =>
      (occurredAt(a.meeting) ?? "").localeCompare(occurredAt(b.meeting) ?? "")
    );
    const latest = ordered[ordered.length - 1];
    let current: FindingRow | undefined;
    if (latest.finding_type === "decision") {
      if (latest.decision_status === "pending") current = latest;
    } else {
      current = [...ordered].reverse().find((m) => m.status === "open");
    }
    if (!current) continue;
    issues.push({
      finding: current,
      occurrences: members.length,
      firstSeen: occurredAt(ordered[0].meeting),
    });
  }

  return issues.sort((a, b) => (a.firstSeen ?? "").localeCompare(b.firstSeen ?? ""));
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function daysSince(iso: string | null, today: string): number | null {
  if (!iso) return null;
  const from = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10))
  );
  const to = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10))
  );
  return Math.round((to - from) / 86_400_000);
}

// due_date is a plain date column ("YYYY-MM-DD"), so string comparison is
// date comparison.
export function isOverdue(finding: FindingRow, today: string): boolean {
  return Boolean(finding.due_date && finding.due_date < today);
}
