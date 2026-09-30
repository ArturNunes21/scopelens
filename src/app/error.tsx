"use client";

import Link from "next/link";

// App-level error boundary (Next.js convention): catches anything an RSC or
// server action throws instead of the framework's default error screen.
// Only reaches this for unexpected throws — the pages themselves catch and
// render inline errors for known Supabase query failures.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          An unexpected error occurred. You can try again, or head back to your meetings.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Try again
          </button>
          <Link
            href="/meetings"
            className="text-sm font-medium text-black underline underline-offset-4 dark:text-zinc-50"
          >
            Back to meetings
          </Link>
        </div>
      </div>
    </div>
  );
}
