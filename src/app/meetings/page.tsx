import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { seedDemoData } from "./actions";
import { STATUS_LABEL, STATUS_TONE } from "./status";
import { AppHeader, Badge, buttonClass, EmptyState, ErrorText } from "@/components/ui";
import { ProjectSwitcher } from "@/components/project-switcher";
import { getProjectScope, projectParam, withProject } from "@/lib/projects";

export default async function MeetingsPage({
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
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  let query = supabase
    .from("meetings")
    .select("id, title, meeting_type, status, occurred_at, project_id")
    .eq("workspace_id", workspaceId);
  if (projectId) query = query.eq("project_id", projectId);
  const { data: meetings, error } = await query.order("occurred_at", { ascending: false });

  // The sample-data button only makes sense in a brand-new workspace; a
  // filtered project being empty doesn't mean the workspace is.
  const workspaceIsEmpty = !projectId && meetings?.length === 0;

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <AppHeader
          title="Meetings"
          active="/meetings"
          projectId={projectId}
          actions={
            <Link href={withProject("/meetings/new", projectId)} className={buttonClass("primary")}>
              New meeting
            </Link>
          }
        />

        <div className="mt-6">
          <ProjectSwitcher projects={projects} projectId={projectId} />
        </div>

        <div className="mt-6">
          {error && <ErrorText>Could not load meetings: {error.message}</ErrorText>}

          {!error && meetings && meetings.length === 0 && (
            <EmptyState
              message={
                workspaceIsEmpty
                  ? "No meetings yet — paste or upload a transcript to get started."
                  : "No meetings in this project yet."
              }
            >
              <Link
                href={withProject("/meetings/new", projectId)}
                className="text-sm font-medium text-foreground underline underline-offset-4"
              >
                New meeting
              </Link>
              {workspaceIsEmpty && (
                <>
                  <span className="text-sm text-muted">or</span>
                  <form action={seedDemoData}>
                    <button
                      type="submit"
                      className="text-sm font-medium text-foreground underline underline-offset-4"
                    >
                      Load sample data
                    </button>
                  </form>
                </>
              )}
            </EmptyState>
          )}

          {!error && meetings && meetings.length > 0 && (
            <ul className="flex flex-col gap-2">
              {meetings.map((meeting) => (
                <li key={meeting.id}>
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                      <p className="mt-0.5 text-xs text-secondary">
                        {!projectId && projectName.get(meeting.project_id) && (
                          <>{projectName.get(meeting.project_id)} · </>
                        )}
                        {meeting.meeting_type} ·{" "}
                        {new Date(meeting.occurred_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[meeting.status] ?? STATUS_TONE.pending}>
                      {STATUS_LABEL[meeting.status] ?? meeting.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
