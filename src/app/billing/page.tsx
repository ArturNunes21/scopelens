import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { getFreePlanMeetingLimit } from "@/lib/billing";
import { createCheckoutSession } from "./actions";

const STATUS_MESSAGE: Record<string, { text: string; tone: "ok" | "error" }> = {
  success: { text: "Upgrade complete — Pro is now active.", tone: "ok" },
  canceled: { text: "Checkout canceled — still on the free plan.", tone: "error" },
  not_configured: { text: "Billing isn't configured yet — missing Stripe price.", tone: "error" },
  checkout_failed: { text: "Could not start checkout. Try again.", tone: "error" },
};

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const { supabase, workspaceId } = await requireWorkspace();
  const params = await searchParams;
  const statusKey = params.success ? "success" : (params.error as string | undefined) ?? (params.canceled ? "canceled" : undefined);
  const status = statusKey ? STATUS_MESSAGE[statusKey] : undefined;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("plan")
    .eq("id", workspaceId)
    .single();
  const plan = workspace?.plan ?? "free";

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: meetingsThisMonth } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", monthStart.toISOString());

  const limit = getFreePlanMeetingLimit();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Billing</h1>
          <Link
            href="/meetings"
            className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Meetings
          </Link>
        </div>

        {status && (
          <p
            className={`mt-4 text-sm ${
              status.tone === "ok"
                ? "text-green-700 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {status.text}
          </p>
        )}

        <div className="mt-6 rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-black dark:text-zinc-50">
                Current plan
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {plan === "pro"
                  ? "Pro — unlimited meetings/month."
                  : `Free — ${meetingsThisMonth ?? 0}/${limit} meetings used this month.`}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                plan === "pro"
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {plan === "pro" ? "Pro" : "Free"}
            </span>
          </div>

          {plan !== "pro" && (
            <form action={createCheckoutSession} className="mt-4">
              <button
                type="submit"
                className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                Upgrade to Pro
              </button>
              <span className="ml-3 text-xs text-zinc-500 dark:text-zinc-400">
                Stripe Checkout, test mode — no real charge.
              </span>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
