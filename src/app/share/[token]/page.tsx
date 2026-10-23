import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchScopedFindings } from "@/lib/findings-query";
import { buildDecisionLog } from "@/lib/decisions";
import { buildOpenIssues, todayUtc } from "@/lib/dashboard";
import { describeIssue } from "@/lib/brief";
import { computeHealth } from "@/lib/health";
import { HealthCard } from "@/components/health-card";
import { SECTION_TITLE, Wordmark } from "@/components/ui";

// A shared status link must never end up in a search index.
export const metadata: Metadata = {
  title: "Project status — ScopeLens",
  robots: { index: false, follow: false },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECTION_LABEL: Record<string, string> = {
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
    <div className="flex flex-1 flex-col px-4 sm:px-8">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between">
        <Link href="/" aria-label="ScopeLens home">
          <Wordmark />
        </Link>
        <span className="text-xs text-muted">Read-only status report</span>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 pt-8 pb-16">
        <h1 className="font-display text-4xl text-foreground">{project.name}</h1>
        <p className="mt-2 text-sm text-secondary">Generated {today} from the project&apos;s analyzed meetings.</p>

        <div className="mt-10 flex flex-col gap-12">
          <HealthCard health={health} />

          {(["blocker", "decision", "dependency", "risk"] as const).map((type) => {
            const items = issues.filter((issue) => issue.finding.finding_type === type);
            if (items.length === 0) return null;
            return (
              <section key={type} aria-labelledby={`share-${type}`}>
                <h2 id={`share-${type}`} className={`${SECTION_TITLE} flex items-baseline gap-2`}>
                  {SECTION_LABEL[type]}
                  <span className="text-xs font-normal tabular-nums text-muted">{items.length}</span>
                </h2>
                <ul className="mt-2 border-t border-border">
                  {items.map((issue) => (
                    <li key={issue.finding.id} className="border-b border-border py-3 text-sm">
                      <p className="text-foreground">{issue.finding.description}</p>
                      <p className="mt-0.5 text-xs text-secondary">{describeIssue(issue, today)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {recentDecisions.length > 0 && (
            <section aria-labelledby="share-decisions">
              <h2 id="share-decisions" className={SECTION_TITLE}>
                Recent decisions
              </h2>
              <ul className="mt-2 border-t border-border">
                {recentDecisions.map((decision) => (
                  <li key={decision.id} className="flex justify-between gap-4 border-b border-border py-3 text-sm">
                    <span className="text-foreground">{decision.description}</span>
                    {decision.meeting && (
                      <time dateTime={decision.meeting.occurred_at} className="shrink-0 text-xs text-muted">
                        {new Date(decision.meeting.occurred_at).toLocaleDateString()}
                      </time>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {meetings && meetings.length > 0 && (
            <section aria-labelledby="share-meetings">
              <h2 id="share-meetings" className={SECTION_TITLE}>
                Recent meetings
              </h2>
              <ul className="mt-2 border-t border-border">
                {meetings.map((meeting) => (
                  <li key={meeting.id} className="border-b border-border py-4">
                    <p className="flex items-baseline justify-between gap-4 text-sm font-medium text-foreground">
                      {meeting.title}
                      <time dateTime={meeting.occurred_at} className="shrink-0 text-xs font-normal text-muted">
                        {new Date(meeting.occurred_at).toLocaleDateString()}
                      </time>
                    </p>
                    {meeting.executive_summary && (
                      <p className="mt-1 text-sm leading-relaxed text-secondary">{meeting.executive_summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
