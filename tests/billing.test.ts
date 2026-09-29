import { afterEach, describe, expect, it, vi } from "vitest";
import { getFreePlanMeetingLimit, isOverFreePlanMeetingLimit, monthStartUtc } from "../src/lib/billing";

// Pure feature-gate logic for the Phase 7 billing gate (ROADMAP.md: "a
// meetings/month limit on the free plan"). No database needed — same
// pattern as tests/dashboard.test.ts.

afterEach(() => {
  delete process.env.FREE_PLAN_MEETING_LIMIT;
  vi.useRealTimers();
});

describe("isOverFreePlanMeetingLimit", () => {
  it("never gates a pro-plan workspace, regardless of count", () => {
    expect(isOverFreePlanMeetingLimit("pro", 0)).toBe(false);
    expect(isOverFreePlanMeetingLimit("pro", 10_000)).toBe(false);
  });

  it("gates a free-plan workspace once it reaches the limit", () => {
    process.env.FREE_PLAN_MEETING_LIMIT = "5";
    expect(isOverFreePlanMeetingLimit("free", 4)).toBe(false);
    expect(isOverFreePlanMeetingLimit("free", 5)).toBe(true);
    expect(isOverFreePlanMeetingLimit("free", 6)).toBe(true);
  });

  it("falls back to the default limit when the env var is unset/invalid", () => {
    expect(getFreePlanMeetingLimit()).toBe(5);
    process.env.FREE_PLAN_MEETING_LIMIT = "not-a-number";
    expect(getFreePlanMeetingLimit()).toBe(5);
  });
});

describe("monthStartUtc", () => {
  it("anchors to the first instant of the UTC calendar month", () => {
    const start = monthStartUtc(new Date("2026-09-18T15:42:00Z"));
    expect(start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
