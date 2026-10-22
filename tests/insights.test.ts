import { describe, expect, it } from "vitest";
import { buildOpenIssues, daysSince, type FindingRow } from "../src/lib/dashboard";
import { computeHealth, summarizeProject } from "../src/lib/health";
import { buildBrief, briefToMarkdown } from "../src/lib/brief";
import { buildDecisionLog } from "../src/lib/decisions";

// Phase 9 — health score, pre-meeting brief and decision log. All pure data
// shaping over finding rows; no database needed.

const TODAY = "2026-10-22";

function finding(overrides: Partial<FindingRow>): FindingRow {
  return {
    id: crypto.randomUUID(),
    finding_type: "blocker",
    description: "test finding",
    status: "open",
    decision_status: null,
    resolved_at: null,
    recurrence_group_id: crypto.randomUUID(),
    owner: null,
    due_date: null,
    meeting: { occurred_at: "2026-10-20T00:00:00Z", id: "m1", title: "Daily" },
    ...overrides,
  };
}

describe("daysSince", () => {
  it("counts whole UTC days between a timestamp and a date", () => {
    expect(daysSince("2026-10-08T15:00:00Z", TODAY)).toBe(14);
    expect(daysSince(null, TODAY)).toBeNull();
  });
});

describe("buildOpenIssues", () => {
  it("collapses a recurring group into one issue carrying its first-seen date", () => {
    const group = crypto.randomUUID();
    const issues = buildOpenIssues([
      finding({ recurrence_group_id: group, meeting: { occurred_at: "2026-10-01T00:00:00Z" } }),
      finding({
        recurrence_group_id: group,
        description: "latest wording",
        meeting: { occurred_at: "2026-10-15T00:00:00Z" },
      }),
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ occurrences: 2, firstSeen: "2026-10-01T00:00:00Z" });
    expect(issues[0].finding.description).toBe("latest wording");
  });

  it("drops groups with nothing open", () => {
    expect(buildOpenIssues([finding({ status: "resolved" })])).toEqual([]);
  });

  it("treats a decision as open only while its latest statement is pending", () => {
    const group = crypto.randomUUID();
    const issues = buildOpenIssues([
      finding({
        finding_type: "decision",
        decision_status: "pending",
        recurrence_group_id: group,
        meeting: { occurred_at: "2026-10-01T00:00:00Z" },
      }),
      finding({
        finding_type: "decision",
        decision_status: "taken",
        recurrence_group_id: group,
        meeting: { occurred_at: "2026-10-15T00:00:00Z" },
      }),
    ]);
    expect(issues).toEqual([]);
  });
});

describe("computeHealth", () => {
  it("is 100 and healthy with nothing open", () => {
    expect(computeHealth([], TODAY)).toEqual({ score: 100, level: "healthy", factors: [] });
  });

  it("stacks overdue/stale penalties on top of the issue's own and explains every point", () => {
    const health = computeHealth(
      [
        finding({
          finding_type: "blocker",
          due_date: "2026-10-01",
          meeting: { occurred_at: "2026-09-01T00:00:00Z" },
        }),
        finding({ finding_type: "decision", decision_status: "pending" }),
      ],
      TODAY
    );

    // blocker 12 + overdue 8 + stale 4 + pending decision 4 = 28
    expect(health.score).toBe(72);
    expect(health.level).toBe("watch");
    expect(health.factors.reduce((sum, f) => sum + f.penalty, 0)).toBe(28);
  });

  it("never goes below zero", () => {
    const many = Array.from({ length: 20 }, () => finding({ finding_type: "blocker" }));
    expect(computeHealth(many, TODAY)).toMatchObject({ score: 0, level: "critical" });
  });
});

describe("buildBrief", () => {
  it("lists each issue once, under its most urgent section", () => {
    const brief = buildBrief(
      [
        finding({ description: "late blocker", due_date: "2026-10-01" }),
        finding({ description: "fresh blocker" }),
        finding({ finding_type: "decision", decision_status: "pending", description: "pick a vendor" }),
        finding({ finding_type: "risk", status: "resolved" }),
      ],
      TODAY,
      null
    );

    expect(brief.sections.map((s) => s.key)).toEqual(["overdue", "blocker", "decision"]);
    expect(brief.sections[0].items[0].finding.description).toBe("late blocker");
    expect(brief.totalItems).toBe(3);
  });

  it("renders a checklist in Markdown with the last meeting's open questions", () => {
    const brief = buildBrief([finding({ description: "API keys expired", owner: "Bruno" })], TODAY, {
      title: "Retro",
      occurredAt: "2026-10-20T00:00:00Z",
      notes: [{ lens: "decision_gap", content: "Nobody owns the launch checklist." }],
    });
    const markdown = briefToMarkdown(brief, "Checkout", TODAY);

    expect(markdown).toContain("# Pre-meeting brief — Checkout");
    expect(markdown).toContain("- [ ] API keys expired _(open 2d · owner: Bruno)_");
    expect(markdown).toContain("**Decision gap:** Nobody owns the launch checklist.");
  });
});

describe("buildDecisionLog", () => {
  it("orders newest first, flags revisited decisions and attaches contradictions", () => {
    const group = crypto.randomUUID();
    const first = finding({
      finding_type: "decision",
      decision_status: "taken",
      recurrence_group_id: group,
      description: "Ship Friday",
      meeting: { occurred_at: "2026-10-01T00:00:00Z" },
    });
    const later = finding({
      finding_type: "decision",
      decision_status: "pending",
      recurrence_group_id: group,
      description: "Ship Friday?",
      meeting: { occurred_at: "2026-10-15T00:00:00Z" },
    });

    const log = buildDecisionLog(
      [first, later, finding({ finding_type: "blocker" })],
      [
        { lens: "contradiction", content: "QA said Friday is impossible.", related_finding_ids: [first.id] },
        { lens: "continuity", content: "ignored", related_finding_ids: [first.id] },
      ]
    );

    expect(log.map((d) => d.id)).toEqual([later.id, first.id]);
    expect(log[1]).toMatchObject({
      revisitedLater: true,
      occurrences: 2,
      contradictions: ["QA said Friday is impossible."],
    });
    expect(log[0].revisitedLater).toBe(false);
  });
});

describe("summarizeProject", () => {
  it("counts open issues and puts overdue, then blockers, first in the top list", () => {
    const summary = summarizeProject(
      [
        finding({ finding_type: "risk", description: "old risk", meeting: { occurred_at: "2026-09-01T00:00:00Z" } }),
        finding({ finding_type: "blocker", description: "blocker" }),
        finding({ finding_type: "dependency", description: "late dep", due_date: "2026-10-01" }),
        finding({ finding_type: "risk", description: "another risk" }),
      ],
      TODAY
    );

    expect(summary.counts).toEqual({ blocker: 1, risk: 2, dependency: 1, decision: 0, overdue: 1 });
    expect(summary.topIssues.map((i) => i.finding.description)).toEqual(["late dep", "blocker", "old risk"]);
  });
});
