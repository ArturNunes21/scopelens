import { getEnvNumber } from "@/lib/env";

const DEFAULT_FREE_PLAN_MEETING_LIMIT = 5;

// Feature gate by plan (ROADMAP.md Phase 7): a meetings/month limit on the
// free plan. Placeholder ceiling, same spirit as the AI budget (GAPS.md G12)
// and transcript length cap (GAPS.md G17) — configurable, not tuned.
export function getFreePlanMeetingLimit(): number {
  return getEnvNumber("FREE_PLAN_MEETING_LIMIT", DEFAULT_FREE_PLAN_MEETING_LIMIT);
}

// Pure so it's unit-testable without a database (same pattern as
// src/lib/dashboard.ts) — the caller supplies the plan and this month's
// count, already queried workspace-scoped.
export function isOverFreePlanMeetingLimit(plan: string, meetingsThisMonth: number): boolean {
  if (plan !== "free") return false;
  return meetingsThisMonth >= getFreePlanMeetingLimit();
}

export function monthStartUtc(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}
