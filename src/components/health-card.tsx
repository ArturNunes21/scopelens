import { Badge, CARD } from "@/components/ui";
import { HEALTH_LABEL, HEALTH_TONE, type Health } from "@/lib/health";

// Phase 9 — the health score never appears as a bare number: every point
// lost is listed next to it, so the score is always explainable.
export function HealthCard({ health, title = "Project health" }: { health: Health; title?: string }) {
  return (
    <section className={CARD}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-semibold text-foreground">{health.score}</span>
            <span className="text-sm text-muted">/ 100</span>
          </p>
        </div>
        <Badge tone={HEALTH_TONE[health.level]}>{HEALTH_LABEL[health.level]}</Badge>
      </div>
      {health.factors.length === 0 ? (
        <p className="mt-3 text-sm text-secondary">Nothing open — no points lost.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {health.factors.map((factor) => (
            <li key={factor.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-secondary">
                {factor.label} <span className="text-muted">({factor.count})</span>
              </span>
              <span className="tabular-nums text-muted">−{factor.penalty}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
