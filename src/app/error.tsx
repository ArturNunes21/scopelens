"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui";

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
    <div className="flex flex-1 items-center px-4 sm:px-8">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-3xl text-foreground">This page didn&apos;t load</h1>
        <p className="mt-2 text-sm text-secondary">
          Something unexpected failed on our side. Your data is safe. Try again, or go back to your
          meetings.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={reset} className={buttonClass("primary")}>
            Try again
          </button>
          <Link href="/meetings" className={buttonClass("secondary")}>
            Back to meetings
          </Link>
        </div>
      </div>
    </div>
  );
}
