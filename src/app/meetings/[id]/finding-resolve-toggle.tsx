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
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        status === "resolved"
          ? "bg-status-good-bg text-status-good hover:opacity-80"
          : "bg-black/[.05] text-secondary hover:bg-black/[.08] dark:bg-white/[.08] dark:hover:bg-white/[.12]"
      }`}
    >
      {isPending ? "…" : status === "resolved" ? "Resolved" : "Mark resolved"}
    </button>
  );
}
