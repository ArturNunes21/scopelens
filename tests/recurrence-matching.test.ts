import "./load-env";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runExtractionPipeline } from "../src/lib/ai/pipeline";

// Phase 4 Definition of Done (ROADMAP.md): a set of synthetic meetings where
// the "same" blocker described differently is correctly grouped, and
// genuinely distinct blockers are not grouped by mistake (PRD.md 11.1: zero
// false positives on the synthetic test set is the hard bar).
//
// Runs against the linked remote Supabase project (no local Docker stack
// available in this environment) — creates disposable data and tears it
// down in `afterAll`. Service-role client only: recurrence matching is
// pipeline logic, not an RLS concern.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars — populate .env.local before running this test."
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Seed = {
  workspaceId: string;
  otherWorkspaceId: string;
  meeting1Id: string;
  meeting2Id: string;
};

async function seed(): Promise<Seed> {
  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .insert({ name: `recurrence-test-${randomUUID()}` })
    .select("id")
    .single();
  if (wsError || !workspace) throw wsError ?? new Error("Workspace insert failed");

  const { data: otherWorkspace, error: otherWsError } = await admin
    .from("workspaces")
    .insert({ name: `recurrence-test-other-${randomUUID()}` })
    .select("id")
    .single();
  if (otherWsError || !otherWorkspace)
    throw otherWsError ?? new Error("Other workspace insert failed");

  const { data: user } = await admin.auth.admin.listUsers({ perPage: 1 });
  const createdBy = user?.users?.[0]?.id;
  if (!createdBy) throw new Error("No auth user available to satisfy meetings.created_by");

  async function insertMeeting(workspaceId: string, title: string) {
    const { data: meeting, error } = await admin
      .from("meetings")
      .insert({
        workspace_id: workspaceId,
        title,
        meeting_type: "daily",
        source: "paste",
        transcript_raw: "seed transcript for recurrence-matching.test.ts",
        occurred_at: new Date().toISOString(),
        created_by: createdBy,
      })
      .select("id")
      .single();
    if (error || !meeting) throw error ?? new Error("Seed meeting insert failed");
    return meeting.id as string;
  }

  const meeting1Id = await insertMeeting(workspace.id, "Recurrence test — meeting 1 (seed)");
  const meeting2Id = await insertMeeting(workspace.id, "Recurrence test — meeting 2 (probe)");

  return {
    workspaceId: workspace.id,
    otherWorkspaceId: otherWorkspace.id,
    meeting1Id,
    meeting2Id,
  };
}

async function insertFinding(params: {
  workspaceId: string;
  meetingId: string;
  findingType: "blocker" | "risk" | "dependency" | "decision";
  description: string;
  status?: "open" | "resolved";
}) {
  const id = randomUUID();
  const { error } = await admin.from("findings").insert({
    id,
    workspace_id: params.workspaceId,
    meeting_id: params.meetingId,
    finding_type: params.findingType,
    description: params.description,
    owner: null,
    decision_status: params.findingType === "decision" ? "taken" : null,
    status: params.status ?? "open",
    recurrence_group_id: id,
  });
  if (error) throw error;
  return id;
}

async function matchRecurrence(
  workspaceId: string,
  findingType: string,
  description: string
): Promise<{ recurrence_group_id: string; similarity: number } | null> {
  const { data, error } = await admin.rpc("match_recurrence_finding", {
    p_workspace_id: workspaceId,
    p_finding_type: findingType,
    p_description: description,
    p_threshold: 0.25,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

async function matchFindingToResolve(
  workspaceId: string,
  findingType: string,
  description: string,
  excludeMeetingId: string
): Promise<{ finding_id: string; similarity: number } | null> {
  const { data, error } = await admin.rpc("match_finding_to_resolve", {
    p_workspace_id: workspaceId,
    p_finding_type: findingType,
    p_description: description,
    p_threshold: 0.25,
    p_exclude_meeting_id: excludeMeetingId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

describe("Recurrence matching (Phase 4)", () => {
  let s: Seed;

  beforeAll(async () => {
    s = await seed();
  }, 30000);

  afterAll(async () => {
    await admin.from("findings").delete().eq("workspace_id", s.workspaceId);
    await admin.from("meetings").delete().eq("workspace_id", s.workspaceId);
    await admin.from("workspaces").delete().eq("id", s.workspaceId);
    await admin.from("workspaces").delete().eq("id", s.otherWorkspaceId);
  });

  it("groups the same blocker when reworded", async () => {
    const seededId = await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting1Id,
      findingType: "blocker",
      description:
        "Auth service deploy is blocked on missing production secrets from the infra team",
    });

    const match = await matchRecurrence(
      s.workspaceId,
      "blocker",
      "We can't ship the auth service until infra gives us the prod secrets"
    );

    expect(match).not.toBeNull();
    expect(match!.recurrence_group_id).toBe(seededId);
  });

  it("does not group genuinely distinct blockers (zero false positives)", async () => {
    await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting1Id,
      findingType: "blocker",
      description: "CI pipeline is flaky and intermittently blocking merges to main",
    });
    await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting1Id,
      findingType: "blocker",
      description: "Checkout flow design review has not happened yet",
    });
    await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting1Id,
      findingType: "blocker",
      description: "Database migration is waiting on DBA approval",
    });

    const match = await matchRecurrence(
      s.workspaceId,
      "blocker",
      "The mobile app crashes on startup for users on iOS 17"
    );

    expect(match).toBeNull();
  });

  it("does not match against a resolved finding (starts a new group instead)", async () => {
    await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting1Id,
      findingType: "risk",
      description: "Data provider may delay delivery by two weeks",
      status: "resolved",
    });

    const match = await matchRecurrence(
      s.workspaceId,
      "risk",
      "Data provider might delay delivery by two weeks"
    );

    expect(match).toBeNull();
  });

  it("does not match across different finding types", async () => {
    const description = "Payments team has not exposed the new endpoint yet";
    await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting1Id,
      findingType: "risk",
      description,
    });

    const match = await matchRecurrence(s.workspaceId, "blocker", description);

    expect(match).toBeNull();
  });

  it("does not match across workspaces", async () => {
    const description = "Redis vs Postgres for the queue is still undecided";
    await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting1Id,
      findingType: "decision",
      description,
    });

    const match = await matchRecurrence(s.otherWorkspaceId, "decision", description);

    expect(match).toBeNull();
  });

  it(
    "wires recurrence matching into the real pipeline end-to-end",
    async () => {
      const seededId = await insertFinding({
        workspaceId: s.workspaceId,
        meetingId: s.meeting1Id,
        findingType: "blocker",
        description: "Payment gateway sandbox credentials have expired, blocking checkout tests",
      });

      const { data: meeting2, error } = await admin
        .from("meetings")
        .update({
          transcript_raw:
            "Dev1: our payment gateway sandbox credentials expired, so we can't test checkout right now.",
        })
        .eq("id", s.meeting2Id)
        .select("id")
        .single();
      if (error || !meeting2) throw error ?? new Error("Could not update probe meeting");

      await runExtractionPipeline(s.meeting2Id, s.workspaceId);

      const { data: findings, error: findingsError } = await admin
        .from("findings")
        .select("recurrence_group_id, finding_type")
        .eq("meeting_id", s.meeting2Id);
      if (findingsError) throw findingsError;

      const blocker = findings?.find((f) => f.finding_type === "blocker");
      expect(blocker).toBeDefined();
      expect(blocker!.recurrence_group_id).toBe(seededId);
    },
    30000
  );
});

// Phase 6 prerequisite: findings.status only ever moves to 'resolved' via the
// manual toggle or an explicit resolution mention in a later transcript
// (never inferred from an issue simply not recurring) — see
// src/lib/ai/extraction.ts's resolved_mentions and pipeline.ts's wiring.
describe("Resolution matching (Phase 6 prerequisite)", () => {
  let s: Seed;

  beforeAll(async () => {
    s = await seed();
  }, 30000);

  afterAll(async () => {
    await admin.from("findings").delete().eq("workspace_id", s.workspaceId);
    await admin.from("meetings").delete().eq("workspace_id", s.workspaceId);
    await admin.from("workspaces").delete().eq("id", s.workspaceId);
    await admin.from("workspaces").delete().eq("id", s.otherWorkspaceId);
  });

  it("matches an earlier meeting's open finding by type and description", async () => {
    const seededId = await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting1Id,
      findingType: "blocker",
      description: "CI runners are out of disk space, blocking all builds",
    });

    const match = await matchFindingToResolve(
      s.workspaceId,
      "blocker",
      "CI runners were out of disk space and blocking builds",
      s.meeting2Id
    );

    expect(match).not.toBeNull();
    expect(match!.finding_id).toBe(seededId);
  });

  it("excludes the mentioning meeting's own findings", async () => {
    const sameMeetingId = await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting2Id,
      findingType: "risk",
      description: "Third-party API rate limits may throttle the import job",
    });

    const match = await matchFindingToResolve(
      s.workspaceId,
      "risk",
      "Third-party API rate limits may throttle the import job",
      s.meeting2Id
    );

    expect(match).toBeNull();
    // Sanity check the row really exists (would match if not self-excluded).
    const selfMatch = await matchFindingToResolve(
      s.workspaceId,
      "risk",
      "Third-party API rate limits may throttle the import job",
      s.meeting1Id
    );
    expect(selfMatch!.finding_id).toBe(sameMeetingId);
  });

  it("does not match an already-resolved finding", async () => {
    await insertFinding({
      workspaceId: s.workspaceId,
      meetingId: s.meeting1Id,
      findingType: "dependency",
      description: "Waiting on the design team to hand off final mockups",
      status: "resolved",
    });

    const match = await matchFindingToResolve(
      s.workspaceId,
      "dependency",
      "Waiting on the design team to hand off final mockups",
      s.meeting2Id
    );

    expect(match).toBeNull();
  });

  it(
    "wires resolution detection into the real pipeline end-to-end",
    async () => {
      const seededId = await insertFinding({
        workspaceId: s.workspaceId,
        meetingId: s.meeting1Id,
        findingType: "blocker",
        description: "Staging database credentials rotated and broke every service's connection",
      });

      const { error } = await admin
        .from("meetings")
        .update({
          transcript_raw:
            "Dev1: quick update — the staging database credentials issue from last time is fully resolved now, all services reconnected fine.",
        })
        .eq("id", s.meeting2Id);
      if (error) throw error;

      await runExtractionPipeline(s.meeting2Id, s.workspaceId);

      const { data: finding, error: findingError } = await admin
        .from("findings")
        .select("status, resolved_at")
        .eq("id", seededId)
        .single();
      if (findingError) throw findingError;

      expect(finding!.status).toBe("resolved");
      expect(finding!.resolved_at).not.toBeNull();
    },
    30000
  );
});
