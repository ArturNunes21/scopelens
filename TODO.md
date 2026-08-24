# TODO — ScopeLens

Mirrors the phases in [`ROADMAP.md`](./ROADMAP.md). Check items off here as they close; reference the item number in the commit/PR message (e.g. "closes Phase 0 #4-#6").

## Phase 0.5 — Spec review gap remediation ([GAPS.md](./GAPS.md))

- [x] G1-G14, G17-G20: doc-level fixes applied to ARCHITECTURE.md/PRD.md/ROADMAP.md/CONTEXT.md
- [ ] G15: verify real Vercel `maxDuration` once the account exists (blocks nothing now, revisit before Phase 5)
- [x] G16: external anti-pause pinger configured (cron-job.org → `/api/health`)

## Phase 0 — Foundation and instrumentation

- [x] 1. Next.js scaffold (TypeScript, Tailwind, App Router)
- [x] 2. GitHub Actions CI (lint + typecheck + build)
- [x] 3. Sentry + PostHog instrumentation in code (env-gated, inert without a key)
- [x] 4. Local Supabase CLI config + versioned migrations folder
- [x] 5. Create accounts: Vercel, Supabase, Sentry, PostHog (see `SETUP.md`)
- [x] 6. Initial deploy on Vercel (public URL live)
- [x] 7. Validate: a deliberate production error shows up in Sentry
- [x] 8. Validate: a pageview event shows up in PostHog

## Phase 1 — Authentication and multi-tenancy

- [x] Supabase Auth (magic link) — verified end-to-end in production (2026-08-24)
- [x] Trigger that auto-creates a workspace + workspace_members on signup
- [x] RLS enabled on every domain table
- [x] Automated cross-tenant isolation test

## Phase 2 — Meeting ingestion (no AI)

- [x] Design pass: tokens (palette, typography, spacing, signature element) captured in [`DESIGN.md`](./DESIGN.md) from the `/meetings` screens, reviewed with the `web-design-guidelines` skill (installed skill is a compliance reviewer, not a token generator — `frontend-design` as originally named doesn't exist as such)
- [x] Paste-text / upload `.txt`/`.vtt` UI (`/meetings/new`)
- [x] `meetings` table (already in the Phase 1 schema), listing/history per workspace (`/meetings`)
- [x] Verified end-to-end locally (2026-08-24): paste + `.txt` + `.vtt` upload (VTT cue/timestamp stripping confirmed in `transcript_raw`), 50k-char cap rejected client- and server-side, empty-state, cross-workspace isolation (second workspace sees zero meetings from the first), unauthenticated `/meetings` redirects to `/login`, `npm run test` (RLS) green

## Phase 3 — Structured extraction (AI pipeline stage 1)

- [ ] Claude API integration (structured output)
- [ ] `findings` population
- [ ] `ai_calls` logging (cost/latency)

## Phase 4 — Cross-meeting recurrence

- [ ] `pg_trgm` matching
- [ ] `recurrence_group_id` assignment
- [ ] Test with synthetic meetings (no false positives)

## Phase 5 — Multi-perspective diagnosis and synthesis (stages 2-3)

- [ ] Diagnostic lenses → `diagnostic_notes`
- [ ] Executive synthesis → `executive_summary` + `suggested_actions`
- [ ] Full async flow (status + Supabase Realtime)

## Phase 6 — Trend dashboard

- [ ] Query aggregated by `recurrence_group_id`

## Phase 7 — Billing

- [ ] Stripe Checkout (test mode) + webhook
- [ ] Feature gate by plan

## Phase 8 — Hardening for public portfolio use

- [ ] Empty/error states, seeded demo data
- [ ] README telling the project's story
- [ ] Custom domain (optional)
- [ ] Known issue found during Phase 2 manual testing (2026-08-24): Supabase's default email provider routes magic links through Amazon SES click-tracking (`awstrack.me`); an email security scanner can pre-fetch the link and consume the single-use OTP token before the human clicks, producing an intermittent `invalid_link` on first attempt (a retry always works). A first-contact recruiter hitting this with no guidance is a real risk — before shipping, either configure custom SMTP without click-tracking or add explicit "try again" messaging to the `invalid_link` state

---

Out of the roadmap for now (post-MVP, `PRD.md` section 8.2): multi-format source ingestion (PDF/Markdown/docs), audio, Jira/Linear integration, proactive alerts.
