"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";

// Phase 9 — project management. Every write is scoped by workspace_id on top
// of RLS, same pattern as the meetings actions.

export type ProjectFormState = { error: string | null };

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { error: "Project name is required." };
  }
  if (name.trim().length > 80) {
    return { error: "Keep the name under 80 characters." };
  }

  const { supabase, workspaceId } = await requireWorkspace();
  const { error } = await supabase
    .from("projects")
    .insert({ workspace_id: workspaceId, name: name.trim() });
  if (error) return { error: "Could not create the project." };

  revalidatePath("/projects");
  return { error: null };
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) return;

  const { supabase, workspaceId } = await requireWorkspace();
  await supabase
    .from("projects")
    .update({ name: trimmed })
    .eq("id", projectId)
    .eq("workspace_id", workspaceId);

  revalidatePath("/projects");
}

// Only an EMPTY project can be deleted (the meetings FK enforces this too),
// and never the workspace's last one — a meeting always needs somewhere to
// go. Deleting a project never deletes analyzed meetings by accident.
export async function deleteProject(projectId: string): Promise<void> {
  const { supabase, workspaceId } = await requireWorkspace();

  const [{ count: projectCount }, { count: meetingCount }] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId),
  ]);
  if ((projectCount ?? 0) <= 1 || (meetingCount ?? 0) > 0) return;

  await supabase.from("projects").delete().eq("id", projectId).eq("workspace_id", workspaceId);
  revalidatePath("/projects");
}

// Turning sharing on mints a fresh random token; turning it off clears it.
// Re-enabling therefore always produces a NEW link, which is how an old,
// leaked link gets revoked.
export async function setProjectSharing(projectId: string, enabled: boolean): Promise<void> {
  const { supabase, workspaceId } = await requireWorkspace();
  await supabase
    .from("projects")
    .update({ share_token: enabled ? crypto.randomUUID() : null })
    .eq("id", projectId)
    .eq("workspace_id", workspaceId);

  revalidatePath("/projects");
}
