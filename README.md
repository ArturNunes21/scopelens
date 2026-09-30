# ScopeLens

**Live:** [scopelens-art27.vercel.app](https://scopelens-art27.vercel.app) — sign in with any email (magic link, no password), then click **"Load sample data"** on the empty meetings page to browse a populated workspace with no setup.

An AI-assisted project analyst. Paste or upload the transcript of a team meeting (daily, planning, retro, kickoff) and it extracts structured findings, translates them into business language, diagnoses risks and blockers — including ones nobody stated out loud — and tracks which of those problems keep recurring across later meetings.

## The problem

Two things repeatedly go wrong in software teams, independent of any single tool:

1. **The language barrier between building and deciding.** Developers report status in terms that make sense to developers; the people who decide budget and scope need business language. Something gets lost in translation, usually the actual risk.
2. **Continuity blindness.** Meetings are treated as isolated events. A blocker mentioned three standups in a row rarely gets flagged as a pattern, because nobody has time to re-read old transcripts looking for one.

Meeting notetakers (Fireflies, Otter, Fathom, Read.ai) solve transcription and summarization, not this — their output is still one meeting at a time, and the market is saturated on that axis alone. "Engineering intelligence" platforms (Jellyfish, LinearB, Swarmia) solve the business-translation problem well, but from Git/Jira data — a more reliable source than conversation, but blind to what actually got *said* and *decided* in a room. ScopeLens's bet is the gap between those two categories: cross-referencing the qualitative, unstructured narrative of meetings over time, not just summarizing one of them.

Full market research and positioning: [`PRD.md`](./PRD.md) sections 2 and 5.

## What it actually does

1. **Ingest** — paste text or upload a `.txt`/`.vtt` transcript.
2. **Extract** — a cheap/fast model pulls out blockers, risks, dependencies, decisions, and owners as structured data.
3. **Diagnose** — a mid-tier model re-reads the extraction through a few fixed lenses (contradiction, historical continuity against past meetings, decision gaps) to surface what wasn't explicitly said.
4. **Synthesize** — the most capable model in the pipeline turns the diagnosis into an executive summary and a list of concrete suggested actions, in plain business language.
5. **Track** — findings are grouped by recurrence across meetings, and a trend dashboard shows open vs. resolved over time.

That three-stage, tiered pipeline (cheap → mid → capable model) is a deliberate cost/quality tradeoff, not an accident — see [`PRD.md`](./PRD.md) section 8.3 for why a persona-free single pass or the "5 voices" pattern were both rejected for this specific job.

## Why it's built this way

- **Row-Level Security, not application-layer checks, for tenant isolation.** Every domain table carries `workspace_id` and an RLS policy backed by a single `is_workspace_member()` function — the isolation boundary lives in Postgres, verifiable independent of any application bug. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) section 2.
- **No queue, no separate vector store, no cache — on purpose.** Async processing is a `status` column plus Supabase Realtime; recurrence matching runs on `pg_trgm` today with `pgvector` (already installed) as a same-database upgrade path if the simpler approach stops being precise enough. Every deferred infrastructure piece is a config change later, not a rewrite — see [`PRD.md`](./PRD.md) section 10.
- **Billing in Stripe test mode from day one**, switchable to live keys with no code change — because the point is demonstrating the integration exists and works end to end (verified in [`TODO.md`](./TODO.md) Phase 7), not collecting real payments.
- **Everything free-tier by default.** The whole stack runs at $0/month; every upgrade path (Stripe live keys, custom SMTP, a paid Supabase tier) is additive, not a migration.

## Stack

Next.js (Vercel) · Supabase (Postgres/Auth/Realtime, native RLS) · Claude API (Anthropic) · Stripe · Sentry · PostHog — full rationale per layer in [`PRD.md`](./PRD.md) section 10.

## Status

Phases 0–7 complete and verified end to end: multi-tenant auth with RLS, transcript ingestion, the full 3-stage AI pipeline, cross-meeting recurrence tracking, the trend dashboard, and Stripe billing (checkout → webhook → plan upgrade, and the reverse on cancellation — both confirmed against the database, not just the UI). Phase 8 (hardening for public/portfolio use) is in progress: empty states, an app-level error boundary, and one-click demo data are done; this README is part of that phase too.

Detailed phase-by-phase progress: [`TODO.md`](./TODO.md). Full roadmap: [`ROADMAP.md`](./ROADMAP.md).

## Documentation

- [`PRD.md`](./PRD.md) — problem, market research, scope, product decisions, and stack
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data schema and end-to-end flow
- [`ROADMAP.md`](./ROADMAP.md) — implementation phases
- [`TODO.md`](./TODO.md) — phase-by-phase progress tracker
- [`SETUP.md`](./SETUP.md) — account/credential setup guide
- [`CONTEXT.md`](./CONTEXT.md) — author and project context (reference for AI-assisted development)

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in with real keys — see comments in the file
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test` (integration tests — runs against the linked remote Supabase project, see `tests/rls-isolation.test.ts`).

## About this project

A portfolio project, not a commercially validated product — the goal is to demonstrate, end to end, the ability to identify a real market pain point, research competitors before building, make justified architecture decisions, and deliver a multidisciplinary product (data, AI, backend, frontend, security). That framing is stated plainly rather than oversold: see [`PRD.md`](./PRD.md) section 3.
