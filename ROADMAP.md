# Implementation Roadmap — ScopeLens

**Depends on:** PRD.md, ARCHITECTURE.md
**Principles guiding the phase order:**
- Instrument (errors + analytics) before writing product logic, not after — cheaper to do early than retroactively.
- Vertical slice per phase: each phase delivers something that runs end to end and is deployable, not an isolated layer (e.g. not "whole schema first, whole UI later").
- RLS and tenant isolation are tested explicitly as soon as they exist — it's a security requirement (PRD section 9), not an implementation detail to validate later.
- AI is introduced across 3 separate phases (extraction → recurrence → diagnosis/synthesis), in the same increasing-cost order defined in ARCHITECTURE.md — each one testable in isolation before chaining the next.
- Billing is the latest phase by PRD decision (8.2, post-MVP) — payment infrastructure only after the core product proves it works.
- **UI/UX detail is specified per phase, right before that phase is built — not upfront.** PRD.md defines *what* each feature does (e.g. feature 8, trend dashboard: open vs. resolved risks over time); the exact charts, metrics, and layout are decided when the phase starts, informed by the real shape of data produced by earlier phases. Deciding this too early risks designing around guessed data instead of real data from Phases 3-4, causing rework. This applies mainly to Phases 5, 6, and 8, which have the most user-facing surface.

---

## Phase 0 — Foundation and instrumentation

**Goal:** project skeleton publicly deployed from day one, with observability already wired in.

- Next.js scaffold, initial deploy on Vercel (empty page already live).
- Supabase project created; versioned migration tooling in the repo (Supabase CLI).
- Sentry and PostHog integrated from the start — capture errors and events even before real features exist.
- Basic CI: lint + typecheck (+ tests, as they come to exist) running on PR.

**Definition of done:** public URL live, a deliberate production error shows up in Sentry, a pageview event shows up in PostHog.

## Phase 1 — Authentication and multi-tenancy

**Goal:** the per-workspace isolation foundation, which is a non-functional requirement (PRD section 9), not an optional feature.

- Supabase Auth (magic link), trigger that auto-creates a `workspace` + `workspace_members(owner)` on first signup.
- RLS enabled on every domain table (even before they hold real data).

**Definition of done:** automated test that creates two workspaces with different users and confirms one user **cannot read the other workspace's data** via a direct query — trusting that the SQL policy "looks right" is not sufficient.

## Phase 2 — Meeting ingestion (no AI)

**Goal:** validate the end-to-end data path before attaching AI cost.

- Paste-text / upload `.txt`/`.vtt` UI.
- `meetings` created with `status='pending'`, listing/history per workspace (PRD feature 6, partial).

**Definition of done:** the meeting shows up in the correct workspace's listing, isolated from other workspaces (reuses the Phase 1 RLS test).

## Phase 3 — Structured extraction (AI pipeline stage 1)

**Goal:** the first real Claude API call, isolated and testable before chaining the next ones.

- Claude API integration, structured output/JSON schema.
- Populates `findings` (blockers/risks/dependencies/decisions).
- Logs to `ai_calls` (tokens, latency) — cost visibility from the first call, not bolted on later.

**Definition of done:** a test meeting generates correct findings across all 4 types, call cost visible in `ai_calls`.

## Phase 4 — Cross-meeting recurrence

**Goal:** PRD feature 7 (the continuity differentiator) — implemented and tested separately from the AI, because it's deterministic logic (matching), not generation.

- `pg_trgm` matching against open findings of the same workspace/type.
- `recurrence_group_id` assignment.

**Definition of done:** a set of synthetic meetings where the "same" blocker is described in different ways is correctly grouped; genuinely distinct blockers are not grouped by mistake (a false positive is the most costly error here — PRD risk #4).

## Phase 5 — Multi-perspective diagnosis and synthesis (stages 2-3)

**Goal:** close out the full 3-stage pipeline and the product's real differentiator (PRD section 6).

- Diagnostic lenses (2-3, domain-specific) → `diagnostic_notes`.
- Executive synthesis → `meetings.executive_summary` + `suggested_actions`.
- Full async flow: `status` on the table + Supabase Realtime on the frontend (ARCHITECTURE.md section 3).

**Definition of done:** a user pastes a transcript and, without refreshing, watches the status move from pending → processing → completed, with the executive summary, findings, diagnosis, and suggested actions rendered.

## Phase 6 — Trend dashboard

**Goal:** PRD feature 8 — an aggregate view, no longer meeting-by-meeting.

- Before building: a short spec pass on the exact charts/metrics to show (e.g. completion percentage, pending-issue counts, key-points list) — deferred on purpose until real Phase 3-4 data exists to design around (see the UI/UX principle above).
- Query aggregated by `recurrence_group_id`: open vs. resolved risks over time.

**Definition of done:** the dashboard correctly reflects the state of a workspace with multiple meetings and at least one resolved recurring risk.

## Phase 7 — Billing

**Goal:** demonstrate monetization capability (PRD section 3 goal), without blocking the core MVP on it.

- Stripe Checkout in test mode, webhook updating `workspaces.plan`.
- Simple feature gate (e.g. a meetings/month limit on the free plan) checked in the API route.

**Definition of done:** a plan upgrade via test Checkout is reflected in `workspaces.plan` and unlocks the corresponding gate.

## Phase 8 — Hardening for public portfolio use

**Goal:** the product needs to survive a recruiter's first, unsupervised contact with it.

- Empty states, error states, seeded demo data (a sample workspace browsable with no need to paste a transcript).
- Repository README telling the project's story (problem, market research, architecture decisions, honesty about being a portfolio project — PRD section 3.2).
- Custom domain (optional, low cost — see ARCHITECTURE.md/PRD section 10).

**Definition of done:** someone with no context opens the link, understands what it is within 30 seconds, and can see the product working without needing their own data.

---

## Out of this roadmap (post-MVP, PRD section 8.2)

Multi-format source ingestion (PDF/Markdown/docs — the natural extension of the analysis engine beyond meeting transcripts, see PRD section 6), audio, Jira/Linear integration, proactive alerts — deliberately not sequenced here; they become new phases only after the MVP is validated.
