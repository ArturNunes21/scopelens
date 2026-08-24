# ScopeLens

An AI-assisted project analyst — given the transcript of a team meeting (daily, planning, retro, kickoff), it extracts structured data about project status, translates it into business language, diagnoses risks and blockers (including ones not explicitly stated), and tracks the recurrence of those problems across multiple meetings.

A portfolio project, not a commercially validated product — the goal is to demonstrate, end to end, the ability to identify a real market pain point, research competitors before building, make justified architecture decisions, and deliver a multidisciplinary product (data, AI, backend, frontend, security).

## Documentation

- [`PRD.md`](./PRD.md) — problem, market research, scope, product decisions, and stack
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data schema and end-to-end flow
- [`ROADMAP.md`](./ROADMAP.md) — implementation phases
- [`TODO.md`](./TODO.md) — phase-by-phase progress tracker
- [`SETUP.md`](./SETUP.md) — account/credential setup guide
- [`CONTEXT.md`](./CONTEXT.md) — author and project context (reference for AI-assisted development)

## Stack

Next.js (Vercel) · Supabase (Postgres/Auth/Realtime) · Claude API (Anthropic) · Stripe · Sentry · PostHog — details and rationale in `PRD.md` section 10.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in with real keys — see comments in the file
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test` (integration tests — runs against the linked remote Supabase project, see `tests/rls-isolation.test.ts`).

## Status

In development — Phases 0 and 1 of the roadmap complete (foundation, instrumentation, auth, multi-tenancy with RLS verified end-to-end). Phase 2 (meeting ingestion) next. No product features implemented yet.
