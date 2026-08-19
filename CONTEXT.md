# Project Context: ScopeLens

> This file exists to give Claude Code (Cursor) full context on the project without repeating everything in every prompt. Reference it with `@CONTEXT.md`.

## 1. Who I am

Artur Nunes Oliveira Resende — final-year Computer Science student (PUC Goiás), Analytics Engineering intern at Indicium. Focused on data modeling, ETL/ELT, and the Modern Data Stack (advanced SQL, intermediate Python, Snowflake, Databricks, dbt, Airflow, Power BI, Git/Bitbucket). Databricks Certified Data Analyst Associate.

**How to work with me:** straight to the point, no need to explain basic data/SQL/version-control concepts. Focus on design decisions, efficiency, scalability, and code. Take a critical stance — correct me immediately if I suggest something below market best practice.

## 2. Project goal

Portfolio project for a data role, showing: practical use of AI to build a product end to end, multidisciplinary skill (backend, frontend, data, security, AI), ability to turn a real market need into an original idea, and awareness of product monetization/sales.

**Important:** the goal is experience and portfolio, not necessarily real commercial traction. This should be acknowledged honestly in the documentation and in interviews.

## 3. The product: ScopeLens

### 3.1 What it is

ScopeLens is an **AI-assisted project analyst**. It takes unstructured project sources — starting with meeting transcripts (daily, planning, retro, kickoff) in the MVP, with meeting minutes/PDF/Markdown/docs planned as later source types — and doesn't just summarize them: it **analyzes** the project the way a senior technical analyst would: identifies what's going wrong, what's being said between the lines, what's still undecided, and what will likely become a problem if no one acts.

**Core differentiator, explicitly: diagnostic analysis of unstructured project sources, not language translation.** Translating findings into business language is a valuable presentation feature, but it's not what makes the product different from a generic summarizer — the analysis itself is. See PRD.md section 6.

### 3.2 Objective

Solve two problems at once:
1. **Language barrier** between whoever executes (devs) and whoever decides/reports (manager, PM, non-technical stakeholder).
2. **Continuity blindness** — meetings are isolated events; no one connects the dots between "this blocker already came up in Monday's, Wednesday's, and today's daily" over time. ScopeLens is the "analyst" who attends every meeting, remembers all the previous ones, and spots the pattern no one has time to track manually.

### 3.3 The role of AI in the product

AI isn't just a text summarizer. Its core functions are:
- **Extract** structured data from an unstructured conversation (blockers, risks, dependencies, decisions made, pending decisions, owners).
- **Translate** that data into language a non-technical stakeholder understands, without losing the technical substance.
- **Diagnose** — surface failures, risks, and dependencies that weren't explicitly stated, but that an experienced analyst would notice (e.g. "two participants described the same task in incompatible ways" → rework risk).
- **Suggest** next steps or questions the manager should ask before the next meeting.
- **Track** the evolution of each risk/blocker across multiple meetings, not just report what happened in one isolated meeting.

**On the analysis method (decided):** the "5 voices" idea (contrarian, first principles, expansionist, outsider, executor) mentioned in earlier conversations is a **native Claude skill**, used only as an inspiration reference — it was not adopted as-is. Final decision: a custom variation with 2-3 domain-specific lenses (not the 5 generic personas), running in a 3-stage pipeline with model tiering — extraction (cheap) → multi-perspective diagnosis (mid-tier) → executive synthesis (robust). See PRD.md section 8.3 for the full rationale.

### 3.4 Features — MVP (Phase 1)

1. **Meeting ingestion (first source type)** — paste text or upload a `.txt`/`.vtt` transcript; the analysis engine is designed to extend to other document types later (see 3.5).
2. **Structured extraction** — blockers, risks, dependencies, decisions, and owners identified automatically.
3. **Executive summary** — translates the analysis into business language, no technical jargon — a presentation layer on top of the diagnostic analysis, not the differentiator itself.
4. **Diagnostic analysis** — the AI surfaces risks/failures/dependencies that weren't explicitly stated — the product's actual differentiator (see 3.3 for the analysis method).
5. **Actionable suggestions** — list of next steps or questions recommended by the AI.
6. **Per-workspace history** — every analyzed meeting is saved and tied to the project/team.
7. **Recurrence tracking** — the AI cross-references meetings over time and flags risks/blockers that reappear (e.g. "this blocker has already been mentioned 3 times").
8. **Simple trend dashboard** — view of open vs. resolved risks over time (no `sprints` entity in the MVP — see ARCHITECTURE.md 2.3).
9. **Authentication and multi-tenancy** — each team/company has its own isolated workspace.

### 3.5 Product vision — post-MVP (not committed yet)

- **Multi-format source ingestion** — PDF meeting minutes, Markdown docs, Google Docs, and other unstructured project documentation, feeding the same analysis pipeline as meeting transcripts. This is the direct extension of the core differentiator (3.1): the analysis engine is source-agnostic by design, the MVP just starts with one source type to validate the concept cheaply.
- Audio upload/recording (phase 2, conditioned on validating the text-based MVP).
- Direct Jira/Linear integration, cross-referencing ticket data with meeting data — this is a real differentiator against competitors who only use one type of source (see section 4).
- Proactive alerts (e.g. Slack) when a risk hits a recurrence threshold.
- Paid billing/plans layer.

## 4. Market research (summary)

**Direct notetaker competitors:** Fireflies, Otter, Fathom, Granola, Zoom AI Companion, Read.ai. Saturated market, price war. Reported problems: shallow/generic summaries, transcription inaccuracy, and real legal risk (BIPA lawsuits against Fireflies/Otter for recording without consent; Cornell blocks these bots).

**Most dangerous competitor:** the "Software Engineering Intelligence" category (Jellyfish, LinearB, Swarmia, GetDX, Faros AI) — already solves "translating engineering into business terms" for CTOs/VPs, but using Git/Jira/CI-CD data (more reliable than transcripts). Sold enterprise (free tier up to six-figure contracts). There's even a Jira plugin ("Leiga") that already does predicted risk + progress report in one click, no transcript at all.

**Positioning decision:** don't compete as an "engineering BI dashboard" (loses against SEI platforms). Focus on a "point-in-time decision copilot" — diagnostic analysis of unstructured project sources (not just meetings, eventually docs/PDFs/minutes too) is the real differentiator, barely covered by competitors; business-language translation is a presentation feature on top of it, not the differentiator itself.

## 5. 10 mapped risks (to mitigate or acknowledge in the roadmap)

1. Established competition (Jellyfish/LinearB/Swarmia) with a more reliable data source.
2. Saturated notetaker market.
3. Wrong buyer (whoever feels the pain doesn't decide the budget).
4. High cost of AI-identified "risk" false positive/negative.
5. Adoption friction (requiring pasting a transcript / opening another site).
6. Third-party dependency for transcription quality (Zoom/Meet/Teams).
7. "Big Brother" effect — devs resisting the feeling of being watched.
8. Slow B2B sales cycle.
9. Weak monetization in small squads.
10. Replicable technical advantage (general-purpose LLMs already do 80% of this for free).

## 6. MVP scope (decisions already made)

- **No audio ingestion in the MVP.** Input is pasted text or a `.txt`/`.vtt` upload — leverages Zoom/Meet/Teams' free native transcription. Eliminates STT cost and the consent/recording problem.
- **Audio is a phase 2 feature** (stretch goal), using **Groq API** (Whisper Large v3 Turbo, generous free tier) if we decide to include it.
- **AI cost-per-call strategy (decided):** 3-stage pipeline with model tiering — structured extraction (cheap/fast model) → multi-perspective diagnosis with 2-3 lenses (mid-tier model) → executive synthesis (most capable model, what the user actually reads). See 3.3 and PRD.md section 8.3.

## 7. Tech stack — **DECIDED**

General principle: free tier / test mode by default across the whole stack; a paid upgrade is a configuration change, not a migration. Full rationale for each choice in PRD.md section 10.

- Frontend/hosting: Vercel (free tier)
- Backend/DB/Auth: Supabase (free tier; native RLS meets the per-workspace isolation requirement; sleep-after-7-days-inactivity mitigated with a free cron)
- LLM provider: Claude (Anthropic API), with model tiering per pipeline stage (see section 6)
- Billing: Stripe, in test mode until there's real paid demand
- Observability/errors: Sentry (free tier)
- Product analytics: PostHog (free tier; native surveys cover feedback, no extra tool)
- STT (phase 2, if needed): Groq API
- Editor/dev: Cursor (Claude Code integrated)
- Version control: GitHub, `scopelens` repository, public, MIT license, Node `.gitignore` template

**Deliberately deferred, no rework risk** (evaluated and justified in PRD.md section 10): vector DB (covered by `pgvector` in Supabase itself when needed), Redis/job queue (not needed — status on the table + Supabase Realtime), DNS/custom domain (optional cost, not an architecture decision), transactional email (Supabase Auth covers the MVP; revisit only for the post-MVP proactive-alerts feature).

## 8. Current status and next steps

Planning is closed: product scope, AI method, tech stack, data schema, end-to-end flow, and phased roadmap are all documented (PRD.md, ARCHITECTURE.md, ROADMAP.md, TODO.md). Phase 0 of the roadmap is in progress — Next.js scaffold, CI, and env-gated Sentry/PostHog instrumentation are done; what's left needs manual account creation on Vercel/Supabase/Sentry/PostHog (see SETUP.md), which can't be automated. Track phase-by-phase progress in TODO.md.
