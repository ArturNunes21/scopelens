import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { seedDemoData } from "./actions";
import { STATUS_LABEL, STATUS_TONE } from "./status";
import { Badge, buttonClass, EmptyState, ErrorText, PageHeader } from "@/components/ui";
import { AppShell } from "@/components/app-shell";
import { getProjectScope, projectParam, withProject } from "@/lib/projects";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { supabase, workspaceId } = await requireWorkspace();
  const { projects, projectId, project } = await getProjectScope(
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
    <AppShell active="/meetings" projects={projects} projectId={projectId}>
      <PageHeader
        title="Meetings"
        subtitle={project ? `Every analyzed meeting in ${project.name}.` : "Every analyzed meeting, newest first."}
      />

      {error && <ErrorText>Could not load meetings: {error.message}</ErrorText>}

      {!error && meetings && meetings.length === 0 && (
        <EmptyState
          message={
            workspaceIsEmpty
              ? "No meetings yet. Paste a transcript to get your first analysis, or load a sample project to look around."
              : "No meetings in this project yet."
          }
        >
          <Link href={withProject("/meetings/new", projectId)} className={buttonClass("primary")}>
            New meeting
          </Link>
          {workspaceIsEmpty && (
            <form action={seedDemoData}>
              <button type="submit" className={buttonClass("secondary")}>
                Load sample data
              </button>
            </form>
          )}
        </EmptyState>
      )}

      {!error && meetings && meetings.length > 0 && (
        <ul className="border-t border-border">
          {meetings.map((meeting) => (
            <li key={meeting.id} className="border-b border-border">
              <Link
                href={`/meetings/${meeting.id}`}
                className="group -mx-3 flex items-center gap-4 rounded px-3 py-4 transition-colors hover:bg-surface"
              >
                <time
                  dateTime={meeting.occurred_at}
                  className="w-14 shrink-0 text-xs tabular-nums text-muted"
                >
                  {new Date(meeting.occurred_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{meeting.title}</p>
                  <p className="mt-0.5 flex gap-3 text-xs text-secondary capitalize">
                    <span>{meeting.meeting_type}</span>
                    {!projectId && projectName.get(meeting.project_id) && (
                      <span className="normal-case text-muted">{projectName.get(meeting.project_id)}</span>
                    )}
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
    </AppShell>
  );
}
