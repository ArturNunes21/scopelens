"use client";

import Link from "next/link";
import { buttonClass, CARD_CENTERED } from "@/components/ui";

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
    <div className="flex flex-1 items-center justify-center bg-background">
      <div className={`w-full max-w-sm ${CARD_CENTERED}`}>
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-secondary">
          An unexpected error occurred. You can try again, or head back to your meetings.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <button type="button" onClick={reset} className={buttonClass("primary")}>
            Try again
          </button>
          <Link
            href="/meetings"
            className="text-sm font-medium text-foreground underline underline-offset-4"
          >
            Back to meetings
          </Link>
        </div>
      </div>
    </div>
  );
}
