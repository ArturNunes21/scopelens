"use client";

import { useMemo, useState } from "react";
import type { TrendPoint } from "@/lib/dashboard";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// weekKey (src/lib/dashboard.ts) produces a date-only "YYYY-MM-DD" string,
// which `new Date()` parses as UTC midnight. Formatting that in the viewer's
// LOCAL timezone (the default) would roll it back a day for any negative UTC
// offset (most of the Americas) — pin the format to UTC so the label always
// matches the UTC week-start weekKey actually computed.
function formatWeek(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Ordinal x-axis (evenly spaced weeks) rather than a true time scale — sparse
// meeting cadence would otherwise compress most points into a corner.
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxValue = niceMax(Math.max(...data.map((d) => Math.max(d.open, d.resolved))));

  const xFor = (i: number) =>
    data.length === 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (i / (data.length - 1)) * plotWidth;
  const yFor = (v: number) => PAD_TOP + plotHeight - (v / maxValue) * plotHeight;

  const openPath = useMemo(
    () => data.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(d.open)}`).join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, maxValue]
  );
  const resolvedPath = useMemo(
    () => data.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(d.resolved)}`).join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, maxValue]
  );

  const yTicks = [0, maxValue / 2, maxValue];
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(xFor(i) - px);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-4 text-xs text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded-full bg-muted" />
          Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded-full bg-status-good" />
          Resolved
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-2 w-full touch-none"
        role="img"
        aria-label="Open versus resolved findings over time"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yFor(tick)}
              y2={yFor(tick)}
              className="stroke-gridline"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 8}
              y={yFor(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted text-[9px]"
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {data.map((d, i) =>
          i === 0 || i === data.length - 1 || i === hoverIndex ? (
            <text
              key={d.week}
              x={xFor(i)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              className="fill-muted text-[9px]"
            >
              {formatWeek(d.week)}
            </text>
          ) : null
        )}

        {hoverIndex !== null && (
          <line
            x1={xFor(hoverIndex)}
            x2={xFor(hoverIndex)}
            y1={PAD_TOP}
            y2={PAD_TOP + plotHeight}
            className="stroke-gridline"
            strokeWidth={1}
          />
        )}

        <path
          d={openPath}
          fill="none"
          className="stroke-muted"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={resolvedPath}
          fill="none"
          className="stroke-status-good"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((d, i) => (
          <g key={d.week}>
            <circle
              cx={xFor(i)}
              cy={yFor(d.open)}
              r={4}
              className="fill-muted stroke-surface"
              strokeWidth={2}
            />
            <circle
              cx={xFor(i)}
              cy={yFor(d.resolved)}
              r={4}
              className="fill-status-good stroke-surface"
              strokeWidth={2}
            />
          </g>
        ))}

        <text
          x={xFor(data.length - 1) - 6}
          y={yFor(data[data.length - 1].open) - 8}
          textAnchor="end"
          className="fill-secondary text-[10px] font-medium"
        >
          {data[data.length - 1].open}
        </text>
        <text
          x={xFor(data.length - 1) - 6}
          y={yFor(data[data.length - 1].resolved) - 8}
          textAnchor="end"
          className="fill-status-good text-[10px] font-medium"
        >
          {data[data.length - 1].resolved}
        </text>
      </svg>

      {hovered && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded border border-border bg-surface px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: `${(xFor(hoverIndex) / WIDTH) * 100}%`,
          }}
        >
          <p className="font-medium text-foreground">{formatWeek(hovered.week)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-secondary">
            <span className="inline-block h-0.5 w-3 rounded-full bg-muted" />
            <span className="font-medium text-foreground">{hovered.open}</span> open
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-secondary">
            <span className="inline-block h-0.5 w-3 rounded-full bg-status-good" />
            <span className="font-medium text-foreground">{hovered.resolved}</span> resolved
          </p>
        </div>
      )}
    </div>
  );
}
