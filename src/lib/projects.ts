import type { SupabaseClient } from "@supabase/supabase-js";

// Phase 9 — every project-aware page reads the current project from the
// `?project=<id>` search param, so a filtered view is a shareable/bookmarkable
// URL rather than hidden client state. No param (or an id that isn't one of
// this workspace's projects) means "all projects".

export type Project = { id: string; name: string; share_token: string | null };

export type ProjectScope = {
  projects: Project[];
  projectId: string | null;
  project: Project | null;
};

type SearchParams = { [key: string]: string | string[] | undefined };

export function projectParam(searchParams: SearchParams): string | null {
  const value = searchParams.project;
  return typeof value === "string" && value ? value : null;
}

export async function getProjectScope(
  supabase: SupabaseClient,
  workspaceId: string,
  requestedProjectId: string | null
): Promise<ProjectScope> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, share_token")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  const projects = (data ?? []) as Project[];
  // Validated against the workspace's own list (already RLS-filtered) rather
  // than passed straight into a query, so a stale or foreign id silently
  // falls back to "all projects" instead of an empty page.
  const project = projects.find((p) => p.id === requestedProjectId) ?? null;

  return { projects, projectId: project?.id ?? null, project };
}

// Appends ?project=<id> to an in-app href, preserving the current scope
// across navigation.
export function withProject(href: string, projectId: string | null): string {
  if (!projectId) return href;
  return `${href}${href.includes("?") ? "&" : "?"}project=${projectId}`;
}
