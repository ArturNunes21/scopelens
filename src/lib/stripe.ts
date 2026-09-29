import Stripe from "stripe";

let cached: Stripe | null = null;

// Lazily constructed — STRIPE_SECRET_KEY doesn't exist until the account is
// created (SETUP.md, "doesn't block Phase 0"), so importing this module
// anywhere must not throw before a route actually needs the client.
export function getStripeClient(): Stripe {
  if (!cached) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    cached = new Stripe(key);
  }
  return cached;
}
