import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Lightweight health check — also serves as the anti-pause pinger target
// (resolves GAPS.md G16): a trivial query keeps the Supabase free-tier
// project from auto-pausing due to inactivity. Point an external pinger
// (cron-job.org, UptimeRobot) at this route every few hours.
export async function GET() {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("workspaces").select("id").limit(1);

  if (error) {
    return NextResponse.json({ status: "error", db: false }, { status: 503 });
  }

  return NextResponse.json({ status: "ok", db: true });
}
