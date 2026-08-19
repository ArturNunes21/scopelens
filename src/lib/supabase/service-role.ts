import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Only for the AI pipeline's own writes
// (findings/diagnostic_notes/suggested_actions/ai_calls), and only after the
// caller's workspace membership has already been verified with the user-scoped
// client (ARCHITECTURE.md section 2 auth pattern, resolves GAPS.md G9).
// Never import this into a route that hasn't done that check first.
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
