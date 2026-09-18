import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Stripe Checkout webhook (ARCHITECTURE.md section 3 "Billing", resolves
// GAPS.md G20). Two requirements, in order: verify the signature before
// trusting anything in the payload, then dedupe by event.id before applying
// it — Stripe retries delivery on anything short of a 2xx response, so the
// same event can arrive more than once.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Insert-first dedupe: event.id is the primary key, so a second delivery
  // of the same event hits a unique-violation here and is acknowledged
  // without being processed again. Inserting before processing (not after)
  // means a crash mid-processing can still drop an event rather than
  // double-apply it — acceptable for this handler, since every branch below
  // is a plain field update, not something that compounds if it's ever lost.
  const { error: dedupeError } = await supabase
    .from("stripe_webhook_events")
    .insert({ id: event.id });
  if (dedupeError) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.client_reference_id;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (workspaceId && customerId && subscriptionId) {
        await supabase
          .from("workspaces")
          .update({
            plan: "pro",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq("id", workspaceId);
      }
      break;
    }

    // Covers both an active subscription lapsing (payment failure, etc.) and
    // an explicit cancellation — either way the workspace's plan should
    // reflect the subscription's actual current status, not just "canceled
    // event happened".
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const isActive = subscription.status === "active" || subscription.status === "trialing";

      await supabase
        .from("workspaces")
        .update({ plan: isActive ? "pro" : "free" })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
