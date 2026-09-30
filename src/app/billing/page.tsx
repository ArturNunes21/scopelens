import { requireWorkspace } from "@/lib/workspace";
import { getFreePlanMeetingLimit } from "@/lib/billing";
import { createCheckoutSession } from "./actions";
import { AppHeader, Badge, buttonClass, CARD } from "@/components/ui";

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
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
        <AppHeader title="Billing" active="/billing" />

        {status && (
          <p className={`mt-4 text-sm ${status.tone === "ok" ? "text-status-good" : "text-status-critical"}`}>
            {status.text}
          </p>
        )}

        <div className={`mt-6 ${CARD}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Current plan</p>
              <p className="mt-1 text-xs text-secondary">
                {plan === "pro"
                  ? "Pro — unlimited meetings/month."
                  : `Free — ${meetingsThisMonth ?? 0}/${limit} meetings used this month.`}
              </p>
            </div>
            <Badge tone={plan === "pro" ? "good" : "neutral"}>{plan === "pro" ? "Pro" : "Free"}</Badge>
          </div>

          {plan !== "pro" && (
            <form action={createCheckoutSession} className="mt-4">
              <button type="submit" className={buttonClass("primary")}>
                Upgrade to Pro
              </button>
              <span className="ml-3 text-xs text-secondary">
                Stripe Checkout, test mode — no real charge.
              </span>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
