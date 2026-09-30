import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { MeetingStatusBadge } from "./status-badge";
import { RetryButton } from "./retry-button";
import { FindingResolveToggle } from "./finding-resolve-toggle";
import { Badge, CARD, CARD_CENTERED, ErrorText } from "@/components/ui";

// Extends the Server Action timeout for `retryMeeting`'s 3 chained AI calls
// (GAPS.md G15). See ARCHITECTURE.md section 3.
export const maxDuration = 60;

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

const PRIORITY_TONE: Record<string, "critical" | "accent" | "neutral"> = {
  high: "critical",
  medium: "accent",
  low: "neutral",
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

  const [
    { data: findings, error: findingsError },
    { data: notes, error: notesError },
    { data: actions, error: actionsError },
  ] = await Promise.all([
    supabase
      .from("findings")
      .select("id, finding_type, description, owner, decision_status, status")
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
  const loadError = findingsError ?? notesError ?? actionsError;

  const findingsByType = new Map<string, typeof findings>();
  for (const type of FINDING_TYPE_ORDER) findingsByType.set(type, []);
  for (const finding of findings ?? []) {
    findingsByType.get(finding.finding_type)?.push(finding);
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <Link href="/meetings" className="text-sm text-secondary hover:text-foreground">
          ← Meetings
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{meeting.title}</h1>
            <p className="mt-0.5 text-xs text-secondary">
              {meeting.meeting_type} · {new Date(meeting.occurred_at).toLocaleDateString()}
            </p>
          </div>
          <MeetingStatusBadge meetingId={meeting.id} initialStatus={meeting.status} />
        </div>

        {(meeting.status === "pending" || meeting.status === "processing") && (
          <div className={`mt-8 ${CARD_CENTERED}`}>
            <p className="text-sm text-secondary">
              Analyzing this meeting — this updates automatically, no need to refresh.
            </p>
          </div>
        )}

        {meeting.status === "failed" && (
          <div className={`mt-8 ${CARD}`}>
            <ErrorText>{meeting.error_message ?? "Analysis failed."}</ErrorText>
            <div className="mt-4">
              <RetryButton meetingId={meeting.id} />
            </div>
          </div>
        )}

        {meeting.status === "completed" && (
          <div className="mt-8 flex flex-col gap-6">
            {loadError && (
              <ErrorText>Could not load some of this meeting&apos;s data: {loadError.message}</ErrorText>
            )}

            {meeting.executive_summary && (
              <section className={CARD}>
                <h2 className="text-sm font-medium text-foreground">Executive summary</h2>
                <p className="mt-2 text-sm text-secondary">{meeting.executive_summary}</p>
              </section>
            )}

            {actions && actions.length > 0 && (
              <section className={CARD}>
                <h2 className="text-sm font-medium text-foreground">Suggested actions</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {actions.map((action) => (
                    <li
                      key={action.id}
                      className="flex items-center justify-between gap-3 text-sm text-secondary"
                    >
                      <span>{action.description}</span>
                      <Badge tone={PRIORITY_TONE[action.priority] ?? PRIORITY_TONE.medium}>
                        {action.priority}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {notes && notes.length > 0 && (
              <section className={CARD}>
                <h2 className="text-sm font-medium text-foreground">Diagnosis</h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {notes.map((note) => (
                    <li key={note.id}>
                      <Badge tone="neutral">{LENS_LABEL[note.lens] ?? note.lens}</Badge>
                      <p className="mt-1.5 text-sm text-secondary">{note.content}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={CARD}>
              <h2 className="text-sm font-medium text-foreground">Findings</h2>
              {findings && findings.length === 0 && (
                <p className="mt-2 text-sm text-secondary">
                  No blockers, risks, dependencies, or decisions found.
                </p>
              )}
              <div className="mt-3 flex flex-col gap-4">
                {FINDING_TYPE_ORDER.map((type) => {
                  const items = findingsByType.get(type) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={type}>
                      <h3 className="text-xs font-medium uppercase tracking-wide text-secondary">
                        {FINDING_TYPE_LABEL[type]}
                      </h3>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {items.map((finding) => (
                          <li
                            key={finding.id}
                            className="flex items-start justify-between gap-3 text-sm text-secondary"
                          >
                            <span>
                              {finding.description}
                              {finding.owner && <span className="text-muted"> — {finding.owner}</span>}
                              {finding.decision_status && (
                                <span className="text-muted"> ({finding.decision_status})</span>
                              )}
                            </span>
                            {type !== "decision" && (
                              <FindingResolveToggle
                                findingId={finding.id}
                                status={finding.status as "open" | "resolved"}
                              />
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
