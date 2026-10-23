"use client";

import { useState, useTransition } from "react";
import { updateFindingAssignment } from "../actions";
import { FIELD_CLASS, buttonClass } from "@/components/ui";

// Phase 9 — owner + due date on a finding, edited inline. The owner may have
// been extracted by the AI pipeline already; the due date is always set by
// hand (no extra AI cost).
export function FindingAssignment({
  findingId,
  owner,
  dueDate,
  overdue,
}: {
  findingId: string;
  owner: string | null;
  dueDate: string | null;
  overdue: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [ownerValue, setOwnerValue] = useState(owner ?? "");
  const [dueValue, setDueValue] = useState(dueDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={owner ? "text-secondary" : "text-muted"}>
          {owner ? (
            <>
              <span className="text-muted">Owner</span> {owner}
            </>
          ) : (
            "No owner"
          )}
        </span>
        {dueDate && (
          <span className={overdue ? "font-medium text-status-critical" : "text-secondary"}>
            {overdue ? "Overdue since " : "Due "}
            {dueDate}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-accent-ink hover:underline"
        >
          {owner || dueDate ? "Edit" : "Assign"}
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateFindingAssignment(findingId, ownerValue, dueValue);
          setError(result.error);
          if (!result.error) setEditing(false);
        });
      }}
    >
      <input
        aria-label="Owner"
        value={ownerValue}
        onChange={(event) => setOwnerValue(event.target.value)}
        placeholder="Owner"
        maxLength={80}
        className={`${FIELD_CLASS} w-36 py-1 text-xs`}
      />
      <input
        aria-label="Due date"
        type="date"
        value={dueValue}
        onChange={(event) => setDueValue(event.target.value)}
        className={`${FIELD_CLASS} py-1 text-xs`}
      />
      <button type="submit" disabled={isPending} className={buttonClass("primary", "py-1 text-xs")}>
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOwnerValue(owner ?? "");
          setDueValue(dueDate ?? "");
          setError(null);
          setEditing(false);
        }}
        className={buttonClass("ghost", "py-1 text-xs")}
      >
        Cancel
      </button>
      {error && <span className="text-xs text-status-critical">{error}</span>}
    </form>
  );
}
