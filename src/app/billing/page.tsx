import { requireWorkspace } from "@/lib/workspace";
import { getFreePlanMeetingLimit } from "@/lib/billing";
import { getProjectScope } from "@/lib/projects";
import { createCheckoutSession, openBillingPortal } from "./actions";
import { AppShell } from "@/components/app-shell";
import { Badge, buttonClass, CARD, PageHeader, SECTION_TITLE } from "@/components/ui";

const STATUS_MESSAGE: Record<string, { text: string; tone: "ok" | "error" }> = {
  success: { text: "Upgrade complete. Pro is now active.", tone: "ok" },
  canceled: { text: "Checkout canceled. You're still on the free plan.", tone: "error" },
  not_configured: { text: "Billing isn't configured yet: the Stripe price is missing.", tone: "error" },
  checkout_failed: { text: "Could not start checkout. Try again.", tone: "error" },
  portal_unavailable: { text: "Could not open subscription management. Try again in a moment.", tone: "error" },
};

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const { supabase, workspaceId } = await requireWorkspace();
  const params = await searchParams;
  const statusKey = params.success ? "success" : (params.error as string | undefined) ?? (params.canceled ? "canceled" : undefined);
  const status = statusKey ? STATUS_MESSAGE[statusKey] : undefined;

  const [{ projects }, { data: workspace }] = await Promise.all([
    getProjectScope(supabase, workspaceId, null),
    supabase.from("workspaces").select("plan").eq("id", workspaceId).single(),
  ]);
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
  const used = meetingsThisMonth ?? 0;

  return (
    <AppShell active="/billing" projects={projects} projectId={null}>
      <div className="max-w-2xl">
        <PageHeader title="Plan and billing" />

        {status && (
          <p
            role="status"
            className={`mb-6 text-sm ${status.tone === "ok" ? "text-status-good" : "text-status-critical"}`}
          >
            {status.text}
          </p>
        )}

        <section className={CARD}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={SECTION_TITLE}>Current plan</h2>
              <p className="mt-1 text-sm text-secondary">
                {plan === "pro" ? "Unlimited meetings each month." : `${limit} analyzed meetings each month.`}
              </p>
            </div>
            <Badge tone={plan === "pro" ? "good" : "neutral"}>{plan === "pro" ? "Pro" : "Free"}</Badge>
          </div>

          {plan === "pro" && (
            <form action={openBillingPortal} className="mt-6 flex flex-wrap items-center gap-3">
              <button type="submit" className={buttonClass("secondary")}>
                Manage subscription
              </button>
              <span className="text-xs text-secondary">Cancel, update your card, or see invoices.</span>
            </form>
          )}

          {plan !== "pro" && (
            <>
              <div className="mt-5">
                <div className="flex justify-between text-xs tabular-nums text-secondary">
                  <span>Used this month</span>
                  <span>
                    {used} of {limit}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${used >= limit ? "bg-accent" : "bg-foreground"}`}
                    style={{ width: `${Math.min(100, (used / Math.max(limit, 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <form action={createCheckoutSession} className="mt-6 flex flex-wrap items-center gap-3">
                <button type="submit" className={buttonClass("primary")}>
                  Upgrade to Pro
                </button>
                <span className="text-xs text-secondary">Stripe test mode, no real charge.</span>
              </form>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
