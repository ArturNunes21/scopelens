import { describe, expect, it } from "vitest";
import {
  buildOpenCounts,
  buildRecurringGroups,
  buildTrend,
  weekKey,
  type FindingRow,
} from "../src/lib/dashboard";

// Pure aggregation logic for the Phase 6 trend dashboard (ROADMAP.md: "open
// vs. resolved risks over time, grouped by meetings.occurred_at, aggregated
// by recurrence_group_id"). No database needed — unlike
// tests/recurrence-matching.test.ts, this is plain data transformation.

function finding(overrides: Partial<FindingRow>): FindingRow {
  return {
    id: crypto.randomUUID(),
    finding_type: "blocker",
    description: "test finding",
    status: "open",
    decision_status: null,
    resolved_at: null,
    recurrence_group_id: crypto.randomUUID(),
    meeting: { occurred_at: "2026-09-01T00:00:00Z" },
    ...overrides,
  };
}

describe("weekKey", () => {
  it("anchors to the Monday of the containing week", () => {
    // 2026-09-16 is a Wednesday; its Monday is 2026-09-14.
    expect(weekKey("2026-09-16T12:00:00Z")).toBe("2026-09-14");
    // A Monday maps to itself.
    expect(weekKey("2026-09-14T00:00:00Z")).toBe("2026-09-14");
  });
});

describe("buildOpenCounts", () => {
  it("counts open findings by type and pending decisions separately", () => {
    const findings = [
      finding({ finding_type: "blocker", status: "open" }),
      finding({ finding_type: "blocker", status: "resolved" }),
      finding({ finding_type: "risk", status: "open" }),
      finding({ finding_type: "dependency", status: "open" }),
      finding({ finding_type: "decision", decision_status: "pending" }),
      finding({ finding_type: "decision", decision_status: "taken" }),
    ];

    const { openCounts, pendingDecisions } = buildOpenCounts(findings);

    expect(openCounts).toEqual({ blocker: 1, risk: 1, dependency: 1 });
    expect(pendingDecisions).toBe(1);
  });
});

describe("buildTrend", () => {
  it("produces monotonically non-decreasing resolved counts and clamps open at zero", () => {
    const findings = [
      finding({ meeting: { occurred_at: "2026-08-24T00:00:00Z" } }), // week of 2026-08-24
      finding({ meeting: { occurred_at: "2026-08-25T00:00:00Z" } }), // same week
      finding({
        meeting: { occurred_at: "2026-08-24T00:00:00Z" },
        resolved_at: "2026-09-14T00:00:00Z", // resolved in a later week
      }),
    ];

    const trend = buildTrend(findings);

    expect(trend).toEqual([
      { week: "2026-08-24", open: 3, resolved: 0 },
      { week: "2026-09-14", open: 2, resolved: 1 },
    ]);
  });

  it("ignores findings with no joined meeting and no resolution", () => {
    const findings = [finding({ meeting: null })];
    expect(buildTrend(findings)).toEqual([]);
  });
});

describe("buildRecurringGroups", () => {
  it("only surfaces groups with more than one occurrence, sorted by count desc", () => {
    const groupA = crypto.randomUUID();
    const groupB = crypto.randomUUID();
    const singleton = crypto.randomUUID();

    const findings = [
      finding({ recurrence_group_id: groupA, description: "A v1" }),
      finding({ recurrence_group_id: groupA, description: "A v2 (latest)" }),
      finding({ recurrence_group_id: groupB, description: "B v1" }),
      finding({ recurrence_group_id: groupB, description: "B v2" }),
      finding({ recurrence_group_id: groupB, description: "B v3 (latest)" }),
      finding({ recurrence_group_id: singleton, description: "only once" }),
    ];

    const groups = buildRecurringGroups(findings);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      recurrenceGroupId: groupB,
      occurrences: 3,
      description: "B v3 (latest)",
    });
    expect(groups[1]).toMatchObject({
      recurrenceGroupId: groupA,
      occurrences: 2,
      description: "A v2 (latest)",
    });
  });

  it("marks a group open if any member is still open, even if the latest is resolved", () => {
    const groupId = crypto.randomUUID();
    const findings = [
      finding({ recurrence_group_id: groupId, status: "open" }),
      finding({ recurrence_group_id: groupId, status: "resolved" }),
    ];

    const [group] = buildRecurringGroups(findings);
    expect(group.anyOpen).toBe(true);
  });

  it("marks a group resolved only when every member is resolved", () => {
    const groupId = crypto.randomUUID();
    const findings = [
      finding({ recurrence_group_id: groupId, status: "resolved" }),
      finding({ recurrence_group_id: groupId, status: "resolved" }),
    ];

    const [group] = buildRecurringGroups(findings);
    expect(group.anyOpen).toBe(false);
  });
});
