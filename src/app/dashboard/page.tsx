import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { buildOpenCounts, buildTrend, buildRecurringGroups, type FindingRow } from "@/lib/dashboard";
import { TrendChart } from "./trend-chart";

const FINDING_TYPE_LABEL: Record<string, string> = {
  blocker: "Open blockers",
  risk: "Open risks",
  dependency: "Open dependencies",
};

export default async function DashboardPage() {
  const { supabase, workspaceId } = await requireWorkspace();

  const { data, error } = await supabase
    .from("findings")
    .select(
      "id, finding_type, description, status, decision_status, resolved_at, recurrence_group_id, meeting:meetings(occurred_at)"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  const findings = (data ?? []) as unknown as FindingRow[];

  const { openCounts, pendingDecisions } = buildOpenCounts(findings);
  const trend = buildTrend(findings);
  const recurring = buildRecurringGroups(findings);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
              Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Open vs. resolved across every meeting in this workspace
            </p>
          </div>
          <Link
            href="/meetings"
            className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Meetings →
          </Link>
        </div>

        {error && (
          <p className="mt-8 text-sm text-red-600 dark:text-red-400">
            Could not load dashboard data: {error.message}
          </p>
        )}

        {!error && findings.length === 0 && (
          <div className="mt-8 rounded-lg border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No findings yet — analyze a meeting to see trends here.
            </p>
            <Link
              href="/meetings/new"
              className="mt-4 inline-block text-sm font-medium text-black underline underline-offset-4 dark:text-zinc-50"
            >
              New meeting
            </Link>
          </div>
        )}

        {!error && findings.length > 0 && (
          <div className="mt-8 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["blocker", "risk", "dependency"] as const).map((type) => (
                <div
                  key={type}
                  className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
                >
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {FINDING_TYPE_LABEL[type]}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
                    {openCounts[type]}
                  </p>
                </div>
              ))}
              <div className="rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Pending decisions
                </p>
                <p className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
                  {pendingDecisions}
                </p>
              </div>
            </div>

            <section className="rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">
                Open vs. resolved over time
              </h2>
              {trend.length < 2 ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Not enough history yet — this fills in as more meetings are analyzed
                  and findings get resolved.
                </p>
              ) : (
                <div className="mt-4">
                  <TrendChart data={trend} />
                </div>
              )}
            </section>

            <section className="rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">
                Recurring issues
              </h2>
              {recurring.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Nothing has recurred across meetings yet.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {recurring.map((group) => (
                    <li
                      key={group.recurrenceGroupId}
                      className="flex items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400"
                    >
                      <span>{group.description}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">
                          {group.occurrences}×
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            group.anyOpen
                              ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                              : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          }`}
                        >
                          {group.anyOpen ? "Open" : "Resolved"}
                        </span>
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
