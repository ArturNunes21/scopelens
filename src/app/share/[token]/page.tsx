import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchScopedFindings } from "@/lib/findings-query";
import { buildDecisionLog } from "@/lib/decisions";
import { buildOpenIssues, todayUtc } from "@/lib/dashboard";
import { describeIssue } from "@/lib/brief";
import { computeHealth } from "@/lib/health";
import { HealthCard } from "@/components/health-card";
import { Badge, CARD } from "@/components/ui";

// A shared status link must never end up in a search index.
export const metadata: Metadata = {
  title: "Project status — ScopeLens",
  robots: { index: false, follow: false },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECTION_TITLE: Record<string, string> = {
  blocker: "Open blockers",
  decision: "Pending decisions",
  dependency: "Open dependencies",
  risk: "Open risks",
};

const RECENT_LIMIT = 5;

// Phase 9 — public, read-only status report for one project, reachable only
// through its unguessable share token (projects.share_token, random UUID).
//
// The one page that reads with the service-role client WITHOUT a signed-in
// user: the token lookup below is the entire authorization step, and every
// later query is pinned to the project/workspace that lookup returned —
// never to anything else from the request. Shows summaries and findings
// only; transcripts and the edit controls are never exposed here.
export default async function SharedStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_PATTERN.test(token)) notFound();

  const supabase = createServiceRoleClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, workspace_id")
    .eq("share_token", token)
    .maybeSingle();
  if (!project) notFound();

  const [{ findings }, { data: meetings }] = await Promise.all([
    fetchScopedFindings(supabase, project.workspace_id, project.id),
    supabase
      .from("meetings")
      .select("id, title, occurred_at, executive_summary")
      .eq("project_id", project.id)
      .eq("workspace_id", project.workspace_id)
      .eq("status", "completed")
      .order("occurred_at", { ascending: false })
      .limit(RECENT_LIMIT),
  ]);

  const today = todayUtc();
  const health = computeHealth(findings, today);
  const issues = buildOpenIssues(findings);
  const recentDecisions = buildDecisionLog(findings, [])
    .filter((d) => d.decisionStatus === "taken")
    .slice(0, RECENT_LIMIT);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <p className="text-xs uppercase tracking-wide text-muted">Status report · read-only</p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">{project.name}</h1>
        <p className="mt-0.5 text-xs text-secondary">Generated {today} by ScopeLens</p>

        <div className="mt-8 flex flex-col gap-6">
          <HealthCard health={health} />

          {(["blocker", "decision", "dependency", "risk"] as const).map((type) => {
            const items = issues.filter((issue) => issue.finding.finding_type === type);
            if (items.length === 0) return null;
            return (
              <section key={type} className={CARD}>
                <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {SECTION_TITLE[type]}
                  <Badge tone="neutral">{items.length}</Badge>
                </h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {items.map((issue) => (
                    <li key={issue.finding.id} className="text-sm">
                      <p className="text-foreground">{issue.finding.description}</p>
                      <p className="mt-0.5 text-xs text-secondary">{describeIssue(issue, today)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {recentDecisions.length > 0 && (
            <section className={CARD}>
              <h2 className="text-sm font-medium text-foreground">Recent decisions</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {recentDecisions.map((decision) => (
                  <li key={decision.id} className="text-sm text-secondary">
                    {decision.description}
                    {decision.meeting && (
                      <span className="text-xs text-muted">
                        {" "}
                        · {new Date(decision.meeting.occurred_at).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {meetings && meetings.length > 0 && (
            <section className={CARD}>
              <h2 className="text-sm font-medium text-foreground">Recent meetings</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {meetings.map((meeting) => (
                  <li key={meeting.id}>
                    <p className="text-sm font-medium text-foreground">
                      {meeting.title}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {new Date(meeting.occurred_at).toLocaleDateString()}
                      </span>
                    </p>
                    {meeting.executive_summary && (
                      <p className="mt-0.5 text-sm text-secondary">{meeting.executive_summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
