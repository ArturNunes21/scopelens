import "./load-env";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Phase 1 Definition of Done (ROADMAP.md): an automated test that creates two
// workspaces with different users and confirms one user cannot read the
// other workspace's data via a direct query.
//
// Runs against the linked remote Supabase project (no local Docker stack
// available in this environment) — creates disposable users/data and tears
// them down in `afterAll`.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars — populate .env.local before running this test."
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TestUser = {
  userId: string;
  email: string;
  password: string;
  workspaceId: string;
  accessToken: string;
};

async function createTestUser(): Promise<TestUser> {
  const email = `rls-test-${randomUUID()}@example.com`;
  const password = randomUUID();

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (createError || !created.user) {
    throw createError ?? new Error("User creation returned no user");
  }

  // The on_auth_user_created trigger provisions the workspace asynchronously
  // relative to this call returning — poll briefly for it to land.
  let workspaceId: string | null = null;
  for (let attempt = 0; attempt < 10 && !workspaceId; attempt++) {
    const { data: membership } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", created.user.id)
      .maybeSingle();
    workspaceId = membership?.workspace_id ?? null;
    if (!workspaceId) await new Promise((r) => setTimeout(r, 300));
  }
  if (!workspaceId) {
    throw new Error("workspace_members row was not created by the trigger in time");
  }

  const { data: signedIn, error: signInError } = await createClient(
    supabaseUrl,
    anonKey
  ).auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.session) {
    throw signInError ?? new Error("Sign-in returned no session");
  }

  return {
    userId: created.user.id,
    email,
    password,
    workspaceId,
    accessToken: signedIn.session.access_token,
  };
}

function clientAs(user: TestUser) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${user.accessToken}` } },
  });
}

async function deleteTestUser(user: TestUser) {
  await admin.from("meetings").delete().eq("workspace_id", user.workspaceId);
  await admin.from("workspaces").delete().eq("id", user.workspaceId);
  await admin.auth.admin.deleteUser(user.userId);
}

describe("RLS cross-tenant isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let meetingBId: string;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser(), createTestUser()]);

    const { data: meeting, error } = await admin
      .from("meetings")
      .insert({
        workspace_id: userB.workspaceId,
        title: "Workspace B private meeting",
        meeting_type: "daily",
        source: "paste",
        transcript_raw: "confidential content only workspace B should see",
        occurred_at: new Date().toISOString(),
        created_by: userB.userId,
      })
      .select("id")
      .single();
    if (error || !meeting) throw error ?? new Error("Seed meeting insert failed");
    meetingBId = meeting.id;
  }, 30000);

  afterAll(async () => {
    await Promise.all([deleteTestUser(userA), deleteTestUser(userB)]);
  });

  it("lets user B read their own workspace's meeting", async () => {
    const { data, error } = await clientAs(userB)
      .from("meetings")
      .select("id")
      .eq("id", meetingBId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("blocks user A from reading user B's meeting by id", async () => {
    const { data, error } = await clientAs(userA)
      .from("meetings")
      .select("id")
      .eq("id", meetingBId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("blocks user A from listing user B's workspace row", async () => {
    const { data, error } = await clientAs(userA)
      .from("workspaces")
      .select("id")
      .eq("id", userB.workspaceId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("blocks user A from inserting a meeting into user B's workspace", async () => {
    const { error } = await clientAs(userA).from("meetings").insert({
      workspace_id: userB.workspaceId,
      title: "Attempted cross-tenant write",
      meeting_type: "daily",
      source: "paste",
      transcript_raw: "should be rejected",
      occurred_at: new Date().toISOString(),
      created_by: userA.userId,
    });

    expect(error).not.toBeNull();
  });
});
