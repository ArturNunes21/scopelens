import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { getProjectScope } from "@/lib/projects";
import { fetchScopedFindings } from "@/lib/findings-query";
import { meetingOf, todayUtc, type FindingRow } from "@/lib/dashboard";
import { computeHealth, HEALTH_LABEL, HEALTH_TONE } from "@/lib/health";
import { CreateProjectForm, DeleteProject, RenameProject, ShareControls } from "./project-controls";
import { AppHeader, Badge, CARD, CARD_COMPACT, ErrorText } from "@/components/ui";

// Phase 9 — projects inside a workspace: create/rename/delete, per-project
// health at a glance, and the public status-report link.
export default async function ProjectsPage() {
  const { supabase, workspaceId } = await requireWorkspace();

  const [{ projects }, { data: meetings, error: meetingsError }, { findings, error: findingsError }] =
    await Promise.all([
      getProjectScope(supabase, workspaceId, null),
      supabase.from("meetings").select("project_id").eq("workspace_id", workspaceId),
      fetchScopedFindings(supabase, workspaceId, null),
    ]);
  const error = meetingsError ?? findingsError;

  const meetingCount = new Map<string, number>();
  for (const m of meetings ?? []) {
    meetingCount.set(m.project_id, (meetingCount.get(m.project_id) ?? 0) + 1);
  }

  const findingsByProject = new Map<string, FindingRow[]>();
  for (const f of findings) {
    const projectId = meetingOf(f.meeting)?.project_id;
    if (!projectId) continue;
    const list = findingsByProject.get(projectId) ?? [];
    list.push(f);
    findingsByProject.set(projectId, list);
  }

  const today = todayUtc();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <AppHeader
          title="Projects"
          subtitle="Keep each project's meetings, trends, and decisions separate"
          active="/projects"
        />

        <section className={`mt-8 ${CARD}`}>
          <CreateProjectForm />
        </section>

        {error && <ErrorText>Could not load projects: {error.message}</ErrorText>}

        <ul className="mt-6 flex flex-col gap-3">
          {projects.map((project) => {
            const count = meetingCount.get(project.id) ?? 0;
            const health = computeHealth(findingsByProject.get(project.id) ?? [], today);
            const canDelete = count === 0 && projects.length > 1;
            return (
              <li key={project.id} className={CARD_COMPACT}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/dashboard?project=${project.id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {project.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-secondary">
                      {count} {count === 1 ? "meeting" : "meetings"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {health.score}
                    </span>
                    <Badge tone={HEALTH_TONE[health.level]}>{HEALTH_LABEL[health.level]}</Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                  <Link href={`/meetings?project=${project.id}`} className="text-accent hover:underline">
                    Meetings
                  </Link>
                  <Link href={`/brief?project=${project.id}`} className="text-accent hover:underline">
                    Pre-meeting brief
                  </Link>
                  <Link href={`/decisions?project=${project.id}`} className="text-accent hover:underline">
                    Decisions
                  </Link>
                  <RenameProject projectId={project.id} name={project.name} />
                  {canDelete && <DeleteProject projectId={project.id} />}
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  <ShareControls
                    projectId={project.id}
                    shareUrl={project.share_token ? `${siteUrl}/share/${project.share_token}` : null}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
