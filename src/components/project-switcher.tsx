"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FIELD_CLASS } from "@/components/ui";

// Phase 9 — the current project lives in the URL (?project=<id>), so this
// only rewrites the query string; each page re-reads it server-side.
export function ProjectSwitcher({
  projects,
  projectId,
  allowAll = true,
}: {
  projects: { id: string; name: string }[];
  projectId: string | null;
  allowAll?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="project-switcher" className="text-xs text-secondary">
        Project
      </label>
      <select
        id="project-switcher"
        value={projectId ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          router.push(next ? `${pathname}?project=${next}` : pathname);
        }}
        className={`${FIELD_CLASS} py-1.5`}
      >
        {allowAll && <option value="">All projects</option>}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <Link href="/projects" className="text-xs text-secondary hover:text-foreground">
        Manage
      </Link>
    </div>
  );
}
