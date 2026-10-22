import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { getProjectScope, projectParam, withProject } from "@/lib/projects";
import { fetchScopedFindings } from "@/lib/findings-query";
import { buildDecisionLog, type DecisionNote } from "@/lib/decisions";
import { todayUtc } from "@/lib/dashboard";
import { ProjectSwitcher } from "@/components/project-switcher";
import { DecisionStatusToggle } from "@/components/decision-status-toggle";
import { AppHeader, Badge, CARD_COMPACT, EmptyState, ErrorText } from "@/components/ui";

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
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <AppHeader
          title="Decision log"
          subtitle="Every decision recorded across meetings — what was decided, when, and what contradicts it"
          active="/decisions"
          projectId={projectId}
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <ProjectSwitcher projects={projects} projectId={projectId} />
          <div className="flex gap-1 rounded-full border border-border p-0.5 text-xs">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={filterHref(f.key)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  filter === f.key ? "bg-accent text-accent-foreground" : "text-secondary"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {error && <ErrorText>Could not load decisions: {error.message}</ErrorText>}

        {!error && visible.length === 0 && (
          <div className="mt-8">
            <EmptyState
              message={
                log.length === 0
                  ? "No decisions recorded yet — they're extracted automatically from analyzed meetings."
                  : "No decisions match this filter."
              }
            />
          </div>
        )}

        {!error && visible.length > 0 && (
          <ol className="mt-6 flex flex-col gap-3">
            {visible.map((decision) => (
              <li key={decision.id} className={CARD_COMPACT}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-foreground">{decision.description}</p>
                  <DecisionStatusToggle findingId={decision.id} status={decision.decisionStatus} />
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
                  {decision.meeting?.id ? (
                    <Link
                      href={`/meetings/${decision.meeting.id}`}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {decision.meeting.title}
                    </Link>
                  ) : null}
                  {decision.meeting && (
                    <span>{new Date(decision.meeting.occurred_at).toLocaleDateString()}</span>
                  )}
                  {decision.owner && <span>· Owner: {decision.owner}</span>}
                  {decision.dueDate && (
                    <span
                      className={
                        decision.decisionStatus === "pending" && decision.dueDate < today
                          ? "font-medium text-status-critical"
                          : ""
                      }
                    >
                      · Due {decision.dueDate}
                    </span>
                  )}
                  {decision.occurrences > 1 && (
                    <Badge tone="neutral">raised {decision.occurrences}×</Badge>
                  )}
                  {decision.revisitedLater && <Badge tone="warning">revisited later</Badge>}
                </p>
                {decision.contradictions.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {decision.contradictions.map((content, index) => (
                      <li
                        key={index}
                        className="rounded border-l-2 border-status-serious bg-status-serious-bg px-3 py-2 text-xs text-secondary"
                      >
                        <span className="font-medium text-foreground">Contradiction: </span>
                        {content}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
