import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LensGraph } from "@/components/landing/lens-graph";
import { TranscriptDemo } from "@/components/landing/transcript-demo";
import { buttonClass, Wordmark } from "@/components/ui";

const REPO_URL = "https://github.com/ArturNunes21/scopelens";

// Each stage and its model, as run by src/lib/ai/pipeline.ts. A real
// sequence, so it is numbered.
const STAGES = [
  {
    title: "Extraction",
    model: "Claude Haiku",
    body: "Pulls every blocker, risk, dependency and decision out of the transcript, with owners when someone named one, and checks each against earlier meetings to spot repeats.",
  },
  {
    title: "Diagnosis",
    model: "Claude Sonnet",
    body: "Reads the same meeting three ways: where people contradicted each other, what connects to issues still open from before, and which decisions should have been made but weren't.",
  },
  {
    title: "Synthesis",
    model: "Claude Opus",
    body: "Writes a short summary in plain business language and a prioritized list of what to do next.",
  },
];

const TOOLS = [
  {
    title: "Project health",
    body: "A 0 to 100 score where every lost point is listed next to it, so the number can always be explained.",
  },
  {
    title: "Decision log",
    body: "Every decision across meetings, with the ones that were raised again or contradicted later.",
  },
  {
    title: "Pre-meeting brief",
    body: "Everything still open, ordered as an agenda. Copy it as Markdown into Slack or Notion.",
  },
  {
    title: "Public status link",
    body: "A read-only report for stakeholders. No transcripts, revocable at any time.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const primary = user
    ? { href: "/meetings", label: "Open your workspace" }
    : { href: "/login", label: "Try it with sample data" };

  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="ScopeLens home">
          <Wordmark />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 text-sm">
          <a href={REPO_URL} className="rounded px-3 py-2 text-secondary hover:text-foreground">
            Source
          </a>
          <Link href={user ? "/meetings" : "/login"} className="rounded px-3 py-2 text-foreground hover:bg-surface-2">
            {user ? "Open app" : "Sign in"}
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-8 sm:pt-24">
          <h1 className="font-display max-w-[14ch] text-[clamp(2.6rem,7.2vw,5.5rem)] leading-[0.98] text-foreground">
            Your meetings already know what&apos;s going wrong.
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-secondary">
            ScopeLens reads meeting transcripts, pulls out the blockers, risks and decisions, and keeps
            track of the ones that come back meeting after meeting.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={primary.href} className={buttonClass("primary", "px-5 py-2.5")}>
              {primary.label}
            </Link>
            <a href="#how" className={buttonClass("secondary", "px-5 py-2.5")}>
              See how it reads a meeting
            </a>
          </div>
        </section>

        <section aria-label="Illustration" className="mx-auto mt-16 max-w-6xl px-4 sm:mt-20 sm:px-8">
          <LensGraph />
        </section>

        <section id="how" className="mx-auto mt-28 max-w-6xl scroll-mt-8 px-4 sm:mt-36 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] leading-tight text-foreground">
                Every finding points back to what was said.
              </h2>
              <p className="mt-4 leading-relaxed text-secondary">
                Findings link to the transcript lines they came from, so nobody has to take a summary on
                faith. Hover one to see its source.
              </p>
              <p className="mt-4 leading-relaxed text-secondary">
                Some findings were never said out loud. The diagnosis step catches risks hiding in
                phrases like &ldquo;nobody gave me a date&rdquo;.
              </p>
            </div>
            <TranscriptDemo />
          </div>
        </section>

        <section aria-labelledby="pipeline-title" className="mx-auto mt-28 max-w-6xl px-4 sm:mt-36 sm:px-8">
          <h2 id="pipeline-title" className="font-display max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.6rem)] leading-tight text-foreground">
            Three passes over every meeting.
          </h2>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            {STAGES.map((stage, index) => (
              <li key={stage.title} className="flex flex-col bg-background p-6">
                <span className="font-display text-5xl tabular-nums text-accent-ink">{index + 1}</span>
                <h3 className="mt-6 text-base font-semibold text-foreground">{stage.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary">{stage.body}</p>
                <p className="mt-6 text-xs text-muted">{stage.model}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="tools-title" className="mx-auto mt-28 max-w-6xl px-4 sm:mt-36 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 id="tools-title" className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] leading-tight text-foreground">
                Ready before the next meeting starts.
              </h2>
              <p className="mt-4 leading-relaxed text-secondary">
                Built on data already extracted, so none of these cost an extra AI call.
              </p>
            </div>
            <dl className="grid gap-x-10 border-t border-border sm:grid-cols-2">
              {TOOLS.map((tool) => (
                <div key={tool.title} className="border-b border-border py-6">
                  <dt className="font-semibold text-foreground">{tool.title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-secondary">{tool.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="about-title" className="mt-28 bg-accent text-accent-foreground sm:mt-36">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
            <h2 id="about-title" className="font-display max-w-[18ch] text-[clamp(2.2rem,5vw,3.75rem)] leading-[1.02]">
              A portfolio project, built like a product.
            </h2>
            <p className="mt-6 max-w-[58ch] text-lg leading-relaxed">
              ScopeLens is a working app designed and built end to end by Artur Nunes: market research,
              architecture, the AI pipeline, multi-tenant security, billing and this interface. It
              isn&apos;t a commercial service, and the repository says so.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={REPO_URL}
                className="inline-flex items-center rounded bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black/80 focus-visible:outline-black"
              >
                Read the source on GitHub
              </a>
              <Link
                href={primary.href}
                className="inline-flex items-center rounded border border-black/30 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/10 focus-visible:outline-black"
              >
                {primary.label}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm text-secondary sm:px-8">
        <Wordmark />
        <span>© 2026 Artur Nunes</span>
      </footer>
    </div>
  );
}
