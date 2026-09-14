"use client";

import { useTransition } from "react";
import { retryMeeting } from "../actions";

export function RetryButton({ meetingId }: { meetingId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => retryMeeting(meetingId))}
      className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
    >
      {isPending ? "Retrying…" : "Retry"}
    </button>
  );
}
