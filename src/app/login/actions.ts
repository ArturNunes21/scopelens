"use server";

import { createClient } from "@/lib/supabase/server";

export async function requestMagicLink(
  _prevState: { error: string | null; sent: boolean },
  formData: FormData
) {
  const email = formData.get("email");

  if (typeof email !== "string" || !email) {
    return { error: "Enter a valid email.", sent: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message, sent: false };
  }

  return { error: null, sent: true };
}
