# Account and Credential Setup

Step-by-step to unblock Phase 0 of ROADMAP.md (and what comes after). Each section says where to click and which `.env.example` variable to paste the result into. None of these accounts exist yet.

## Recommended order

The first four items unblock Phase 0. The last two only matter for Phases 3 and 7 — they can wait.

### 1. Vercel (hosting)

1. Go to [vercel.com](https://vercel.com) → **Sign Up** → sign in with the `ArturNunes21` GitHub account.
2. **Add New → Project** → select the `scopelens` repository.
3. Vercel auto-detects Next.js. No extra config needed yet — no env var is required for the first deploy (Sentry/PostHog stay inert without a key).
4. **Deploy.** This already produces the public URL (e.g. `scopelens.vercel.app`).
5. Once the PR is merged into `main`, every push to it becomes a production deploy automatically; other branches produce preview deploys.

### 2. Supabase (database/auth)

1. Go to [supabase.com](https://supabase.com) → **Sign Up** with GitHub.
2. **New Project** → choose a name (`scopelens`), a database password (save it), and the closest region.
3. Wait for provisioning (~2 min).
4. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (never expose on the client)
5. **Anti-pause pinger (GAPS.md G16):** don't rely solely on a GitHub Actions cron — GitHub auto-disables scheduled workflows after 60 days of repo inactivity, which would silently let the free-tier project pause anyway. Instead:
   1. Go to [cron-job.org](https://cron-job.org) (or [UptimeRobot](https://uptimerobot.com)) → create a free account.
   2. Create a new monitor/cron job hitting `GET https://<your-vercel-domain>/api/health` (e.g. `https://scopelens-five.vercel.app/api/health`).
   3. Set the interval to a few hours (Supabase free-tier pauses after 7 days of no activity, so even a once-a-day hit is enough — more frequent just gives faster failure detection).
   4. The route runs a trivial query against Supabase and returns `{ status: "ok", db: true }` — confirm you get a 200 after setting it up.

### 3. Sentry (errors)

1. Go to [sentry.io](https://sentry.io) → **Sign Up**.
2. **Create Project** → platform **Next.js**.
3. The post-creation screen shows the **DSN** (`https://...@...ingest.sentry.io/...`).
4. Paste the same value into `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`.

### 4. PostHog (analytics)

1. Go to [posthog.com](https://posthog.com) → **Sign Up** (choose US or EU region — this changes the host).
2. Create a project (`scopelens`).
3. Go to **Project Settings → Project API Key**, copy:
   - the key → `POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_KEY`
   - the region's host → `POSTHOG_HOST` and `NEXT_PUBLIC_POSTHOG_HOST` (`https://us.i.posthog.com` or `https://eu.i.posthog.com`)

### 5. Anthropic / Claude API (Phase 3 — AI extraction, doesn't block Phase 0)

1. Go to [console.anthropic.com](https://console.anthropic.com) → create an account.
2. **API Keys → Create Key**.
3. Paste it into `ANTHROPIC_API_KEY`.

### 6. Stripe (Phase 7 — billing, doesn't block Phase 0)

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → create an account.
2. Make sure the **Test mode** toggle is on (top corner).
3. **Developers → API keys**, copy the test keys (`sk_test_...`, `pk_test_...`) into `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. `STRIPE_WEBHOOK_SECRET` is only generated once the webhook endpoint exists (that happens when Phase 7 is implemented).

## After collecting the keys

Two copies need to exist:
- **Local:** `.env.local` at the repo root (never committed — already in `.gitignore`).
- **Vercel:** Project Settings → Environment Variables, paste the same keys (otherwise the production deploy has no access to them).

Once filled in, let me know — I'll confirm the app picks up the variables (Sentry/PostHog leave inert mode) and we move on with the rest of Phase 0.
