import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// User-scoped client, bound to the session cookie — respects RLS.
// Use for anything the calling user should only see/touch via workspace membership
// (ARCHITECTURE.md section 2 auth pattern, resolves GAPS.md G9).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware
            // is refreshing the session.
          }
        },
      },
    }
  );
}
