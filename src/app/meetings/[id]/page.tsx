import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { MeetingStatusBadge } from "./status-badge";
import { RetryButton } from "./retry-button";
import { AnalysisProgress } from "./analysis-progress";
import { FindingResolveToggle } from "./finding-resolve-toggle";
import { FindingAssignment } from "./finding-assignment";
import { DecisionStatusToggle } from "@/components/decision-status-toggle";
import { AppShell } from "@/components/app-shell";
import { Tabs } from "@/components/tabs";
import { Badge, ErrorText, Meta, PageHeader, SECTION_TITLE } from "@/components/ui";
import { findEvidence, splitSpeaker, splitTranscript, type Evidence } from "@/lib/evidence";
import { todayUtc } from "@/lib/dashboard";
import { getProjectScope, withProject } from "@/lib/projects";

// Extends the Server Action timeout for `retryMeeting`'s 3 chained AI calls
// (GAPS.md G15). See ARCHITECTURE.md section 3.
export const maxDuration = 60;

const FINDING_TYPE_LABEL: Record<string, string> = {
  blocker: "Blockers",
  risk: "Risks",
  dependency: "Dependencies",
  decision: "Decisions",
};

const FINDING_TYPE_EMPTY: Record<string, string> = {
  blocker: "Nothing in this meeting is stopping work.",
  risk: "No risks raised in this meeting.",
  dependency: "No dependencies on other teams or vendors.",
  decision: "No decisions made or pending in this meeting.",
};

const FINDING_TYPE_ORDER = ["blocker", "risk", "dependency", "decision"] as const;

// Each lens is a different question asked of the same transcript
// (src/lib/ai/diagnosis.ts) — the explanation is shown with the answer.
const LENS: Record<string, { label: string; question: string }> = {
  contradiction: {
    label: "Contradiction",
    question: "Did people describe the same thing in incompatible ways?",
  },
  continuity: {
    label: "Continuity",
    question: "Does this connect to something still open from earlier meetings?",
  },
  decision_gap: {
    label: "Decision gap",
    question: "What should have been decided here, but wasn't?",
  },
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

  const inProgress = meeting.status === "pending" || meeting.status === "processing";

  const [
    { projects },
    { data: findings, error: findingsError },
    { data: notes, error: notesError },
    { data: actions, error: actionsError },
    { data: stageRows },
  ] = await Promise.all([
    getProjectScope(supabase, workspaceId, null),
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
    inProgress
      ? supabase.from("ai_calls").select("stage").eq("meeting_id", id)
      : Promise.resolve({ data: [] as { stage: string }[] }),
  ]);
  const loadError = findingsError ?? notesError ?? actionsError;

  const findingsByType = new Map<string, NonNullable<typeof findings>>();
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
    <AppShell active="/meetings" projects={projects} projectId={meeting.project_id} wide>
      <PageHeader
        back={{ href: withProject("/meetings", meeting.project_id), label: project?.name ?? "Meetings" }}
        title={meeting.title}
        aside={<MeetingStatusBadge meetingId={meeting.id} initialStatus={meeting.status} />}
        subtitle={
          <Meta className="text-sm">
            <span className="capitalize">{meeting.meeting_type}</span>
            <time dateTime={meeting.occurred_at}>
              {new Date(meeting.occurred_at).toLocaleDateString(undefined, {
                weekday: "short",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </Meta>
        }
      />

      {inProgress && (
        <AnalysisProgress
          meetingId={meeting.id}
          initialDone={(stageRows ?? []).map((row) => row.stage)}
        />
      )}

      {meeting.status === "failed" && (
        <section className="max-w-2xl rounded-lg border border-accent/40 bg-status-serious-bg p-5">
          <h2 className={SECTION_TITLE}>The analysis didn&apos;t finish</h2>
          <p className="mt-1.5 text-sm text-secondary">
            {meeting.error_message ?? "One of the analysis steps failed."} Your transcript is saved, so
            you can run it again.
          </p>
          <div className="mt-4">
            <RetryButton meetingId={meeting.id} />
          </div>
        </section>
      )}

      {meeting.status === "completed" && (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="flex min-w-0 flex-col gap-12">
            {loadError && (
              <ErrorText>Could not load some of this meeting&apos;s data: {loadError.message}</ErrorText>
            )}

            {meeting.executive_summary && (
              <section aria-labelledby="summary-title">
                <h2 id="summary-title" className="sr-only">
                  Summary
                </h2>
                <p className="max-w-[62ch] text-lg leading-relaxed text-foreground">
                  {meeting.executive_summary}
                </p>
              </section>
            )}

            {actions && actions.length > 0 && (
              <section aria-labelledby="actions-title">
                <h2 id="actions-title" className={SECTION_TITLE}>
                  Suggested actions
                </h2>
                <ol className="mt-3 border-t border-border">
                  {actions.map((action, index) => (
                    <li
                      key={action.id}
                      className="flex items-start gap-4 border-b border-border py-3 text-sm"
                    >
                      <span className="w-4 shrink-0 pt-px text-xs tabular-nums text-muted">{index + 1}</span>
                      <span className="flex-1 text-foreground">{action.description}</span>
                      <Badge tone={PRIORITY_TONE[action.priority] ?? PRIORITY_TONE.medium}>
                        <span className="capitalize">{action.priority}</span>
                      </Badge>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section aria-labelledby="findings-title">
              <h2 id="findings-title" className={SECTION_TITLE}>
                Findings
              </h2>
              <div className="mt-3">
                <Tabs
                  label="Findings by type"
                  tabs={FINDING_TYPE_ORDER.map((type) => {
                    const items = findingsByType.get(type) ?? [];
                    return {
                      key: type,
                      label: FINDING_TYPE_LABEL[type],
                      count: items.length,
                      content:
                        items.length === 0 ? (
                          <p className="py-6 text-sm text-secondary">{FINDING_TYPE_EMPTY[type]}</p>
                        ) : (
                          <ul>
                            {items.map((finding) => {
                              const evidence = evidenceById.get(finding.id);
                              const firstLine = evidence ? evidence.lineIndexes[0] + 1 : null;
                              return (
                                <li key={finding.id} className="border-b border-border py-4 last:border-b-0">
                                  <div className="flex items-start justify-between gap-4">
                                    <p className="text-[0.95rem] leading-snug text-foreground">
                                      {finding.description}
                                    </p>
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
                                  {evidence && (
                                    <figure className="mt-3 flex gap-3">
                                      <a
                                        href={`#line-${firstLine}`}
                                        className="shrink-0 pt-0.5 text-xs tabular-nums text-accent-ink hover:underline"
                                        aria-label={`Go to transcript line ${firstLine}`}
                                      >
                                        L{firstLine}
                                      </a>
                                      <blockquote className="border-l border-border pl-3 font-serif text-[0.95rem] leading-relaxed text-secondary">
                                        {evidence.text}
                                      </blockquote>
                                    </figure>
                                  )}
                                  <div className="mt-3">
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
                                </li>
                              );
                            })}
                          </ul>
                        ),
                    };
                  })}
                />
              </div>
            </section>

            {notes && notes.length > 0 && (
              <section aria-labelledby="diagnosis-title">
                <h2 id="diagnosis-title" className={SECTION_TITLE}>
                  Diagnosis
                </h2>
                <p className="mt-1 text-sm text-secondary">
                  The same transcript read three ways, to surface what nobody said out loud.
                </p>
                <dl className="mt-4 border-t border-border">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="grid gap-x-6 gap-y-1 border-b border-border py-4 sm:grid-cols-[11rem_1fr]"
                    >
                      <dt>
                        <span className="text-sm font-medium text-foreground">
                          {LENS[note.lens]?.label ?? note.lens}
                        </span>
                        {LENS[note.lens] && (
                          <span className="mt-0.5 block text-xs leading-snug text-muted">
                            {LENS[note.lens].question}
                          </span>
                        )}
                      </dt>
                      <dd className="text-sm leading-relaxed text-secondary">{note.content}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>

          <aside aria-labelledby="transcript-title" className="min-w-0">
            <div className="rounded-lg border border-border bg-surface lg:sticky lg:top-8 lg:flex lg:max-h-[calc(100dvh-4rem)] lg:flex-col">
              <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
                <h2 id="transcript-title" className={SECTION_TITLE}>
                  Transcript
                </h2>
                <span className="text-xs text-muted">
                  {evidenceLines.size > 0
                    ? `${evidenceLines.size} of ${segments.length} lines cited`
                    : `${segments.length} lines`}
                </span>
              </div>
              <ol className="flex flex-col gap-0.5 p-2 lg:overflow-y-auto">
                {segments.map((line, index) => {
                  const { speaker, text } = splitSpeaker(line);
                  const cited = evidenceLines.has(index);
                  return (
                    <li
                      key={index}
                      id={`line-${index + 1}`}
                      className={`transcript-line grid scroll-mt-20 grid-cols-[1.75rem_1fr] gap-1 rounded px-2 py-2 ${
                        cited ? "shadow-[inset_2px_0_0_var(--accent)]" : ""
                      }`}
                    >
                      <span className="pt-0.5 text-[0.7rem] tabular-nums text-muted">{index + 1}</span>
                      <p className={`font-serif text-[0.95rem] leading-relaxed ${cited ? "text-foreground" : "text-secondary"}`}>
                        {speaker && (
                          <span className="block font-sans text-xs font-medium text-muted">{speaker}</span>
                        )}
                        {text}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
