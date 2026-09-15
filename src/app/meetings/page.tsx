import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { signOut } from "@/app/login/logout-action";
import { STATUS_LABEL, STATUS_CLASS } from "./status";

export default async function MeetingsPage() {
  const { supabase, workspaceId } = await requireWorkspace();

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id, title, meeting_type, status, occurred_at")
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
            Meetings
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Dashboard
            </Link>
            <Link
              href="/meetings/new"
              className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              New meeting
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Could not load meetings: {error.message}
            </p>
          )}

          {!error && meetings && meetings.length === 0 && (
            <div className="rounded-lg border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No meetings yet — paste or upload a transcript to get started.
              </p>
              <Link
                href="/meetings/new"
                className="mt-4 inline-block text-sm font-medium text-black underline underline-offset-4 dark:text-zinc-50"
              >
                New meeting
              </Link>
            </div>
          )}

          {!error && meetings && meetings.length > 0 && (
            <ul className="flex flex-col gap-2">
              {meetings.map((meeting) => (
                <li key={meeting.id}>
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="flex items-center justify-between rounded-lg border border-black/[.08] bg-white px-4 py-3 transition-colors hover:border-black/[.16] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:border-white/[.29]"
                  >
                    <div>
                      <p className="text-sm font-medium text-black dark:text-zinc-50">
                        {meeting.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {meeting.meeting_type} ·{" "}
                        {new Date(meeting.occurred_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_CLASS[meeting.status] ?? STATUS_CLASS.pending
                      }`}
                    >
                      {STATUS_LABEL[meeting.status] ?? meeting.status}
                    </span>
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
