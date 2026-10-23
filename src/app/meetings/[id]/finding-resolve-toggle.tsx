"use client";

import { useTransition } from "react";
import { toggleFindingStatus } from "../actions";

export function FindingResolveToggle({
  findingId,
  status,
}: {
  findingId: string;
  status: "open" | "resolved";
}) {
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "resolved" ? "open" : "resolved";

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => toggleFindingStatus(findingId, nextStatus))
      }
      title={status === "resolved" ? "Reopen" : undefined}
      className={`shrink-0 rounded px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50 ${
        status === "resolved"
          ? "bg-status-good-bg text-status-good hover:opacity-80"
          : "border border-border text-secondary hover:border-secondary hover:text-foreground"
      }`}
    >
      {isPending ? "…" : status === "resolved" ? "Resolved" : "Mark resolved"}
    </button>
  );
}
