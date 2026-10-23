import Link from "next/link";
import { signOut } from "@/app/login/logout-action";
import { withProject } from "@/lib/projects";
import { ProjectSwitcher } from "@/components/project-switcher";
import { MobileNav, ThemeToggle } from "@/components/app-shell-client";
import { buttonClass, Wordmark } from "@/components/ui";

// `scoped` items are project-aware pages (Phase 9): their link carries the
// current ?project= along so switching pages keeps the same filter.
const NAV_ITEMS = [
  { href: "/meetings", label: "Meetings", scoped: true, icon: "M3 4h10M3 8h10M3 12h6" },
  { href: "/dashboard", label: "Dashboard", scoped: true, icon: "M3 13V9m5 4V3m5 10V6" },
  { href: "/decisions", label: "Decision log", scoped: true, icon: "M3 8.5l3 3 7-7" },
  { href: "/brief", label: "Pre-meeting brief", scoped: true, icon: "M5 3h6M3 6.5h10v6.5H3zM6 9.5h4" },
  { href: "/projects", label: "Projects", scoped: false, icon: "M2.5 4.5h4l1.5 1.5h5.5v6.5h-11z" },
] as const;

export type NavHref = (typeof NAV_ITEMS)[number]["href"] | "/billing";

function NavIcon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function navLinkClass(isActive: boolean): string {
  return `relative flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
    isActive
      ? "bg-surface-2 text-foreground before:absolute before:inset-y-2 before:-left-3 before:w-0.5 before:rounded-full before:bg-accent"
      : "text-secondary hover:bg-surface-2 hover:text-foreground"
  }`;
}

function SidebarContent({
  active,
  projects,
  projectId,
}: {
  active: NavHref | null;
  projects: { id: string; name: string }[];
  projectId: string | null;
}) {
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <Link href="/" className="hidden px-2 lg:block" aria-label="ScopeLens home">
        <Wordmark />
      </Link>

      <div className="flex flex-col gap-2">
        <ProjectSwitcher projects={projects} projectId={projectId} />
        <Link
          href={withProject("/meetings/new", projectId)}
          className={buttonClass("primary", "w-full")}
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          New meeting
        </Link>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-0.5 pl-3 -ml-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.scoped ? withProject(item.href, projectId) : item.href}
            aria-current={active === item.href ? "page" : undefined}
            className={navLinkClass(active === item.href)}
          >
            <NavIcon d={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <Link
          href="/billing"
          aria-current={active === "/billing" ? "page" : undefined}
          className={navLinkClass(active === "/billing")}
        >
          <NavIcon d="M2.5 4h11v8h-11zM2.5 7h11" />
          Plan and billing
        </Link>
        <div className="flex items-center justify-between gap-2 px-3">
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit" className="rounded px-2 py-1 text-sm text-secondary hover:bg-surface-2 hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Frame for every signed-in page: sidebar on desktop, top bar + slide-over
// menu below `lg`. The current project is always visible in the switcher,
// never buried in a page body (Phase 10).
export function AppShell({
  active,
  projects,
  projectId,
  wide = false,
  children,
}: {
  active: NavHref | null;
  projects: { id: string; name: string }[];
  projectId: string | null;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const sidebar = <SidebarContent active={active} projects={projects} projectId={projectId} />;

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface lg:block">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav>{sidebar}</MobileNav>
        <main
          className={`mx-auto w-full flex-1 px-4 pt-6 pb-16 sm:px-8 lg:pt-12 ${wide ? "max-w-6xl" : "max-w-4xl"}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
