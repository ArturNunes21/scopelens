import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the magic-link redirect: exchanges the token_hash for a session,
// then sends the user on to the app (or back to /login on failure).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }

    // Logged server-side only (Vercel function logs) — never shown to the
    // user, but needed to tell "link already used/expired" apart from a
    // config bug while diagnosing the magic-link flow.
    console.error("Magic-link verifyOtp failed:", error.code, error.message);
  } else {
    console.error("Magic-link callback missing token_hash/type", {
      hasTokenHash: Boolean(token_hash),
      type,
    });
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
