import { PostHog } from "posthog-node";

let client: PostHog | null = null;

export function getPostHogServerClient(): PostHog | null {
  const key = process.env.POSTHOG_KEY;
  if (!key) return null;

  if (!client) {
    client = new PostHog(key, {
      host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return client;
}
