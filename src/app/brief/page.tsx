import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { getProjectScope, projectParam, withProject } from "@/lib/projects";
import { fetchScopedFindings } from "@/lib/findings-query";
import { meetingOf, todayUtc } from "@/lib/dashboard";
import { buildBrief, briefToMarkdown, describeIssue, LENS_LABEL } from "@/lib/brief";
import { ProjectSwitcher } from "@/components/project-switcher";
import { MarkdownExport } from "@/components/markdown-export";
import { AppHeader, Badge, CARD, EmptyState, ErrorText } from "@/components/ui";

// Phase 9 — pre-meeting brief: the agenda for the NEXT meeting, built from
// everything still open. No AI call — it's a view over existing data.
export default async function BriefPage({
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

  let lastMeetingQuery = supabase
    .from("meetings")
    .select("id, title, occurred_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "completed");
  if (projectId) lastMeetingQuery = lastMeetingQuery.eq("project_id", projectId);

  const [{ findings, error }, { data: lastMeetingRow }] = await Promise.all([
    fetchScopedFindings(supabase, workspaceId, projectId),
    lastMeetingQuery.order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  let lastMeeting = null;
  if (lastMeetingRow) {
    const { data: notes } = await supabase
      .from("diagnostic_notes")
      .select("lens, content")
      .eq("meeting_id", lastMeetingRow.id)
      .order("created_at", { ascending: true });
    lastMeeting = {
      title: lastMeetingRow.title as string,
      occurredAt: lastMeetingRow.occurred_at as string,
      notes: notes ?? [],
    };
  }

  const today = todayUtc();
  const brief = buildBrief(findings, today, lastMeeting);
  const scopeName = project?.name ?? "All projects";
  const markdown = briefToMarkdown(brief, scopeName, today);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <AppHeader
          title="Pre-meeting brief"
          subtitle="Everything still open, ordered as an agenda for your next meeting"
          active={null}
          projectId={projectId}
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <ProjectSwitcher projects={projects} projectId={projectId} />
          <MarkdownExport
            markdown={markdown}
            filename={`brief-${scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${today}.md`}
          />
        </div>

        {error && <ErrorText>Could not load the brief: {error.message}</ErrorText>}

        {!error && brief.totalItems === 0 && !brief.lastMeeting && (
          <div className="mt-8">
            <EmptyState message="Nothing to prepare — no open issues or pending decisions.">
              <Link
                href={withProject("/meetings/new", projectId)}
                className="text-sm font-medium text-foreground underline underline-offset-4"
              >
                New meeting
              </Link>
            </EmptyState>
          </div>
        )}

        {!error && (brief.totalItems > 0 || brief.lastMeeting) && (
          <div className="mt-6 flex flex-col gap-6">
            {brief.sections.map((section) => (
              <section key={section.key} className={CARD}>
                <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {section.title}
                  <Badge tone={section.key === "overdue" ? "critical" : "neutral"}>
                    {section.items.length}
                  </Badge>
                </h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {section.items.map((issue) => {
                    const meeting = meetingOf(issue.finding.meeting);
                    return (
                      <li key={issue.finding.id} className="text-sm">
                        <p className="text-foreground">{issue.finding.description}</p>
                        <p className="mt-0.5 text-xs text-secondary">
                          {describeIssue(issue, today)}
                          {meeting?.id && (
                            <>
                              {" · "}
                              <Link
                                href={`/meetings/${meeting.id}`}
                                className="underline underline-offset-2 hover:text-foreground"
                              >
                                {meeting.title}
                              </Link>
                            </>
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {brief.sections.length === 0 && (
              <p className="text-sm text-secondary">
                No open blockers, risks, dependencies, or pending decisions.
              </p>
            )}

            {brief.lastMeeting && brief.lastMeeting.notes.length > 0 && (
              <section className={CARD}>
                <h2 className="text-sm font-medium text-foreground">
                  Left open by &ldquo;{brief.lastMeeting.title}&rdquo;
                </h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {brief.lastMeeting.notes.map((note, index) => (
                    <li key={index}>
                      <Badge tone="neutral">{LENS_LABEL[note.lens] ?? note.lens}</Badge>
                      <p className="mt-1.5 text-sm text-secondary">{note.content}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
