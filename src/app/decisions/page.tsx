import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { getProjectScope, projectParam, withProject } from "@/lib/projects";
import { fetchScopedFindings } from "@/lib/findings-query";
import { buildDecisionLog, type DecisionNote } from "@/lib/decisions";
import { todayUtc } from "@/lib/dashboard";
import { AppShell } from "@/components/app-shell";
import { DecisionStatusToggle } from "@/components/decision-status-toggle";
import { Badge, EmptyState, ErrorText, Meta, PageHeader } from "@/components/ui";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "taken", label: "Decided" },
] as const;

// Phase 9 — decision log: every decision across meetings, newest first,
// answering "didn't we already decide this?".
export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const { supabase, workspaceId } = await requireWorkspace();
  const { projects, projectId } = await getProjectScope(supabase, workspaceId, projectParam(params));
  const filter = FILTERS.find((f) => f.key === params.status)?.key ?? "all";

  let notesQuery = supabase
    .from("diagnostic_notes")
    .select("lens, content, related_finding_ids, meeting:meetings!inner(project_id)")
    .eq("workspace_id", workspaceId)
    .eq("lens", "contradiction");
  if (projectId) notesQuery = notesQuery.eq("meeting.project_id", projectId);

  const [{ findings, error }, { data: notes }] = await Promise.all([
    fetchScopedFindings(supabase, workspaceId, projectId),
    notesQuery,
  ]);

  const log = buildDecisionLog(findings, (notes ?? []) as DecisionNote[]);
  const visible = filter === "all" ? log : log.filter((d) => d.decisionStatus === filter);
  const today = todayUtc();

  const filterHref = (key: string) =>
    withProject(key === "all" ? "/decisions" : `/decisions?status=${key}`, projectId);

  return (
    <AppShell active="/decisions" projects={projects} projectId={projectId}>
      <PageHeader
        title="Decision log"
        subtitle="Every decision recorded across meetings: what was decided, when, and what later contradicted it."
        actions={
          <nav aria-label="Filter decisions" className="flex rounded border border-border p-0.5 text-sm">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={filterHref(f.key)}
                aria-current={filter === f.key ? "page" : undefined}
                className={`rounded-sm px-3 py-1 transition-colors ${
                  filter === f.key ? "bg-surface-2 text-foreground" : "text-secondary hover:text-foreground"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        }
      />

      {error && <ErrorText>Could not load decisions: {error.message}</ErrorText>}

      {!error && visible.length === 0 && (
        <EmptyState
          message={
            log.length === 0
              ? "No decisions recorded yet. They are pulled out of every analyzed meeting automatically."
              : "No decisions match this filter."
          }
        />
      )}

      {!error && visible.length > 0 && (
        <ol className="border-t border-border">
          {visible.map((decision) => (
            <li key={decision.id} className="border-b border-border py-5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[0.95rem] leading-snug text-foreground">{decision.description}</p>
                <DecisionStatusToggle findingId={decision.id} status={decision.decisionStatus} />
              </div>
              <Meta className="mt-2">
                {decision.meeting?.id && (
                  <Link
                    href={`/meetings/${decision.meeting.id}`}
                    className="underline decoration-border underline-offset-2 hover:text-foreground"
                  >
                    {decision.meeting.title}
                  </Link>
                )}
                {decision.meeting && (
                  <time dateTime={decision.meeting.occurred_at}>
                    {new Date(decision.meeting.occurred_at).toLocaleDateString()}
                  </time>
                )}
                {decision.owner && (
                  <span>
                    <span className="text-muted">Owner</span> {decision.owner}
                  </span>
                )}
                {decision.dueDate && (
                  <span
                    className={
                      decision.decisionStatus === "pending" && decision.dueDate < today
                        ? "font-medium text-status-critical"
                        : ""
                    }
                  >
                    Due {decision.dueDate}
                  </span>
                )}
                {decision.occurrences > 1 && <Badge tone="neutral">Raised {decision.occurrences} times</Badge>}
                {decision.revisitedLater && <Badge tone="warning">Revisited later</Badge>}
              </Meta>
              {decision.contradictions.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {decision.contradictions.map((content, index) => (
                    <li
                      key={index}
                      className="rounded border-l-2 border-accent bg-status-serious-bg px-3 py-2 text-sm text-secondary"
                    >
                      <span className="font-medium text-foreground">Contradicted later: </span>
                      {content}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </AppShell>
  );
}
