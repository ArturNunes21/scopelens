"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { requestMagicLink } from "./actions";
import { buttonClass, CARD, ErrorText, FIELD_CLASS } from "@/components/ui";

const LINK_ERROR_MESSAGES: Record<string, string> = {
  // Most common cause isn't the user reusing a link — it's their email
  // provider's security scanner pre-fetching it and consuming the
  // single-use token before a human ever clicks. Naming that keeps a
  // first-time visitor from assuming the app itself is broken.
  invalid_link:
    "This sign-in link already expired or was pre-opened by your email provider's security scanner — just request a new one below and click it right away.",
};

function LinkError() {
  const searchParams = useSearchParams();
  const code = searchParams.get("error");
  if (!code) return null;

  return (
    <p className="mb-4 text-sm text-status-critical">
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
    <div className="flex flex-1 items-center justify-center bg-background">
      <div className={`w-full max-w-sm ${CARD}`}>
        <h1 className="text-xl font-semibold text-foreground">Sign in to ScopeLens</h1>
        <p className="mt-2 text-sm text-secondary">
          We&apos;ll email you a magic link — no password needed.
        </p>

        <Suspense fallback={null}>
          <div className="mt-4">
            <LinkError />
          </div>
        </Suspense>

        {state.sent ? (
          <p className="mt-6 text-sm text-secondary">Check your inbox for the sign-in link.</p>
        ) : (
          <form action={formAction} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              name="email"
              required
              placeholder="you@company.com"
              className={FIELD_CLASS}
            />
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "Sending…" : "Send magic link"}
            </button>
            {state.error && <ErrorText>{state.error}</ErrorText>}
          </form>
        )}
      </div>
    </div>
  );
}
