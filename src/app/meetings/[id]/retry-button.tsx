"use client";

import { useTransition } from "react";
import { retryMeeting } from "../actions";
import { buttonClass } from "@/components/ui";

export function RetryButton({ meetingId }: { meetingId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => retryMeeting(meetingId))}
      className={buttonClass("primary")}
    >
      {isPending ? "Retrying…" : "Retry"}
    </button>
  );
}
