"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createProject,
  deleteProject,
  renameProject,
  setProjectSharing,
  type ProjectFormState,
} from "./actions";
import { buttonClass, ErrorText, FIELD_CLASS } from "@/components/ui";

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(
    createProject,
    { error: null }
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="name"
        required
        maxLength={80}
        placeholder="New project name"
        aria-label="New project name"
        className={`${FIELD_CLASS} min-w-0 flex-1`}
      />
      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Creating…" : "Create project"}
      </button>
      {state.error && <ErrorText>{state.error}</ErrorText>}
    </form>
  );
}

export function RenameProject({ projectId, name }: { projectId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-secondary hover:text-foreground"
      >
        Rename
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await renameProject(projectId, value);
          setEditing(false);
        });
      }}
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={80}
        aria-label="Project name"
        className={`${FIELD_CLASS} py-1 text-xs`}
      />
      <button type="submit" disabled={isPending} className={buttonClass("primary", "py-1 text-xs")}>
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setEditing(false);
        }}
        className={buttonClass("ghost", "py-1 text-xs")}
      >
        Cancel
      </button>
    </form>
  );
}

export function DeleteProject({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteProject(projectId))}
      className="text-xs text-secondary hover:text-status-critical disabled:opacity-50"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}

// Public read-only status report link (/share/[token]). Disabling clears the
// token; re-enabling mints a new one, so an old link stops working.
export function ShareControls({
  projectId,
  shareUrl,
}: {
  projectId: string;
  shareUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  if (!shareUrl) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => setProjectSharing(projectId, true))}
        className={buttonClass("secondary", "py-1 text-xs")}
      >
        {isPending ? "…" : "Create public status link"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={shareUrl}
        aria-label="Public status link"
        onFocus={(event) => event.target.select()}
        className={`${FIELD_CLASS} min-w-0 flex-1 py-1 font-mono text-xs`}
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className={buttonClass("secondary", "py-1 text-xs")}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <a
        href={shareUrl}
        target="_blank"
        rel="noreferrer"
        className={buttonClass("ghost", "py-1 text-xs")}
      >
        Open
      </a>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => setProjectSharing(projectId, false))}
        className="text-xs text-secondary hover:text-status-critical disabled:opacity-50"
      >
        Revoke
      </button>
    </div>
  );
}
