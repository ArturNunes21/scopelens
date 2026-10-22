import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { buildOpenCounts, buildTrend, buildRecurringGroups, buildOpenIssues, isOverdue, todayUtc } from "@/lib/dashboard";
import { fetchScopedFindings, FINDINGS_QUERY_CAP } from "@/lib/findings-query";
import { computeHealth } from "@/lib/health";
import { getProjectScope, projectParam, withProject } from "@/lib/projects";
import { TrendChart } from "./trend-chart";
import { ProjectSwitcher } from "@/components/project-switcher";
import { HealthCard } from "@/components/health-card";
import { AppHeader, Badge, buttonClass, CARD, CARD_COMPACT, EmptyState, ErrorText } from "@/components/ui";

const FINDING_TYPE_LABEL: Record<string, string> = {
  blocker: "Open blockers",
  risk: "Open risks",
  dependency: "Open dependencies",
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

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <AppHeader
          title="Dashboard"
          subtitle={
            project
              ? `Open vs. resolved across every meeting in ${project.name}`
              : "Open vs. resolved across every project in this workspace"
          }
          active="/dashboard"
          projectId={projectId}
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <ProjectSwitcher projects={projects} projectId={projectId} />
          <Link href={withProject("/brief", projectId)} className={buttonClass("secondary")}>
            Prep next meeting
          </Link>
        </div>

        {error && <ErrorText>Could not load dashboard data: {error.message}</ErrorText>}

        {!error && findings.length === 0 && (
          <div className="mt-8">
            <EmptyState message="No findings yet — analyze a meeting to see trends here.">
              <Link
                href={withProject("/meetings/new", projectId)}
                className="text-sm font-medium text-foreground underline underline-offset-4"
              >
                New meeting
              </Link>
            </EmptyState>
          </div>
        )}

        {!error && findings.length > 0 && (
          <div className="mt-6 flex flex-col gap-6">
            {truncated && (
              <p className="text-xs text-secondary">
                Showing the most recent {FINDINGS_QUERY_CAP.toLocaleString()} findings — older
                history is omitted from these totals.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["blocker", "risk", "dependency"] as const).map((type) => (
                <div key={type} className={CARD_COMPACT}>
                  <p className="text-xs text-secondary">{FINDING_TYPE_LABEL[type]}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {openCounts[type]}
                  </p>
                </div>
              ))}
              <div className={CARD_COMPACT}>
                <p className="text-xs text-secondary">Pending decisions</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{pendingDecisions}</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <HealthCard
                health={health}
                title={project ? "Project health" : "Workspace health"}
              />
              <section className={CARD}>
                <h2 className="text-sm font-medium text-foreground">Overdue</h2>
                {overdue.length === 0 ? (
                  <p className="mt-2 text-sm text-secondary">
                    Nothing past its due date. Set owners and due dates from a meeting&apos;s
                    findings.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {overdue.map(({ finding }) => (
                      <li key={finding.id} className="text-sm text-secondary">
                        <span>{finding.description}</span>
                        <span className="mt-0.5 block text-xs text-status-critical">
                          due {finding.due_date}
                          {finding.owner ? ` · ${finding.owner}` : " · no owner"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className={CARD}>
              <h2 className="text-sm font-medium text-foreground">Open vs. resolved over time</h2>
              {trend.length < 2 ? (
                <p className="mt-3 text-sm text-secondary">
                  Not enough history yet — this fills in as more meetings are analyzed
                  and findings get resolved.
                </p>
              ) : (
                <div className="mt-4">
                  <TrendChart data={trend} />
                </div>
              )}
            </section>

            <section className={CARD}>
              <h2 className="text-sm font-medium text-foreground">Recurring issues</h2>
              {recurring.length === 0 ? (
                <p className="mt-2 text-sm text-secondary">
                  Nothing has recurred across meetings yet.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {recurring.map((group) => (
                    <li
                      key={group.recurrenceGroupId}
                      className="flex items-center justify-between gap-3 text-sm text-secondary"
                    >
                      <span>{group.description}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted">{group.occurrences}×</span>
                        <Badge tone={group.anyOpen ? "neutral" : "good"}>
                          {group.anyOpen ? "Open" : "Resolved"}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
