"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { requestMagicLink } from "./actions";
import { buttonClass, ErrorText, FIELD_CLASS, Wordmark } from "@/components/ui";

const LINK_ERROR_MESSAGES: Record<string, string> = {
  // Most common cause isn't the user reusing a link — it's their email
  // provider's security scanner pre-fetching it and consuming the
  // single-use token before a human ever clicks. Naming that keeps a
  // first-time visitor from assuming the app itself is broken.
  invalid_link:
    "That sign-in link expired, or your email provider's security scanner opened it first. Request a new one below and click it right away.",
};

function LinkError() {
  const searchParams = useSearchParams();
  const code = searchParams.get("error");
  if (!code) return null;

  return (
    <p className="mt-6 rounded border-l-2 border-accent bg-status-serious-bg px-3 py-2 text-sm text-foreground">
      {LINK_ERROR_MESSAGES[code] ?? "Something went wrong with that link. Request a new one below."}
    </p>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(requestMagicLink, {
    error: null,
    sent: false,
  });

  return (
    <div className="flex flex-1 flex-col px-4 sm:px-8">
      <header className="flex h-16 items-center">
        <Link href="/" aria-label="ScopeLens home">
          <Wordmark />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-24">
        <h1 className="font-display text-3xl text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-secondary">
          We&apos;ll email you a sign-in link, no password needed. Once in, you can load a sample
          project to look around.
        </p>

        <Suspense fallback={null}>
          <LinkError />
        </Suspense>

        {state.sent ? (
          <div role="status" className="mt-8 rounded-lg border border-border bg-surface p-5">
            <p className="text-sm font-medium text-foreground">Check your inbox</p>
            <p className="mt-1 text-sm text-secondary">
              The link signs you in on this device. It can take a minute to arrive.
            </p>
          </div>
        ) : (
          <form action={formAction} className="mt-8 flex flex-col gap-3">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className={FIELD_CLASS}
            />
            <button type="submit" disabled={pending} className={buttonClass("primary", "mt-1")}>
              {pending ? "Sending…" : "Email me a sign-in link"}
            </button>
            {state.error && <ErrorText>{state.error}</ErrorText>}
          </form>
        )}
      </main>
    </div>
  );
}
