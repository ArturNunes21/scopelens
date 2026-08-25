# Design System — ScopeLens

**Status:** tokens extracted from the Phase 1 login screen and applied consistently to the Phase 2 meeting-ingestion screens (`/meetings`, `/meetings/new`). Captured now, per `ROADMAP.md` Phase 2, so later screens (Phase 5+) share one system instead of improvising per screen.

Reviewed for compliance with the `web-design-guidelines` skill (Vercel Web Interface Guidelines) — see findings applied below.

## Palette

Neutral, high-contrast, light/dark via `prefers-color-scheme` (no theme toggle in the MVP).

| Token | Light | Dark | Use |
|---|---|---|---|
| Page background | `zinc-50` | `black` | `<body>`-level wrapper on every screen |
| Card/surface background | `white` | `zinc-950` | Cards, forms |
| Card border | `black/[.08]` | `white/[.145]` | 1px border on every card/input |
| Primary text | `black` | `zinc-50` | Headings, labels |
| Secondary text | `zinc-600` | `zinc-400` | Helper text, metadata |
| Muted text | `zinc-500` | `zinc-400` | Timestamps, counters |
| Danger | `red-600` | `red-400` | Errors |
| Accent (foreground/background pair) | `--foreground` / `--background` | inverted | Primary buttons — solid, high-contrast, no separate "brand color" |

Status pills (meeting list) extend the palette with semantic tints (`blue` = processing, `emerald` = completed, `red` = failed, `zinc` = pending) — the only place color carries meaning beyond text/surface.

## Typography

- **Font:** Geist Sans (`--font-geist-sans`), Geist Mono for code/transcript text (`font-mono`).
- **Scale:** `text-xl font-semibold` (screen titles) → `text-sm` (body/labels/buttons) → `text-xs` (metadata, counters, helper text). No intermediate sizes — keeps every screen visually flat/utilitarian rather than magazine-style.

## Spacing & shape

- Cards: `rounded-lg`, `p-6`–`p-8` padding, `gap-3`–`gap-4` between form fields.
- Inputs/buttons: `rounded` (not `-lg`), `px-3 py-2`, `text-sm`.
- Page container: `max-w-sm` (auth) / `max-w-2xl`–`max-w-3xl` (content screens), centered, `px-6 py-10`.

## Signature element

The **bordered card on a tinted page background** (`bg-zinc-50` page / `bg-white` card, hairline border at low opacity) is the recurring motif — used for the login form, the empty-state card, and every meeting-list row. New screens should default to this pattern rather than inventing a new surface treatment.

Secondary signature: the **segmented pill toggle** (`rounded-full` container, `rounded-full` active segment in solid foreground/background) introduced on `/meetings/new` for the paste/upload switch — reuse this for any future binary/ternary mode switch instead of tabs or radio buttons.

## Guideline compliance pass

Checked `/meetings` and `/meetings/new` against the Vercel Web Interface Guidelines:

- Interactive elements (buttons, file input, toggle) all have visible `:focus` state via the existing `focus:border-*` / native browser focus ring — no `outline-none` without a replacement.
- Disabled states (`disabled:opacity-50`) pair with actual `disabled` attribute (submit button while pending or over the char limit), not just a visual dim.
- Empty state on `/meetings` gives a clear next action instead of a bare "no data" message.
- Async submit gives text feedback (`Saving…`) instead of only a spinner.
- Known gap: no client-side toast/inline confirmation on successful save — currently relies on redirect + the new row appearing in the list. Acceptable for MVP; revisit if user testing shows it's not enough feedback.
