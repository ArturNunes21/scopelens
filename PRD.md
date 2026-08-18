# PRD — ScopeLens

**Product/Technical Requirements Document**
**Author:** Artur Nunes Oliveira Resende
**Status:** Planning closed — product scope, AI method, and tech stack decided; execution in progress (see ROADMAP.md)
**Last updated:** see this file's commit history

---

## 1. Executive Summary

ScopeLens is an AI-assisted project analyst. Given the transcript of a team meeting (daily, planning, retro, kickoff), the product extracts structured data about project status, translates it into business language, diagnoses risks and blockers — including ones not explicitly stated — and tracks the recurrence of those problems across multiple meetings.

This is a portfolio project, not a commercially validated product. The stated goal is to demonstrate, end to end, the ability to: identify a real market pain point, research competitors before building, make justified architecture decisions, and deliver a multidisciplinary product (data, AI, backend, frontend, security) using AI tools as part of the actual work process.

## 2. Problem and Motivation

Two central problems, discussed and validated through research (section 5):

1. **Language barrier** between the people executing (developers) and the people deciding/reporting (managers, non-technical PMs) — untranslated technical jargon causes misalignment and poorly informed decisions.
2. **Continuity blindness** — meetings are treated as isolated events. Blockers and risks that recur across several meetings are rarely cross-referenced manually, because no one has time to revisit old transcripts to spot the pattern.

## 3. Project Goals

| Goal | Description |
|---|---|
| Technical portfolio | Demonstrate multidisciplinary competence (data, AI, backend, frontend, security) for Data/Analytics Engineering roles |
| Practical AI usage | Show fluency using AI as a real work tool, not just a novelty |
| Market validation | Prove the ability to research competitors and niche down an idea before building |
| Monetization (aspirational) | Structure the product as if it were sellable (billing, plans), even without a real short-term revenue goal |

**Explicitly out of scope as a goal:** real commercial traction or product-market fit validation. This must be communicated honestly in interviews and in the repository's public documentation.

## 4. Target Audience

- **Direct user:** non-technical project managers/PMs and tech leads/scrum masters of small-to-medium agile squads.
- **Buyer (where applicable):** not yet clearly defined — see risk #3 in section 7. Initial hypothesis is the squad manager themself, not necessarily a C-level exec.

## 5. Market and Competitive Research

### 5.1 Direct competitors (meeting notetakers)
Fireflies, Otter, Fathom, Granola, Zoom AI Companion, Read.ai. Saturated market with price wars. User-reported problems: shallow/generic summaries and transcription inaccuracy. There's also real legal risk in the recording-bot model — lawsuits (BIPA) against Fireflies and Otter for recording without explicit consent, to the point that institutions like Cornell block these bots.

### 5.2 Most relevant competitor (adjacent category)
"Software Engineering Intelligence" — Jellyfish, LinearB, Swarmia, GetDX, Faros AI. They solve "translating engineering into business terms" for CTOs/VPs, but using Git/Jira/CI-CD data instead of meeting transcripts — a more reliable, structured data source. Enterprise sales model (from free tier to six-figure annual contracts). There's even a Jira plugin ("Leiga") that already generates a progress report + predicted risk with one click, with no dependency on transcripts at all.

### 5.3 Decided positioning
ScopeLens does not compete as an engineering BI dashboard (it would lose against SEI platforms). The positioning is a **point-in-time decision copilot** for a specific meeting or critical project moment — supporting a decision, not replacing aggregated delivery metrics.

## 6. Value Proposition / Differentiator

- Cross-referencing multiple meetings over time to identify recurring risk (not covered by generic notetakers, which treat each meeting in isolation).
- A qualitative data source (conversation) that complements — not competes with — the structured data source (ticket/commit) that SEI platforms already exploit well.
- Future potential to cross-reference both sources (meeting + ticket), which no mapped competitor does today (see section 8.2).

## 7. Mapped Risks

| # | Risk | Notes |
|---|---|---|
| 1 | Established competition with a more reliable data source | Jellyfish/LinearB/Swarmia |
| 2 | Saturated notetaker market | Price war, hard to differentiate |
| 3 | Wrong buyer | Whoever feels the pain may not decide the budget |
| 4 | High cost of false positive/negative | An AI diagnostic error breaks trust fast |
| 5 | Adoption friction | Requiring pasting a transcript / new login competes with "just ask on Slack" |
| 6 | Third-party dependency | Transcription quality depends on Zoom/Meet/Teams |
| 7 | "Big Brother" effect | Devs resisting the feeling of being surveilled/evaluated |
| 8 | Slow B2B sales cycle | Even for a simple product, institutional adoption is slow |
| 9 | Weak monetization in small squads | Large squads already have budget for SEI platforms |
| 10 | Replicable technical advantage | General-purpose LLMs already cover most of the basic use case |

**General mitigation:** keep the product honest about its niche (point-in-time copilot, not a BI platform) and avoid overstating commercial potential in communication — both in the product and in the portfolio.

## 8. Product Scope

### 8.1 Features — MVP (Phase 1)

| # | Feature | Description |
|---|---|---|
| 1 | Meeting ingestion | Paste text or upload a `.txt` / `.vtt` transcript |
| 2 | Structured extraction | Blockers, risks, dependencies, decisions, and owners identified automatically |
| 3 | Executive summary | Translation of the meeting into business language, no technical jargon |
| 4 | Diagnostic analysis | AI surfaces risks/failures/dependencies that weren't explicitly stated — see 8.3 for the analysis method |
| 5 | Actionable suggestions | List of next steps or questions recommended by the AI |
| 6 | Per-workspace history | Analyzed meetings are saved and tied to the project/team |
| 7 | Recurrence tracking | Cross-referencing meetings over time, flagging recurring risks/blockers |
| 8 | Trend dashboard | View of open vs. resolved risks across sprints |
| 9 | Authentication and multi-tenancy | Each team/company has an isolated workspace |

### 8.2 Product vision — post-MVP (not committed)

- Audio upload/recording (conditioned on validating the text-based MVP)
- Jira/Linear integration, cross-referencing ticket data with meeting data
- Proactive alerts (e.g. Slack) when a risk hits a recurrence threshold
- Paid billing/plans layer

### 8.3 AI analysis method — decided

**Decision: a custom variation with domain-specific lenses (not the native "5 voices" skill as-is, and not a persona-free pipeline).**

Rationale: the "5 voices" skill was designed for brainstorming/idea evaluation in conversation, not for structured extraction of blockers/risks/decisions — using it as-is would require 6 full calls (5 personas + synthesis) with a weak fit for the domain. A persona-free pipeline would be cheaper, but risks falling into the same trap as the competitors mapped in section 5.1 ("shallow/generic summaries") — multi-perspective analysis is the product's real differentiator (section 6). The custom variation preserves that differentiator with lenses designed for the use case, with cost controlled via model tiering.

3-stage pipeline:
1. **Extraction** (cheap/fast model, structured output/JSON schema) — blockers, risks, dependencies, decisions, owners.
2. **Multi-perspective diagnosis** (mid-tier model, 2-3 domain-specific lenses — e.g. contradiction/unstated risk, historical continuity cross-referencing prior meetings, decision gap) — can run as a single call with structured output per lens, to save cost.
3. **Executive synthesis** (most capable model) — translates everything into business language + actionable suggestions; this is what the user actually reads.

LLM provider: see section 10.

## 9. Non-Functional Requirements

- **Security and privacy:** meeting data is inherently sensitive (may contain business information, individual performance, strategic decisions). Data isolation per workspace is a requirement, not optional.
- **Multi-tenancy:** the data architecture must support multiple teams/companies with isolation at the database layer (not just the application layer).
- **No audio recording in the MVP:** deliberate decision to avoid the consent problem affecting competitors (see 5.1) and reduce infrastructure cost.
- **Controlled AI cost:** AI calls must be designed with cost/latency per stage in mind (simple extraction vs. final synthesis), independent of the final method chosen in 8.3.

## 10. Tech Stack

**Status: decided.**

**General principle:** operate on free tier / test mode by default across the whole stack; every upgrade to a paid plan is a configuration change (API key, billing plan), not a tool or data migration. This keeps cost at $0/month for the portfolio without closing the door on real monetization if demand appears.

| Layer | Choice | Rationale |
|---|---|---|
| Frontend/hosting | Vercel | Generous free tier, zero-config deploys, native Next.js integration |
| Backend/DB/Auth | Supabase | Postgres with native RLS — meets the per-workspace isolation requirement at the database layer (section 9), not just the application layer. Integrated auth. **Note:** free tier project pauses after 7 days without a request — mitigated with a free cron (GitHub Actions or similar) pinging periodically; no added cost |
| LLM provider | Claude (Anthropic API) | Needed to formalize this explicitly — the 3 stages of the AI pipeline (section 8.3) run on the Claude API, with model tiering per stage (controlled cost per call) |
| Billing | Stripe | Market standard, most recognizable in a technical interview. Operate in test mode (`sk_test_` keys) until there's real payment demand; switching to `sk_live_` is just a key swap, no code change |
| Observability/errors | Sentry | Free tier covers the project's volume; demonstrates observability competence distinct from the rest of the stack |
| Product analytics | PostHog | Free tier (1M events/month); covers real usage funnels (ingestion → analysis → dashboard), not just pageviews. Includes native surveys/feedback widget — covers the feedback need with no extra tool |
| STT (phase 2, if needed) | Groq API | Whisper Large v3 Turbo, generous free tier |

**Areas evaluated and deliberately deferred** (not an architecture gap — they're additive, no rework risk, and several are already covered for free by the stack above):
- **Vector DB:** no new tool needed — Supabase runs `pgvector` as a native Postgres extension. The MVP uses simple structured matching (`pg_trgm`) for risk recurrence; pgvector can be turned on later, in the same database, with no migration.
- **Redis/job queue:** not needed for the expected volume. Async processing is handled with a `status` field on the meeting table + Supabase Realtime on the frontend, no extra infra.
- **DNS/custom domain:** not an architecture decision, it's an optional cost (~US$12/year) to be spent once the product is ready to be shown.
- **Transactional email:** Supabase Auth already covers magic link/reset by default for the MVP. Revisit (Resend or Postmark, generous free tier) only once the proactive alerts feature (post-MVP, section 8.2) is built.

Already decided (process tooling, not product architecture):
- Version control: GitHub, `scopelens` repository, public, MIT license
- Editor/AI-assisted development: Cursor + Claude Code

## 11. Success Metrics

Since the primary goal is a portfolio (section 3), success metrics are not about revenue/traction, but about completeness and technical quality:
- Product working end to end (ingestion → analysis → dashboard), deployed and publicly accessible
- Architecture decisions documented and defensible in a technical interview
- Coverage of the proposed multidisciplinary areas: data modeling, AI orchestration, security (RLS/multi-tenancy), frontend, billing

### 11.1 Measurable technical success criteria for the MVP

Complements the qualitative metrics above with concrete, verifiable thresholds per phase (per-phase breakdown in ROADMAP.md):

| Criterion | Threshold |
|---|---|
| Tenant isolation | Automated cross-tenant leak test passing (zero exceptions) — validating this by code review alone is not acceptable |
| Recurrence precision | Zero false positives on the synthetic test set (grouping genuinely distinct findings is the most costly error, risk #4) |
| AI pipeline latency | Full analysis (3 stages) of a typical-length transcript (~30-45 min meeting) in under 60s, from the user's point of view |
| Cost per analysis | Total cost of the 3 AI calls per analyzed meeting, measured via `ai_calls`, kept below a ceiling defined in Roadmap Phase 3 (initial reference: under US$0.10/meeting) |
| Public availability | Product accessible with no setup required from the evaluator — browsable demo workspace (Roadmap Phase 8) |

## 12. Open Decisions / Next Steps

1. ~~Define the AI analysis method (section 8.3)~~ — decided
2. ~~Evaluate and decide the tech stack (section 10)~~ — decided
3. ~~Design the data schema~~ — see ARCHITECTURE.md
4. ~~Design the end-to-end data flow~~ — see ARCHITECTURE.md
5. ~~Define measurable technical success criteria for the MVP~~ — see section 11.1

No open planning decisions at this time. Next step is execution per ROADMAP.md, Phase 0.

## 13. Decision History

| Date/Stage | Decision |
|---|---|
| Ideation | Chose to merge the "translation for managers" + "project analysis" ideas over "job search tool" |
| Market research | Identified direct competitors (notetakers) and adjacent ones (SEI platforms); positioning adjusted to "point-in-time copilot" |
| MVP scope | Removed audio ingestion from the MVP; ingestion via text/native transcription from call tools |
| Name | Settled on "ScopeLens" |
| Repository | Created `scopelens`, public, MIT, Node `.gitignore` |
| Working environment | Decided to use Cursor + Claude Code for AI-assisted development |
| AI analysis method | Custom variation with domain-specific lenses (extraction → multi-perspective diagnosis → synthesis), not the native "5 voices" skill nor a persona-free pipeline — see section 8.3 |
| Tech stack | Vercel + Supabase + Claude API + Stripe (test mode) + Sentry + PostHog, all on free tier/test mode with migration-free upgrade path — see section 10 |
