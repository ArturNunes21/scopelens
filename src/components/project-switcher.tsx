"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Pages that read ?project= themselves; switching on any other page (a
// meeting's detail, /projects, /billing) lands on that project's meetings.
const SCOPED_PATHS = ["/meetings", "/dashboard", "/decisions", "/brief"];

// Phase 9 — the current project lives in the URL (?project=<id>), so this
// only rewrites the query string; each page re-reads it server-side.
// Phase 10 — lives in the sidebar, so the current project is never hidden.
export function ProjectSwitcher({
  projects,
  projectId,
}: {
  projects: { id: string; name: string }[];
  projectId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const base = SCOPED_PATHS.includes(pathname) ? pathname : "/meetings";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-0.5">
        <label htmlFor="project-switcher" className="text-xs text-muted">
          Project
        </label>
        <Link href="/projects" className="text-xs text-muted hover:text-foreground">
          Manage
        </Link>
      </div>
      <div className="relative">
        <select
          id="project-switcher"
          value={projectId ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            router.push(next ? `${base}?project=${next}` : base);
          }}
          className="w-full appearance-none truncate rounded border border-border bg-surface-2 py-2 pr-8 pl-3 text-sm font-medium text-foreground outline-none transition-colors hover:border-secondary focus:border-accent"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
        </svg>
      </div>
    </div>
  );
}
