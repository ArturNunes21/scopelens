"use client";

import { useTransition } from "react";
import { setDecisionStatus } from "@/app/meetings/actions";

// Phase 9 — decisions' counterpart to FindingResolveToggle: their lifecycle
// is decision_status (pending -> taken), not status.
export function DecisionStatusToggle({
  findingId,
  status,
}: {
  findingId: string;
  status: "taken" | "pending";
}) {
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "taken" ? "pending" : "taken";

  return (
    <button
      type="button"
      disabled={isPending}
      title={status === "taken" ? "Mark as still pending" : "Mark as decided"}
      onClick={() => startTransition(() => setDecisionStatus(findingId, nextStatus))}
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        status === "taken"
          ? "bg-status-good-bg text-status-good hover:opacity-80"
          : "bg-status-warning-bg text-[#8a5a00] hover:opacity-80 dark:text-status-warning"
      }`}
    >
      {isPending ? "…" : status === "taken" ? "Decided" : "Pending — mark decided"}
    </button>
  );
}
