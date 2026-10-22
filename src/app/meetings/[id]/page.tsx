import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { MeetingStatusBadge } from "./status-badge";
import { RetryButton } from "./retry-button";
import { FindingResolveToggle } from "./finding-resolve-toggle";
import { FindingAssignment } from "./finding-assignment";
import { DecisionStatusToggle } from "@/components/decision-status-toggle";
import { Badge, CARD, CARD_CENTERED, ErrorText } from "@/components/ui";
import { findEvidence, splitTranscript, type Evidence } from "@/lib/evidence";
import { todayUtc } from "@/lib/dashboard";
import { withProject } from "@/lib/projects";

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
      "id, title, meeting_type, status, error_message, executive_summary, occurred_at, transcript_raw, project_id, project:projects(name)"
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
      .select("id, finding_type, description, owner, decision_status, status, due_date")
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

  // Phase 9 — transcript evidence: where in the transcript each finding most
  // likely came from. Lexical matching at render time, no AI call.
  const segments = splitTranscript(meeting.transcript_raw);
  const evidenceById = new Map<string, Evidence>();
  const evidenceLines = new Set<number>();
  for (const finding of findings ?? []) {
    const evidence = findEvidence(segments, finding.description);
    if (!evidence) continue;
    evidenceById.set(finding.id, evidence);
    for (const index of evidence.lineIndexes) evidenceLines.add(index);
  }

  const today = todayUtc();
  const project = Array.isArray(meeting.project) ? meeting.project[0] : meeting.project;

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <Link
          href={withProject("/meetings", meeting.project_id)}
          className="text-sm text-secondary hover:text-foreground"
        >
          ← {project?.name ?? "Meetings"}
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
                      <ul className="mt-2 flex flex-col gap-2">
                        {items.map((finding) => {
                          const evidence = evidenceById.get(finding.id);
                          return (
                            <li
                              key={finding.id}
                              className="rounded border border-border px-3 py-2.5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-sm text-foreground">{finding.description}</span>
                                {type === "decision" ? (
                                  <DecisionStatusToggle
                                    findingId={finding.id}
                                    status={finding.decision_status === "taken" ? "taken" : "pending"}
                                  />
                                ) : (
                                  <FindingResolveToggle
                                    findingId={finding.id}
                                    status={finding.status as "open" | "resolved"}
                                  />
                                )}
                              </div>
                              <div className="mt-1.5">
                                <FindingAssignment
                                  findingId={finding.id}
                                  owner={finding.owner}
                                  dueDate={finding.due_date}
                                  overdue={
                                    Boolean(finding.due_date && finding.due_date < today) &&
                                    (type === "decision"
                                      ? finding.decision_status === "pending"
                                      : finding.status === "open")
                                  }
                                />
                              </div>
                              {evidence && (
                                <details className="mt-1.5 text-xs">
                                  <summary className="cursor-pointer text-secondary hover:text-foreground">
                                    Evidence from transcript
                                  </summary>
                                  <blockquote className="mt-1.5 border-l-2 border-accent pl-3 text-secondary">
                                    {evidence.text}
                                  </blockquote>
                                </details>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={CARD}>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Transcript
                  <span className="ml-2 text-xs font-normal text-muted">
                    {evidenceLines.size > 0
                      ? "highlighted lines are cited as evidence above"
                      : `${segments.length} lines`}
                  </span>
                </summary>
                <ol className="mt-3 flex flex-col gap-1 font-mono text-xs">
                  {segments.map((line, index) => (
                    <li
                      key={index}
                      className={`rounded px-2 py-1 ${
                        evidenceLines.has(index) ? "bg-accent/10 text-foreground" : "text-secondary"
                      }`}
                    >
                      {line}
                    </li>
                  ))}
                </ol>
              </details>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
