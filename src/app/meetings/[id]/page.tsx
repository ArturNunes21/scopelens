import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { MeetingStatusBadge } from "./status-badge";
import { RetryButton } from "./retry-button";

const FINDING_TYPE_LABEL: Record<string, string> = {
  blocker: "Blockers",
  risk: "Risks",
  dependency: "Dependencies",
  decision: "Decisions",
};

const FINDING_TYPE_ORDER = ["blocker", "risk", "dependency", "decision"] as const;

const LENS_LABEL: Record<string, string> = {
  contradiction: "Contradiction",
  continuity: "Continuity",
  decision_gap: "Decision gap",
};

const PRIORITY_CLASS: Record<string, string> = {
  high: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspaceId } = await requireWorkspace();

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select(
      "id, title, meeting_type, status, error_message, executive_summary, occurred_at"
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !meeting) notFound();

  const [{ data: findings }, { data: notes }, { data: actions }] = await Promise.all([
    supabase
      .from("findings")
      .select("id, finding_type, description, owner, decision_status")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("diagnostic_notes")
      .select("id, lens, content")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("suggested_actions")
      .select("id, description, priority")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const findingsByType = new Map<string, typeof findings>();
  for (const type of FINDING_TYPE_ORDER) findingsByType.set(type, []);
  for (const finding of findings ?? []) {
    findingsByType.get(finding.finding_type)?.push(finding);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <Link
          href="/meetings"
          className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Meetings
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
              {meeting.title}
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {meeting.meeting_type} ·{" "}
              {new Date(meeting.occurred_at).toLocaleDateString()}
            </p>
          </div>
          <MeetingStatusBadge meetingId={meeting.id} initialStatus={meeting.status} />
        </div>

        {(meeting.status === "pending" || meeting.status === "processing") && (
          <div className="mt-8 rounded-lg border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Analyzing this meeting — this updates automatically, no need to
              refresh.
            </p>
          </div>
        )}

        {meeting.status === "failed" && (
          <div className="mt-8 rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
            <p className="text-sm text-red-600 dark:text-red-400">
              {meeting.error_message ?? "Analysis failed."}
            </p>
            <div className="mt-4">
              <RetryButton meetingId={meeting.id} />
            </div>
          </div>
        )}

        {meeting.status === "completed" && (
          <div className="mt-8 flex flex-col gap-6">
            {meeting.executive_summary && (
              <section className="rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
                <h2 className="text-sm font-medium text-black dark:text-zinc-50">
                  Executive summary
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {meeting.executive_summary}
                </p>
              </section>
            )}

            {actions && actions.length > 0 && (
              <section className="rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
                <h2 className="text-sm font-medium text-black dark:text-zinc-50">
                  Suggested actions
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {actions.map((action) => (
                    <li
                      key={action.id}
                      className="flex items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400"
                    >
                      <span>{action.description}</span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                          PRIORITY_CLASS[action.priority] ?? PRIORITY_CLASS.medium
                        }`}
                      >
                        {action.priority}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {notes && notes.length > 0 && (
              <section className="rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
                <h2 className="text-sm font-medium text-black dark:text-zinc-50">
                  Diagnosis
                </h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {notes.map((note) => (
                    <li key={note.id}>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {LENS_LABEL[note.lens] ?? note.lens}
                      </span>
                      <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                        {note.content}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">
                Findings
              </h2>
              {findings && findings.length === 0 && (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  No blockers, risks, dependencies, or decisions found.
                </p>
              )}
              <div className="mt-3 flex flex-col gap-4">
                {FINDING_TYPE_ORDER.map((type) => {
                  const items = findingsByType.get(type) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={type}>
                      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {FINDING_TYPE_LABEL[type]}
                      </h3>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {items.map((finding) => (
                          <li
                            key={finding.id}
                            className="text-sm text-zinc-600 dark:text-zinc-400"
                          >
                            {finding.description}
                            {finding.owner && (
                              <span className="text-zinc-500 dark:text-zinc-500">
                                {" "}
                                — {finding.owner}
                              </span>
                            )}
                            {finding.decision_status && (
                              <span className="text-zinc-500 dark:text-zinc-500">
                                {" "}
                                ({finding.decision_status})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
