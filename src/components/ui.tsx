import Link from "next/link";
import { signOut } from "@/app/login/logout-action";

// Shared design-system primitives (ROADMAP.md Phase 8 — visual pass). Plain
// functions/components, no client-side state, so they work from Server
// Components too; pages that need interactivity wrap these with their own
// "use client" leaf components (see finding-resolve-toggle.tsx etc.).

export const CARD = "rounded-lg border border-border bg-surface p-6";
export const CARD_COMPACT = "rounded-lg border border-border bg-surface p-4";
export const CARD_CENTERED = "rounded-lg border border-border bg-surface p-8 text-center";

export const FIELD_CLASS =
  "rounded border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

type ButtonVariant = "primary" | "secondary" | "ghost";

const BUTTON_BASE = "rounded px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50";
const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-[#1c5cab] dark:hover:bg-[#5598e7]",
  secondary: "border border-border text-foreground hover:border-accent",
  ghost: "text-secondary hover:text-foreground",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${extra}`.trim();
}

type BadgeTone = "neutral" | "accent" | "good" | "warning" | "serious" | "critical";

// Status colors are reserved for actual state (good/warning/serious/critical)
// and never doubles as a generic categorical color — see the dataviz skill.
const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-black/[.05] text-secondary dark:bg-white/[.08]",
  accent: "bg-accent/10 text-accent",
  good: "bg-status-good-bg text-status-good",
  warning: "bg-status-warning-bg text-[#8a5a00] dark:text-status-warning",
  serious: "bg-status-serious-bg text-[#9a3f1f] dark:text-status-serious",
  critical: "bg-status-critical-bg text-status-critical",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONE[tone]}`}
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
    <div className={CARD_CENTERED}>
      <p className="text-sm text-secondary">{message}</p>
      {children && <div className="mt-4 flex items-center justify-center gap-4">{children}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-status-critical">{children}</p>;
}

const NAV_ITEMS = [
  { href: "/meetings", label: "Meetings" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/billing", label: "Billing" },
] as const;

// Shared top bar for every authenticated page — title/subtitle slot on the
// left, the same nav + sign-out on the right everywhere, so a page's
// position in the app never has to be rediscovered from a bespoke header.
export function AppHeader({
  title,
  subtitle,
  active,
  actions,
}: {
  title: string;
  subtitle?: string;
  active: (typeof NAV_ITEMS)[number]["href"];
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-secondary">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {NAV_ITEMS.filter((item) => item.href !== active).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm text-secondary hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
        {actions}
        <form action={signOut}>
          <button type="submit" className="text-sm text-secondary hover:text-foreground">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
