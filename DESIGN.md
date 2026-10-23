# Design System — ScopeLens

**Status:** Phase 10 identity (2026-10-22), replaces the Phase 2/8 neutral zinc + blue system. Tokens live only in `src/app/globals.css`; shared primitives in `src/components/ui.tsx` and `src/components/app-shell.tsx`.

## Brief

- **Subject:** an AI project analyst that reads meeting transcripts, pulls out blockers, risks, dependencies and decisions, and tracks the ones that keep coming back across meetings.
- **Audience:** first, someone evaluating a portfolio piece in under a minute (often on a phone); second, the tech lead / PM the product is written for.
- **Primary job:** show "messy conversation → clear diagnosis" fast, then feel like a focused, real tool.
- **Direction (set by the owner):** black + signal orange, minimal, dark by default with a light theme, thin-line graph as the identity element. References: Synaptrix (thin-line data art), Axiom Power (big type, orange as a solid block), Braintrust (real product UI shown inside the landing).

## Palette

Dark is the default theme; light is a full theme, not an inverted filter. Toggle stored per browser (`localStorage.theme`), applied as `data-theme` on `<html>` before paint.

| Token | Dark | Light | Use |
|---|---|---|---|
| `background` | `#000000` | `#FAFAF9` | Page |
| `surface` | `#101010` | `#FFFFFF` | Raised panels (sidebar, transcript, popovers) |
| `surface-2` | `#181818` | `#F1F1EF` | Hover, active nav, inputs |
| `foreground` | `#F2F1EE` | `#121212` | Primary text |
| `secondary` | `#A3A29D` | `#55544F` | Body copy, metadata |
| `muted` | `#6E6D69` | `#8A8984` | Timestamps, counters, disabled |
| `border` | `#232323` | `#E4E4E0` | Hairlines |
| `accent` (Signal) | `#FE4C02` | `#FE4C02` | Fills: primary buttons, the recurrence path, critical badges |
| `accent-ink` | `#FF6A2B` | `#C23A00` | Orange *text* (contrast-safe on each background) |
| `accent-foreground` | `#000000` | `#000000` | Text on orange fills (black on orange, 6:1) |

**Orange means "needs attention", never decoration.** Status is encoded by fill intensity, not by adding hues:

| Status | Treatment |
|---|---|
| critical (critical health, high priority, failed) | solid orange, black text |
| serious (at-risk health, overdue) | orange text on 14% orange tint |
| accent (processing, medium priority) | orange text + orange hairline, no fill |
| warning (watch health, pending decision) | yellow `#E8C547` / `#7A5D00` |
| good (healthy, resolved, decided) | green `#4CC38A` / `#16794A` |
| neutral | secondary text on `surface-2` |

## Typography

- **Archivo** (variable, `wght` + `wdth` axes) — everything ScopeLens says: UI, analysis, headlines. Display type uses the width axis (`wdth 118`, weight 300, tight tracking) so headlines read like instrument readouts; UI text stays at normal width.
- **Newsreader** (variable, `opsz`) — only for what *people said*: transcript lines and evidence quotes. The face change is the information: serif = a human's words, grotesk = the machine's reading of them.
- No monospace labels; numbers use `tabular-nums`.
- Scale (classic 16-based): 12 meta · 14 UI body · 16 landing body · 18 lead / summary · 24 page title · 36 section title · 48–76 display (fluid).
- Sentence case everywhere. No all-caps eyebrows, no `→` on buttons, no middle-dot meta strings in new UI (use spacing).

## Layout

- **Landing (`/`):** left-aligned. Headline + one paragraph + two actions, then the lens graph full-bleed, then a real transcript → findings demo, the 3-stage pipeline (numbered because it *is* a sequence), the post-meeting tools, and an honest portfolio note.
- **App:** fixed left sidebar (`240px`) with wordmark, project switcher, New meeting, nav, and theme/billing/sign-out at the bottom. Below `lg` it collapses to a top bar + slide-over menu. Content column `max-w-4xl`, meeting detail widens to two columns (analysis + sticky transcript).
- Hairline-separated sections on the page background are the default; boxed panels only where something is genuinely a separate object (transcript panel, stat tiles, form). Radius by hierarchy: 4px controls/badges, 8px panels.

## Signature element — the lens graph

Meetings drawn as columns of points joined by hairlines; one issue's path through them is drawn in signal orange, with a gap where it went unmentioned. A lens (circle) magnifies the graph under it — inside the lens the hairlines sharpen. On the landing it follows the pointer and settles back on the recurring issue. It is the product's actual idea (cross-meeting recurrence) drawn literally, so it is reused only where that idea appears: the landing hero, the logo mark (ring + offset orange node), and the analysis-in-progress state.

## Motion

One orchestrated moment: the hero graph draws in on load (hairlines fade, the orange path traces, the lens settles). Everything else is response to action: tab switch, menu slide, the analysis-progress scan on the active stage. All of it is disabled under `prefers-reduced-motion`.

## Quality floor

Visible `:focus-visible` ring (2px orange, offset) on every interactive element · 44px touch targets in the mobile menu · AA contrast on text in both themes · no horizontal scroll at 360px.
