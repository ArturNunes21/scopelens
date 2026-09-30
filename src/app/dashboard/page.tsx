import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { buildOpenCounts, buildTrend, buildRecurringGroups, type FindingRow } from "@/lib/dashboard";
import { TrendChart } from "./trend-chart";
import { AppHeader, Badge, CARD, CARD_COMPACT, EmptyState, ErrorText } from "@/components/ui";

const FINDING_TYPE_LABEL: Record<string, string> = {
  blocker: "Open blockers",
  risk: "Open risks",
  dependency: "Open dependencies",
};

// PostgREST silently truncates any unlimited query at its configured
// max_rows (1000 in supabase/config.toml) — without an explicit limit here,
// a workspace that ever crosses that count would get wrong cumulative
// aggregates with no error surfaced. Ordering DESC + limiting, then
// reversing back to ascending below, keeps the MOST RECENT findings when a
// cap is hit rather than the oldest — the more useful half to keep correct
// for a dashboard, at the cost of undercounting older history. Placeholder
// ceiling for the MVP, same spirit as the 50k-char transcript cap (GAPS.md
// G17) — a real fix once a workspace nears this is a server-side aggregate
// query instead of fetching every row to reduce client-side.
const FINDINGS_QUERY_CAP = 1000;

export default async function DashboardPage() {
  const { supabase, workspaceId } = await requireWorkspace();

  const { data, error } = await supabase
    .from("findings")
    .select(
      "id, finding_type, description, status, decision_status, resolved_at, recurrence_group_id, meeting:meetings(occurred_at)"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(FINDINGS_QUERY_CAP);

  const findings = ((data ?? []) as unknown as FindingRow[]).reverse();
  const truncated = findings.length === FINDINGS_QUERY_CAP;

  const { openCounts, pendingDecisions } = buildOpenCounts(findings);
  const trend = buildTrend(findings);
  const recurring = buildRecurringGroups(findings);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <AppHeader
          title="Dashboard"
          subtitle="Open vs. resolved across every meeting in this workspace"
          active="/dashboard"
        />

        {error && <ErrorText>Could not load dashboard data: {error.message}</ErrorText>}

        {!error && findings.length === 0 && (
          <div className="mt-8">
            <EmptyState message="No findings yet — analyze a meeting to see trends here.">
              <Link
                href="/meetings/new"
                className="text-sm font-medium text-foreground underline underline-offset-4"
              >
                New meeting
              </Link>
            </EmptyState>
          </div>
        )}

        {!error && findings.length > 0 && (
          <div className="mt-8 flex flex-col gap-6">
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
