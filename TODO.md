# TODO — ScopeLens

Mirrors the phases in [`ROADMAP.md`](./ROADMAP.md). Check items off here as they close; reference the item number in the commit/PR message (e.g. "closes Phase 0 #4-#6").

> ⚠️ **MANUAL ACTION PENDING** — G15: `maxDuration=60` is hardcoded in `meetings/new/layout.tsx` and `meetings/[id]/page.tsx`, but nobody has confirmed 60s is actually enough. Open the Vercel dashboard → Project → Settings → Functions and check the real plan/Fluid Compute ceiling; if a real ~30-45min transcript's 3 chained AI calls don't fit in 60s, use the per-stage-route fallback already documented in ARCHITECTURE.md section 3.

## Phase 0.5 — Spec review gap remediation ([GAPS.md](./GAPS.md))

- [x] G15: `maxDuration = 60` set on both Server Action entry points (`meetings/new/layout.tsx`, `meetings/[id]/page.tsx`) — the Hobby-plan configurable ceiling without Fluid Compute. **Manual verification of the real plan ceiling still pending, see banner above.**
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

- [x] Claude API integration (structured output)
- [x] `findings` population
- [x] `ai_calls` logging (cost/latency)
- Verified end-to-end locally (2026-08-25): first attempt failed on a `0`-credit Anthropic API key (`error_message`: "Your credit balance is too low"), confirming zero partial rows are left in `findings`/`ai_calls` on failure (GAPS.md G13 rollback). After adding API credits, a re-run transcript with one example of each type produced exactly 1 blocker, 1 risk, 1 dependency, 2 decisions (1 taken, 1 pending) with correct owners (null left null, never invented), and 1 `ai_calls` row (`stage=extraction`, `model=claude-haiku-4-5`, tokens_in=950, tokens_out=143, cost_usd=0.001665, latency_ms=8380) — matches the Phase 3 Definition of Done in ROADMAP.md.

## Phase 4 — Cross-meeting recurrence

- [x] `pg_trgm` matching (`match_recurrence_finding` SQL function, service-invoker, workspace/type/status-scoped)
- [x] `recurrence_group_id` assignment (wired into `pipeline.ts`, sequential match-before-insert per meeting)
- [x] Test with synthetic meetings (no false positives) — verified 2026-09-14: threshold calibrated to 0.25 against real fixtures (reworded true-positive scored 0.32 similarity; closest distinct-blocker false-positive candidate scored 0.092, comfortable margin below); 10/10 tests green (`tests/recurrence-matching.test.ts`), migration `20260826000000_recurrence_matching_function.sql` applied to remote Supabase

## Phase 5 — Multi-perspective diagnosis and synthesis (stages 2-3)

- [x] Diagnostic lenses → `diagnostic_notes` (`src/lib/ai/diagnosis.ts`, `claude-sonnet-5`, 3 fixed lenses)
- [x] Executive synthesis → `executive_summary` + `suggested_actions` (`src/lib/ai/synthesis.ts`, `claude-opus-5`)
- [x] Full async flow (status + Supabase Realtime): pipeline chains all 3 stages with idempotent rollback; `/meetings/[id]` subscribes via Realtime, no polling; migration `20260914010000_enable_meetings_realtime.sql` adds `meetings` to the publication
- [x] Retry wired to the UI (`retryMeeting` server action + button on the failed state) — mechanism existed since Phase 3 (GAPS.md G13) but was never exposed until now
- [x] Verified locally (2026-09-14): typecheck/lint/build clean; dev server smoke test (unauthenticated `/meetings` and `/meetings/[id]` redirect to `/login`, no server errors)
- [x] Verified end-to-end in production data (2026-09-14): real transcript (daily standup) produced 1 blocker, 1 risk, 1 dependency, 2 decisions, a `continuity` diagnostic note correctly referencing a prior meeting's Redis decision, executive summary, and 6 prioritized suggested actions. Manual testing surfaced and fixed 2 real bugs: (1) `match_recurrence_finding` threw "structure of query does not match function result type" — pg_trgm's `similarity()` returns `real`, plpgsql's `RETURN QUERY` needed an explicit cast to the declared `float8` column (`20260914020000` migration); (2) the status badge on `/meetings/[id]` went stale after a successful Retry (page content updated, badge didn't) — `useState`'s initial value is only applied on mount, so `router.refresh()` handing a new `initialStatus` prop never resynced the already-mounted badge; fixed by re-deriving local state from the prop during render. Retry-driven status transition (Failed → Processing → Completed) confirmed live via Realtime, no manual refresh

## Phase 6 — Trend dashboard

- [x] Prerequisite: `findings.status` had no writer anywhere in the codebase before this — resolved two ways (2026-09-15): (1) manual toggle (`toggleFindingStatus` server action + button on `/meetings/[id]`, excludes `finding_type='decision'` server-side — its lifecycle is `decision_status`, not `status`), (2) explicit resolution detection — Stage 1 extraction also returns `resolved_mentions`, matched against open findings via `match_finding_to_resolve` (its own, stricter 0.3 similarity threshold, independent of recurrence matching's recall-favoring 0.25) and bulk-resolves **every** open finding in the matched `recurrence_group_id`, not just one. Never inferred from an issue simply not recurring.
- [x] Multi-round pre-merge code review (2026-09-15, PR #14): caught and fixed 8 real bugs before any of this shipped — a recurring issue's older occurrences were never actually closed (only the single best-matching row was); a `Promise.all` race could leak an untracked, unrevertable cross-meeting write on partial failure; the bulk-resolve could silently close a finding this same run had just inserted; extraction `ai_calls` cost logging could be skipped entirely on a later failure, hiding real spend from the GAPS.md G12 budget check; decisions could be manually marked "resolved" despite the schema saying otherwise. Final: 16/16 tests in `tests/recurrence-matching.test.ts` (including 2 covering these exact fixes), migrations `20260915000000` + `20260915010000` applied to remote Supabase.
- [x] Spec pass on exact charts/metrics (2026-09-15): kept lean per PRD section 3 positioning ("point-in-time decision copilot," not a BI dashboard) — 4 stat tiles (open blockers/risks/dependencies, pending decisions), one 2-series line chart (open vs. resolved, cumulative, weekly buckets by `meetings.occurred_at`/`resolved_at`), and a recurring-issues list. No date-range filter in the MVP (small dataset, revisit if usage grows).
- [x] `/dashboard` route: stat tiles + trend chart (hand-rolled SVG, hover crosshair/tooltip, no new dependency) + recurring-issues list aggregated by `recurrence_group_id` — pure aggregation logic in `src/lib/dashboard.ts`, 8 unit tests in `tests/dashboard.test.ts` (no DB needed, unlike the other 2 test files). Review pass (PR #16) also caught and fixed: decisions leaking into the trend chart's open count, a UTC-vs-local-timezone off-by-one-day label bug, a missing `/dashboard` cache revalidation after a manual resolve, and a missing row cap that would have silently truncated totals for a large workspace (PostgREST `max_rows`).
- [ ] Verified end-to-end in a real logged-in browser session — no browser automation tool was available in this environment; verified instead via (1) build/typecheck/lint/unit-tests all green on `main` post-merge, (2) unauthenticated `/dashboard` redirects to `/login` (curl), (3) the aggregation logic run directly against the real production Supabase data from Phase 3-5 testing produced sane output (2 open blockers, 2 open risks, 2 open dependencies, 3 pending decisions, 1 recurring group correctly flagged open, a 2-point trend that exercises the actual chart render path, not just the empty-state). Someone should still click through it once in a browser before calling this fully done.

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
