import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { seedDemoData } from "./actions";
import { STATUS_LABEL, STATUS_TONE } from "./status";
import { AppHeader, Badge, buttonClass, EmptyState, ErrorText } from "@/components/ui";

export default async function MeetingsPage() {
  const { supabase, workspaceId } = await requireWorkspace();

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id, title, meeting_type, status, occurred_at")
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <AppHeader
          title="Meetings"
          active="/meetings"
          actions={
            <Link href="/meetings/new" className={buttonClass("primary")}>
              New meeting
            </Link>
          }
        />

        <div className="mt-8">
          {error && <ErrorText>Could not load meetings: {error.message}</ErrorText>}

          {!error && meetings && meetings.length === 0 && (
            <EmptyState message="No meetings yet — paste or upload a transcript to get started.">
              <Link
                href="/meetings/new"
                className="text-sm font-medium text-foreground underline underline-offset-4"
              >
                New meeting
              </Link>
              <span className="text-sm text-muted">or</span>
              <form action={seedDemoData}>
                <button
                  type="submit"
                  className="text-sm font-medium text-foreground underline underline-offset-4"
                >
                  Load sample data
                </button>
              </form>
            </EmptyState>
          )}

          {!error && meetings && meetings.length > 0 && (
            <ul className="flex flex-col gap-2">
              {meetings.map((meeting) => (
                <li key={meeting.id}>
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                      <p className="mt-0.5 text-xs text-secondary">
                        {meeting.meeting_type} ·{" "}
                        {new Date(meeting.occurred_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[meeting.status] ?? STATUS_TONE.pending}>
                      {STATUS_LABEL[meeting.status] ?? meeting.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
