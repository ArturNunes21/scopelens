import { buildOpenIssues, daysSince, isOverdue, type FindingRow } from "./dashboard";

// Phase 9 — one number answering "how is this project doing?". Deliberately
// a transparent, rule-based score (no AI call): every point lost is listed
// as a factor, so the number can always be explained on screen.

export type HealthLevel = "healthy" | "watch" | "at_risk" | "critical";

export type HealthFactor = { key: string; label: string; count: number; penalty: number };

export type Health = { score: number; level: HealthLevel; factors: HealthFactor[] };

// Points lost per open issue. Blockers dominate because they are stopping
// work right now; the "overdue", "recurring" and "stale" penalties stack on
// top of the issue's own, since each makes the same issue worse.
const PENALTY = {
  blocker: 12,
  risk: 5,
  dependency: 4,
  pendingDecision: 4,
  overdue: 8,
  recurring: 6,
  stale: 4,
} as const;

// An issue still open this many days after it was first raised is "stale".
export const STALE_AFTER_DAYS = 14;

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At risk",
  critical: "Critical",
};

export const HEALTH_TONE: Record<HealthLevel, "good" | "warning" | "serious" | "critical"> = {
  healthy: "good",
  watch: "warning",
  at_risk: "serious",
  critical: "critical",
};

function levelFor(score: number): HealthLevel {
  if (score >= 75) return "healthy";
  if (score >= 50) return "watch";
  if (score >= 25) return "at_risk";
  return "critical";
}

export function computeHealth(findings: FindingRow[], today: string): Health {
  const issues = buildOpenIssues(findings);

  const counts = {
    blocker: 0,
    risk: 0,
    dependency: 0,
    pendingDecision: 0,
    overdue: 0,
    recurring: 0,
    stale: 0,
  };
  for (const { finding, occurrences, firstSeen } of issues) {
    if (finding.finding_type === "decision") counts.pendingDecision += 1;
    else counts[finding.finding_type] += 1;
    if (isOverdue(finding, today)) counts.overdue += 1;
    if (occurrences > 1) counts.recurring += 1;
    const age = daysSince(firstSeen, today);
    if (finding.finding_type !== "decision" && age !== null && age > STALE_AFTER_DAYS) {
      counts.stale += 1;
    }
  }

  const labels: Record<keyof typeof counts, string> = {
    blocker: "Open blockers",
    risk: "Open risks",
    dependency: "Open dependencies",
    pendingDecision: "Pending decisions",
    overdue: "Past their due date",
    recurring: "Raised in more than one meeting",
    stale: `Open for over ${STALE_AFTER_DAYS} days`,
  };

  const factors = (Object.keys(counts) as (keyof typeof counts)[])
    .filter((key) => counts[key] > 0)
    .map((key) => ({
      key,
      label: labels[key],
      count: counts[key],
      penalty: counts[key] * PENALTY[key],
    }))
    .sort((a, b) => b.penalty - a.penalty);

  const score = Math.max(0, 100 - factors.reduce((sum, f) => sum + f.penalty, 0));
  return { score, level: levelFor(score), factors };
}
