// Pure aggregation logic for the Phase 6 trend dashboard (ROADMAP.md: "open
// vs. resolved risks over time, grouped by meetings.occurred_at, aggregated
// by recurrence_group_id"). Split out from src/app/dashboard/page.tsx so it's
// unit-testable without a database — see tests/dashboard.test.ts.

export type FindingRow = {
  id: string;
  finding_type: "blocker" | "risk" | "dependency" | "decision";
  description: string;
  status: "open" | "resolved";
  decision_status: "taken" | "pending" | null;
  resolved_at: string | null;
  recurrence_group_id: string;
  meeting: { occurred_at: string } | { occurred_at: string }[] | null;
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

export function occurredAt(meeting: FindingRow["meeting"]): string | null {
  if (!meeting) return null;
  return Array.isArray(meeting) ? (meeting[0]?.occurred_at ?? null) : meeting.occurred_at;
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

export function buildTrend(findings: FindingRow[]): TrendPoint[] {
  const opened = new Map<string, number>();
  const resolved = new Map<string, number>();

  for (const f of findings) {
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
