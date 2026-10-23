import Link from "next/link";

// Shared design-system primitives (DESIGN.md). Plain functions/components,
// no client-side state, so they work from Server Components too; pages that
// need interactivity wrap these with their own "use client" leaf components
// (see finding-resolve-toggle.tsx etc.).

export const CARD = "rounded-lg border border-border bg-surface p-6";
export const CARD_COMPACT = "rounded-lg border border-border bg-surface p-4";
export const CARD_CENTERED = "rounded-lg border border-border bg-surface p-8 text-center";

// Hairline-separated section on the page background — the default container
// in the app; boxed CARDs are kept for things that are a separate object.
export const SECTION = "border-t border-border pt-6";
export const SECTION_TITLE = "text-sm font-semibold text-foreground";

export const FIELD_CLASS =
  "rounded border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent";

type ButtonVariant = "primary" | "secondary" | "ghost";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded px-3.5 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-ink",
  secondary: "border border-border text-foreground hover:border-secondary hover:bg-surface-2",
  ghost: "text-secondary hover:bg-surface-2 hover:text-foreground",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${extra}`.trim();
}

export const LINK_CLASS = "text-accent-ink underline-offset-4 hover:underline";

type BadgeTone = "neutral" | "accent" | "good" | "warning" | "serious" | "critical";

// Orange means "needs attention" and its intensity carries the severity:
// critical = solid fill, serious = tint, accent = outline only (DESIGN.md).
const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-secondary",
  accent: "text-accent-ink ring-1 ring-inset ring-accent/50",
  good: "bg-status-good-bg text-status-good",
  warning: "bg-status-warning-bg text-status-warning",
  serious: "bg-status-serious-bg text-status-serious",
  critical: "bg-accent text-accent-foreground",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm text-secondary">{message}</p>
      {children && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{children}</div>
      )}
    </div>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-status-critical">{children}</p>;
}

// Title block at the top of every app page. The back link replaces a
// breadcrumb on detail pages; actions sit on the right on desktop and wrap
// under the title on a phone.
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  aside,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  aside?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-foreground"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3 5 8l5 5" />
          </svg>
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl text-foreground sm:text-[1.75rem]">{title}</h1>
            {aside}
          </div>
          {subtitle && <div className="mt-1.5 max-w-2xl text-sm text-secondary">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// Metadata row: items separated by spacing rather than "A · B · C" strings.
export function Meta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary ${className}`}>
      {children}
    </div>
  );
}

// The mark: a lens ring with the one orange node it is focused on — the
// landing's lens graph reduced to a glyph (DESIGN.md "Signature element").
export function LogoMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="11" cy="11" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M17 17l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 13.5 9 9.5l4 2.5" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
      <circle cx="13" cy="12" r="2.25" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-foreground ${className}`}>
      <LogoMark />
      <span className="font-wide text-[0.95rem] font-semibold tracking-tight">ScopeLens</span>
    </span>
  );
}
