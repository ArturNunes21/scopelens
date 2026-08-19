"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { requestMagicLink } from "./actions";

const LINK_ERROR_MESSAGES: Record<string, string> = {
  invalid_link:
    "This sign-in link is invalid or has already been used — request a new one below.",
};

function LinkError() {
  const searchParams = useSearchParams();
  const code = searchParams.get("error");
  if (!code) return null;

  return (
    <p className="mb-4 text-sm text-red-600 dark:text-red-400">
      {LINK_ERROR_MESSAGES[code] ?? "Something went wrong with that link — try again."}
    </p>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(requestMagicLink, {
    error: null,
    sent: false,
  });

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Sign in to ScopeLens
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          We&apos;ll email you a magic link — no password needed.
        </p>

        <Suspense fallback={null}>
          <div className="mt-4">
            <LinkError />
          </div>
        </Suspense>

        {state.sent ? (
          <p className="mt-6 text-sm text-zinc-700 dark:text-zinc-300">
            Check your inbox for the sign-in link.
          </p>
        ) : (
          <form action={formAction} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              name="email"
              required
              placeholder="you@company.com"
              className="rounded border border-black/[.08] bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/30"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              {pending ? "Sending…" : "Send magic link"}
            </button>
            {state.error && (
              <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
