"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

// The signature element (DESIGN.md): meetings drawn as columns of points
// joined by hairlines; one issue's path through them in signal orange, with
// a gap where it went unmentioned. A lens magnifies whatever sits under it.
// On its own it tours the orange nodes in order, telling what happened to
// the issue in each meeting; a mouse takes over the lens until it leaves.

const W = 1200;
const H = 440;
const COLUMN_X = Array.from({ length: 7 }, (_, i) => 80 + i * (1040 / 6));
const MEETINGS = [
  ["Kickoff", "Sep 1"],
  ["Daily", "Sep 3"],
  ["Planning", "Sep 8"],
  ["Daily", "Sep 10"],
  ["Review", "Sep 15"],
  ["Retro", "Sep 19"],
  ["Planning", "Sep 22"],
] as const;
// The recurring issue's position in each meeting; null = not mentioned.
const CHAIN_Y: (number | null)[] = [null, 262, 196, 220, null, 176, 238];
// What the lens says at each orange node, by column.
const STORY: Record<number, { title: string; body: string }> = {
  1: {
    title: "First raised",
    body: "Checkout can't integrate until the payments team delivers the webhook contract.",
  },
  2: {
    title: "Raised again",
    body: "Payments promised it “this week” with no date. Flagged as a risk nobody named.",
  },
  3: {
    title: "Third meeting in a row",
    body: "No change since planning. The checkout work is still waiting on it.",
  },
  5: {
    title: "Back after a quiet meeting",
    body: "Nobody mentioned it at the review, but it wasn't solved. The thread was kept.",
  },
  6: {
    title: "Still open",
    body: "Raised in 5 of 7 meetings, so it now leads the pre-meeting brief.",
  },
};
const STOPS = CHAIN_Y.flatMap((y, column) =>
  y === null ? [] : [{ column, x: COLUMN_X[column], y, ...STORY[column] }]
);
const START = STOPS[0];
const LENS_R = 92;
const ZOOM = 1.3;
// Time the lens rests on each node, and how long it takes to travel.
const DWELL_MS = 3200;
const TRAVEL_MS = 1100;

// Seeded PRNG so the server and client render the identical graph.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mid = (x2 - x1) / 2;
  return `M${r1(x1)} ${r1(y1)}C${r1(x1 + mid)} ${r1(y1)} ${r1(x2 - mid)} ${r1(y2)} ${r1(x2)} ${r1(y2)}`;
}

type GraphNode = { x: number; y: number; chain: boolean };

function buildGraph() {
  const rand = mulberry32(14);
  const columns: GraphNode[][] = COLUMN_X.map((x, i) => {
    const count = 7 + Math.floor(rand() * 5);
    const band = 330 / count;
    const nodes: GraphNode[] = Array.from({ length: count }, (_, k) => ({
      x,
      y: 45 + (k + 0.5) * band + (rand() - 0.5) * band * 0.8,
      chain: false,
    }));
    const chainY = CHAIN_Y[i];
    if (chainY !== null) {
      let nearest = 0;
      nodes.forEach((n, k) => {
        if (Math.abs(n.y - chainY) < Math.abs(nodes[nearest].y - chainY)) nearest = k;
      });
      nodes[nearest] = { x, y: chainY, chain: true };
    }
    return nodes;
  });

  let edges = "";
  for (let i = 0; i < columns.length - 1; i++) {
    for (const a of columns[i]) {
      const nearest = [...columns[i + 1]].sort((p, q) => Math.abs(p.y - a.y) - Math.abs(q.y - a.y)).slice(0, 3);
      const picks = rand() < 0.45 ? 2 : 1;
      for (let p = 0; p < picks; p++) {
        const b = nearest[Math.floor(rand() * nearest.length)];
        edges += curve(a.x, a.y, b.x, b.y);
      }
    }
  }

  const chainNodes = columns.flat().filter((n) => n.chain);
  const solid: string[] = [];
  const gaps: string[] = [];
  for (let k = 0; k < chainNodes.length - 1; k++) {
    const a = chainNodes[k];
    const b = chainNodes[k + 1];
    // Columns skipped between two mentions = meetings where it went unsaid.
    const skipped = Math.round((b.x - a.x) / (1040 / 6)) > 1;
    (skipped ? gaps : solid).push(curve(a.x, a.y, b.x, b.y));
  }

  return { nodes: columns.flat(), edges, solid, gaps };
}

const GRAPH = buildGraph();

function GraphLayer({ sharp }: { sharp: boolean }) {
  return (
    <>
      {COLUMN_X.map((x) => (
        <line key={x} x1={x} x2={x} y1={28} y2={392} className="stroke-foreground" strokeOpacity={sharp ? 0.12 : 0.05} strokeWidth={1} />
      ))}
      <path
        d={GRAPH.edges}
        fill="none"
        className="stroke-foreground"
        strokeOpacity={sharp ? 0.42 : 0.13}
        strokeWidth={sharp ? 0.8 : 0.75}
        vectorEffect="non-scaling-stroke"
      />
      {GRAPH.nodes
        .filter((n) => !n.chain)
        .map((n, i) => (
          <circle key={i} cx={r1(n.x)} cy={r1(n.y)} r={sharp ? 2.2 : 1.7} className="fill-foreground" fillOpacity={sharp ? 0.85 : 0.35} />
        ))}
      {GRAPH.solid.map((d) => (
        <path key={d} d={d} pathLength={1} fill="none" className="anim-trace stroke-accent" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
      ))}
      {GRAPH.gaps.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          className="anim-hairlines stroke-accent"
          style={{ animationDelay: "1.4s" }}
          strokeOpacity={0.7}
          strokeWidth={1}
          strokeDasharray="2 5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {GRAPH.nodes
        .filter((n) => n.chain)
        .map((n) => (
          <g key={n.x}>
            <circle cx={r1(n.x)} cy={r1(n.y)} r={8} className="fill-accent" fillOpacity={0.16} />
            <circle cx={r1(n.x)} cy={r1(n.y)} r={3.5} className="fill-accent" />
          </g>
        ))}
    </>
  );
}

const MOBILE_QUERY = "(max-width: 639px)";
function subscribeMobile(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// On a phone, frame the middle five meetings instead of shrinking all seven
// into an unreadable strip; the tour skips nodes outside the frame.
function framing(mobile: boolean) {
  const vb = mobile ? { x: COLUMN_X[1] - 70, w: COLUMN_X[5] - COLUMN_X[1] + 140 } : { x: 0, w: W };
  return { vb, stops: STOPS.filter((s) => s.x > vb.x && s.x < vb.x + vb.w) };
}

export function LensGraph() {
  // useId output may contain characters that break a url(#id) reference.
  const id = `lens${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
  const { vb } = framing(mobile);

  const [focus, setFocus] = useState(0);
  const focusRef = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const maskCircle = useRef<SVGCircleElement>(null);
  const clipCircle = useRef<SVGCircleElement>(null);
  const magnified = useRef<SVGGElement>(null);
  const ring = useRef<SVGGElement>(null);
  const annotation = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: START.x, y: START.y });
  const frame = useRef(0);
  const tourTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const paused = useRef(false);
  const visible = useRef(true);

  function apply() {
    const { x, y } = pos.current;
    for (const c of [maskCircle.current, clipCircle.current]) {
      c?.setAttribute("cx", String(x));
      c?.setAttribute("cy", String(y));
    }
    magnified.current?.setAttribute("transform", `translate(${x} ${y}) scale(${ZOOM}) translate(${-x} ${-y})`);
    ring.current?.setAttribute("transform", `translate(${x - START.x} ${y - START.y})`);
    // The annotation belongs to whichever orange node the lens rests on, and
    // hides while it travels or wanders off under the mouse.
    const near = STOPS.findIndex((s) => Math.hypot(x - s.x, y - s.y) < 24);
    if (near !== -1 && near !== focusRef.current) {
      focusRef.current = near;
      setFocus(near);
    }
    if (annotation.current) annotation.current.style.opacity = near === -1 ? "0" : "";
  }

  // Pointer: chase the target (lerp). Tour: eased tween of fixed duration.
  function moveTo(next: { x: number; y: number }, options?: { duration: number; onArrive: () => void }) {
    cancelAnimationFrame(frame.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = { ...pos.current };
    const startedAt = performance.now();
    const step = (now: number) => {
      const p = pos.current;
      let done: boolean;
      if (options && !reduced) {
        const t = Math.min(1, (now - startedAt) / options.duration);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        p.x = from.x + (next.x - from.x) * eased;
        p.y = from.y + (next.y - from.y) * eased;
        done = t === 1;
      } else {
        const k = reduced ? 1 : 0.14;
        p.x += (next.x - p.x) * k;
        p.y += (next.y - p.y) * k;
        done = Math.hypot(next.x - p.x, next.y - p.y) < 0.3;
        if (done) Object.assign(p, next);
      }
      apply();
      if (!done) frame.current = requestAnimationFrame(step);
      else options?.onArrive();
    };
    frame.current = requestAnimationFrame(step);
  }

  function scheduleTour(delay: number) {
    clearTimeout(tourTimer.current);
    tourTimer.current = setTimeout(() => {
      if (paused.current || !visible.current || document.hidden) {
        scheduleTour(1000);
        return;
      }
      const list = framing(window.matchMedia(MOBILE_QUERY).matches).stops;
      const current = list.findIndex((s) => s === STOPS[focusRef.current]);
      const next = list[(current + 1) % list.length];
      moveTo(next, { duration: TRAVEL_MS, onArrive: () => scheduleTour(DWELL_MS) });
    }, delay);
  }

  useEffect(() => {
    // Reduced motion: no tour. The lens rests on the latest state of the
    // issue, and still follows the mouse.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const { stops } = framing(window.matchMedia(MOBILE_QUERY).matches);
      const last = stops[stops.length - 1];
      Object.assign(pos.current, { x: last.x, y: last.y });
      apply();
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    if (svgRef.current) observer.observe(svgRef.current);
    // First move waits for the page-load draw-in to finish (globals.css).
    scheduleTour(2600 + DWELL_MS / 2);
    return () => {
      observer.disconnect();
      clearTimeout(tourTimer.current);
      cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toGraph(event: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: vb.x + ((event.clientX - rect.left) / rect.width) * vb.w,
      y: Math.min(H - 60, Math.max(40, ((event.clientY - rect.top) / rect.height) * H)),
    };
  }

  function takeOver(event: React.PointerEvent) {
    paused.current = true;
    clearTimeout(tourTimer.current);
    moveTo(toGraph(event));
  }

  function release() {
    paused.current = false;
    scheduleTour(DWELL_MS / 2);
  }

  const pct = (x: number) => `${((x - vb.x) / vb.w) * 100}%`;
  const stop = STOPS[focus];
  // Nodes in the right part of the graph get their note on the left, so it
  // never runs off the edge.
  const noteOnLeft = stop.x > W * 0.66;
  const meeting = MEETINGS[stop.column];

  return (
    <div className="relative select-none">
      {/* Own positioning box, so label offsets are a share of the graph's
          height alone (on a phone the annotation flows below it). */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} 0 ${vb.w} ${H}`}
          className="block h-auto w-full touch-pan-y overflow-visible"
          role="img"
          aria-label="Seven meetings drawn as columns of connected points. One issue, highlighted in orange, comes up in five of them and is still open. A lens moves along it."
          onPointerMove={(event) => event.pointerType === "mouse" && takeOver(event)}
          onPointerLeave={(event) => event.pointerType === "mouse" && release()}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") return;
            // A tap moves the lens there and holds the tour for a moment.
            takeOver(event);
            clearTimeout(tourTimer.current);
            tourTimer.current = setTimeout(release, 4000);
          }}
        >
          <defs>
            <mask id={`${id}-outside`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <rect width={W} height={H} fill="white" />
              <circle ref={maskCircle} cx={START.x} cy={START.y} r={LENS_R} fill="black" />
            </mask>
            <clipPath id={`${id}-inside`}>
              <circle ref={clipCircle} cx={START.x} cy={START.y} r={LENS_R} />
            </clipPath>
          </defs>

          <g mask={`url(#${id}-outside)`} className="anim-hairlines">
            <GraphLayer sharp={false} />
          </g>

          <g clipPath={`url(#${id}-inside)`} className="anim-hairlines">
            <g ref={magnified} transform={`translate(${START.x} ${START.y}) scale(${ZOOM}) translate(${-START.x} ${-START.y})`}>
              <GraphLayer sharp />
            </g>
          </g>

          <g ref={ring}>
            <g className="anim-settle">
              <circle cx={START.x} cy={START.y} r={LENS_R} fill="none" className="stroke-foreground" strokeOpacity={0.7} strokeWidth={1} />
              <circle cx={START.x} cy={START.y} r={LENS_R + 7} fill="none" className="stroke-foreground" strokeOpacity={0.14} strokeWidth={1} />
              <path
                d={`M${START.x + LENS_R * 0.71 + 5} ${START.y + LENS_R * 0.71 + 5}l26 26`}
                className="stroke-foreground"
                strokeOpacity={0.7}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </g>
          </g>
        </svg>

        <ol aria-hidden className="pointer-events-none">
          {MEETINGS.map(([name, date], i) => {
            const x = COLUMN_X[i];
            if (x < vb.x + 20 || x > vb.x + vb.w - 20) return null;
            return (
              <li
                key={i}
                className="absolute -translate-x-1/2 text-center"
                style={{ left: pct(x), top: `${(400 / H) * 100}%` }}
              >
                <span className="block text-xs text-secondary">{name}</span>
                <span className="block text-[0.7rem] tabular-nums text-muted">{date}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* The full story for screen readers; the visual note below only
          shows the node the lens is on. */}
      <ol className="sr-only">
        {STOPS.map((s) => (
          <li key={s.column}>
            {MEETINGS[s.column].join(", ")}: {s.title}. {s.body}
          </li>
        ))}
      </ol>

      {/* Outer div fades with the lens position; the inner one carries the
          entrance animation (an animation would override inline opacity). */}
      <div
        ref={annotation}
        aria-hidden
        className={`pointer-events-none mt-12 transition-opacity duration-300 sm:absolute sm:mt-0 sm:w-64 ${
          noteOnLeft ? "sm:text-right" : ""
        }`}
        style={
          mobile
            ? undefined
            : {
                top: `${((stop.y - 34) / H) * 100}%`,
                ...(noteOnLeft
                  ? { right: `${((vb.x + vb.w - (stop.x - LENS_R - 36)) / vb.w) * 100}%` }
                  : { left: pct(stop.x + LENS_R + 36) }),
              }
        }
      >
        {/* A soft backing so the note stays legible over the hairlines. */}
        <div className="anim-rise sm:-m-2 sm:rounded sm:bg-background/85 sm:p-2">
          <p className="text-xs tabular-nums text-muted">
            {meeting[0]}, {meeting[1]}
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{stop.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-secondary">{stop.body}</p>
        </div>
      </div>
    </div>
  );
}
