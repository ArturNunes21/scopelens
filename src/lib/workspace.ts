import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every signed-in user belongs to exactly one workspace in the MVP
// (ARCHITECTURE.md 2.1 — single-owner, no invite flow).
export async function requireWorkspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .single();

  if (error || !membership) redirect("/login");

  return { supabase, user, workspaceId: membership.workspace_id as string };
}
