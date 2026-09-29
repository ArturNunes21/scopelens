"use server";

import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { getStripeClient } from "@/lib/stripe";

// Stripe Checkout in test mode (ROADMAP.md Phase 7). The webhook
// (src/app/api/stripe/webhook/route.ts) is what actually flips
// workspaces.plan — this action only starts the Checkout Session and
// redirects; it never writes plan/subscription state itself, since the user
// can always abandon Checkout before payment.
export async function createCheckoutSession(): Promise<void> {
  const { supabase, workspaceId } = await requireWorkspace();

  const priceId = process.env.STRIPE_PRICE_ID_PRO;
  if (!priceId) redirect("/billing?error=not_configured");

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", workspaceId)
    .single();
  if (error || !workspace) redirect("/billing?error=not_configured");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    // Reuse the existing Stripe customer if this workspace already has one
    // (e.g. a prior canceled subscription) instead of creating a duplicate.
    customer: workspace.stripe_customer_id ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/billing?success=1`,
    cancel_url: `${siteUrl}/billing?canceled=1`,
    // Read by the webhook to know which workspace to upgrade — Checkout
    // Sessions don't otherwise carry any app-specific identity.
    client_reference_id: workspaceId,
    metadata: { workspace_id: workspaceId },
    subscription_data: { metadata: { workspace_id: workspaceId } },
  });

  if (!session.url) redirect("/billing?error=checkout_failed");
  redirect(session.url);
}
