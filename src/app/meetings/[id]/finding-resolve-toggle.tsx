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
          ? "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {isPending ? "…" : status === "resolved" ? "Resolved" : "Mark resolved"}
    </button>
  );
}
