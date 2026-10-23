import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import {
  buildOpenCounts,
  buildTrend,
  buildRecurringGroups,
  buildOpenIssues,
  isOverdue,
  meetingOf,
  todayUtc,
  type FindingRow,
} from "@/lib/dashboard";
import { fetchScopedFindings, FINDINGS_QUERY_CAP } from "@/lib/findings-query";
import { computeHealth, summarizeProject, HEALTH_LABEL, HEALTH_TONE } from "@/lib/health";
import { getProjectScope, projectParam, withProject } from "@/lib/projects";
import { TrendChart } from "./trend-chart";
import { AppShell } from "@/components/app-shell";
import { HealthCard } from "@/components/health-card";
import {
  Badge,
  buttonClass,
  CARD,
  CARD_COMPACT,
  EmptyState,
  ErrorText,
  PageHeader,
  SECTION_TITLE,
} from "@/components/ui";

const ISSUE_TYPE_LABEL: Record<string, string> = {
  blocker: "Blocker",
  risk: "Risk",
  dependency: "Dependency",
  decision: "Decision",
};

const FINDING_TYPE_LABEL: Record<string, string> = {
  blocker: "Open blockers",
  risk: "Open risks",
  dependency: "Open dependencies",
  decision: "Pending decisions",
};

export default async function DashboardPage({
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

  const { findings, truncated, error } = await fetchScopedFindings(supabase, workspaceId, projectId);

  const today = todayUtc();
  const { openCounts, pendingDecisions } = buildOpenCounts(findings);
  const trend = buildTrend(findings);
  const recurring = buildRecurringGroups(findings);
  const health = computeHealth(findings, today);
  const overdue = buildOpenIssues(findings).filter((issue) => isOverdue(issue.finding, today));

  // "All projects" view: one summary card per project, worst health first,
  // so the project that needs attention is always the first thing seen.
  const findingsByProject = new Map<string, FindingRow[]>();
  if (!projectId) {
    for (const f of findings) {
      const id = meetingOf(f.meeting)?.project_id;
      if (!id) continue;
      const list = findingsByProject.get(id) ?? [];
      list.push(f);
      findingsByProject.set(id, list);
    }
  }
  const projectSummaries = projectId
    ? []
    : projects
        .map((p) => ({ project: p, summary: summarizeProject(findingsByProject.get(p.id) ?? [], today) }))
        .sort((a, b) => a.summary.health.score - b.summary.health.score);

  const tiles = [
    ["blocker", openCounts.blocker],
    ["risk", openCounts.risk],
    ["dependency", openCounts.dependency],
    ["decision", pendingDecisions],
  ] as const;

  return (
    <AppShell active="/dashboard" projects={projects} projectId={projectId}>
      <PageHeader
        title={project ? project.name : "All projects"}
        subtitle={
          project
            ? "Open versus resolved across every meeting in this project."
            : "Every project in this workspace, the one that needs attention first."
        }
        actions={
          <Link href={withProject("/brief", projectId)} className={buttonClass("secondary")}>
            Prep next meeting
          </Link>
        }
      />

      {error && <ErrorText>Could not load dashboard data: {error.message}</ErrorText>}

      {!error && findings.length === 0 && (
        <EmptyState message="No findings yet. Analyze a meeting and its blockers, risks and decisions show up here.">
          <Link href={withProject("/meetings/new", projectId)} className={buttonClass("primary")}>
            New meeting
          </Link>
        </EmptyState>
      )}

      {!error && findings.length > 0 && (
        <div className="flex flex-col gap-12">
          {projectSummaries.length > 0 && (
            <section aria-labelledby="overview-title">
              <h2 id="overview-title" className={SECTION_TITLE}>
                Projects
              </h2>
              <p className="mt-0.5 text-sm text-secondary">
                Lowest health first. Open one for its full dashboard.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {projectSummaries.map(({ project: p, summary }) => (
                  <Link
                    key={p.id}
                    href={`/dashboard?project=${p.id}`}
                    className={`${CARD_COMPACT} flex flex-col transition-colors hover:border-secondary`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {summary.health.score}
                        </span>
                        <Badge tone={HEALTH_TONE[summary.health.level]}>
                          {HEALTH_LABEL[summary.health.level]}
                        </Badge>
                      </span>
                    </div>
                    <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs tabular-nums text-secondary">
                      <span>{summary.counts.blocker} blockers</span>
                      <span>{summary.counts.risk} risks</span>
                      <span>{summary.counts.dependency} dependencies</span>
                      <span>{summary.counts.decision} pending decisions</span>
                      {summary.counts.overdue > 0 && (
                        <span className="font-medium text-status-critical">
                          {summary.counts.overdue} overdue
                        </span>
                      )}
                    </p>
                    {summary.topIssues.length === 0 ? (
                      <p className="mt-3 text-xs text-muted">No open issues.</p>
                    ) : (
                      <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                        {summary.topIssues.map(({ finding }) => (
                          <li key={finding.id} className="flex gap-2 text-xs">
                            <span
                              className={`w-[4.5rem] shrink-0 font-medium ${
                                isOverdue(finding, today) ? "text-status-critical" : "text-muted"
                              }`}
                            >
                              {isOverdue(finding, today) ? "Overdue" : ISSUE_TYPE_LABEL[finding.finding_type]}
                            </span>
                            <span className="line-clamp-2 text-secondary">{finding.description}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Open items" className="flex flex-col gap-3">
            {truncated && (
              <p className="text-xs text-secondary">
                Showing the most recent {FINDINGS_QUERY_CAP.toLocaleString()} findings. Older history
                is left out of these totals.
              </p>
            )}
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
              {tiles.map(([type, count]) => (
                <div key={type} className="flex flex-col-reverse gap-1 bg-surface p-4">
                  <dt className="text-xs text-secondary">{FINDING_TYPE_LABEL[type]}</dt>
                  <dd
                    className={`font-display text-3xl tabular-nums ${
                      type === "blocker" && count > 0 ? "text-accent-ink" : "text-foreground"
                    }`}
                  >
                    {count}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <HealthCard health={health} title={project ? "Project health" : "Workspace health"} />
            <section className={CARD}>
              <h2 className={SECTION_TITLE}>Overdue</h2>
              {overdue.length === 0 ? (
                <p className="mt-2 text-sm text-secondary">
                  Nothing past its due date. Owners and due dates are set on each meeting&apos;s
                  findings.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {overdue.map(({ finding }) => (
                    <li key={finding.id} className="text-sm text-foreground">
                      <span>{finding.description}</span>
                      <span className="mt-0.5 flex gap-3 text-xs text-secondary">
                        <span className="text-status-critical">Due {finding.due_date}</span>
                        <span>{finding.owner ?? "No owner"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-labelledby="trend-title">
            <h2 id="trend-title" className={SECTION_TITLE}>
              Open versus resolved over time
            </h2>
            {trend.length < 2 ? (
              <p className="mt-2 text-sm text-secondary">
                Not enough history yet. This fills in as more meetings are analyzed and findings get
                resolved.
              </p>
            ) : (
              <div className={`mt-4 ${CARD}`}>
                <TrendChart data={trend} />
              </div>
            )}
          </section>

          <section aria-labelledby="recurring-title">
            <h2 id="recurring-title" className={SECTION_TITLE}>
              Recurring issues
            </h2>
            <p className="mt-0.5 text-sm text-secondary">The same issue raised in more than one meeting.</p>
            {recurring.length === 0 ? (
              <p className="mt-3 text-sm text-secondary">Nothing has come back across meetings yet.</p>
            ) : (
              <ul className="mt-3 border-t border-border">
                {recurring.map((group) => (
                  <li
                    key={group.recurrenceGroupId}
                    className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm"
                  >
                    <span className="text-foreground">{group.description}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs tabular-nums text-muted">{group.occurrences} meetings</span>
                      <Badge tone={group.anyOpen ? "serious" : "good"}>
                        {group.anyOpen ? "Still open" : "Resolved"}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
