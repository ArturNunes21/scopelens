import { requireWorkspace } from "@/lib/workspace";
import { getProjectScope, projectParam } from "@/lib/projects";
import { NewMeetingForm } from "./new-meeting-form";

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { supabase, workspaceId } = await requireWorkspace();
  const { projects, projectId } = await getProjectScope(
    supabase,
    workspaceId,
    projectParam(await searchParams)
  );

  // Every workspace gets a default project on creation (migration
  // 20261022000000), so there is always at least one to preselect.
  return (
    <NewMeetingForm
      projects={projects}
      defaultProjectId={projectId ?? projects[0]?.id ?? ""}
    />
  );
}
