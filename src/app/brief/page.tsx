import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { getProjectScope, projectParam, withProject } from "@/lib/projects";
import { fetchScopedFindings } from "@/lib/findings-query";
import { meetingOf, todayUtc } from "@/lib/dashboard";
import { buildBrief, briefToMarkdown, describeIssue, LENS_LABEL } from "@/lib/brief";
import { AppShell } from "@/components/app-shell";
import { MarkdownExport } from "@/components/markdown-export";
import { buttonClass, EmptyState, ErrorText, Meta, PageHeader, SECTION_TITLE } from "@/components/ui";

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
    <AppShell active="/brief" projects={projects} projectId={projectId}>
      <PageHeader
        title="Pre-meeting brief"
        subtitle="Everything still open, ordered as the agenda for your next meeting."
        actions={
          <MarkdownExport
            markdown={markdown}
            filename={`brief-${scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${today}.md`}
          />
        }
      />

      {error && <ErrorText>Could not load the brief: {error.message}</ErrorText>}

      {!error && brief.totalItems === 0 && !brief.lastMeeting && (
        <EmptyState message="Nothing to prepare. There are no open issues or pending decisions.">
          <Link href={withProject("/meetings/new", projectId)} className={buttonClass("primary")}>
            New meeting
          </Link>
        </EmptyState>
      )}

      {!error && (brief.totalItems > 0 || brief.lastMeeting) && (
        <div className="flex flex-col gap-12">
          {brief.sections.length > 0 && (
            <ol className="flex flex-col gap-10">
              {brief.sections.map((section, index) => (
                <li key={section.key} className="grid gap-x-6 sm:grid-cols-[2rem_1fr]">
                  <span
                    aria-hidden
                    className={`font-display text-2xl tabular-nums ${
                      section.key === "overdue" ? "text-accent-ink" : "text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <section aria-labelledby={`brief-${section.key}`}>
                    <h2 id={`brief-${section.key}`} className={`${SECTION_TITLE} flex items-baseline gap-2`}>
                      {section.title}
                      <span className="text-xs font-normal tabular-nums text-muted">
                        {section.items.length}
                      </span>
                    </h2>
                    <ul className="mt-2 border-t border-border">
                      {section.items.map((issue) => {
                        const meeting = meetingOf(issue.finding.meeting);
                        return (
                          <li key={issue.finding.id} className="border-b border-border py-3 text-sm">
                            <p className="text-foreground">{issue.finding.description}</p>
                            <Meta className="mt-1">
                              <span>{describeIssue(issue, today)}</span>
                              {meeting?.id && (
                                <Link
                                  href={`/meetings/${meeting.id}`}
                                  className="underline decoration-border underline-offset-2 hover:text-foreground"
                                >
                                  {meeting.title}
                                </Link>
                              )}
                            </Meta>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </li>
              ))}
            </ol>
          )}

          {brief.sections.length === 0 && (
            <p className="text-sm text-secondary">
              No open blockers, risks, dependencies, or pending decisions.
            </p>
          )}

          {brief.lastMeeting && brief.lastMeeting.notes.length > 0 && (
            <section aria-labelledby="left-open-title" className="rounded-lg border border-border bg-surface p-5">
              <h2 id="left-open-title" className={SECTION_TITLE}>
                Left open by &ldquo;{brief.lastMeeting.title}&rdquo;
              </h2>
              <dl className="mt-3 flex flex-col gap-4">
                {brief.lastMeeting.notes.map((note, index) => (
                  <div key={index}>
                    <dt className="text-xs font-medium text-muted">{LENS_LABEL[note.lens] ?? note.lens}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-secondary">{note.content}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
