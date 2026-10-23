"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";

// The signature element (DESIGN.md): meetings drawn as columns of points
// joined by hairlines; one issue's path through them in signal orange, with
// a gap where it went unmentioned. A lens magnifies whatever sits under it
// and follows the pointer, settling back on the recurring issue.

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
const HOME = { x: COLUMN_X[3], y: 220 };
const LENS_R = 92;
const ZOOM = 1.3;

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

export function LensGraph() {
  // useId output may contain characters that break a url(#id) reference.
  const id = `lens${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
  // On a phone, frame the three meetings around the lens instead of
  // shrinking all seven into an unreadable strip.
  const vb = mobile ? { x: COLUMN_X[2] - 110, w: COLUMN_X[4] - COLUMN_X[2] + 220 } : { x: 0, w: W };

  const svgRef = useRef<SVGSVGElement>(null);
  const maskCircle = useRef<SVGCircleElement>(null);
  const clipCircle = useRef<SVGCircleElement>(null);
  const magnified = useRef<SVGGElement>(null);
  const ring = useRef<SVGGElement>(null);
  const annotation = useRef<HTMLDivElement>(null);
  const pos = useRef({ ...HOME });
  const target = useRef({ ...HOME });
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function apply() {
    const { x, y } = pos.current;
    for (const c of [maskCircle.current, clipCircle.current]) {
      c?.setAttribute("cx", String(x));
      c?.setAttribute("cy", String(y));
    }
    magnified.current?.setAttribute("transform", `translate(${x} ${y}) scale(${ZOOM}) translate(${-x} ${-y})`);
    ring.current?.setAttribute("transform", `translate(${x - HOME.x} ${y - HOME.y})`);
    if (annotation.current) {
      const away = Math.hypot(x - HOME.x, y - HOME.y) > 24;
      annotation.current.style.opacity = away ? "0" : "";
    }
  }

  function moveTo(next: { x: number; y: number }) {
    target.current = next;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cancelAnimationFrame(frame.current);
    const step = () => {
      const p = pos.current;
      const t = target.current;
      const k = reduced ? 1 : 0.14;
      p.x += (t.x - p.x) * k;
      p.y += (t.y - p.y) * k;
      if (Math.hypot(t.x - p.x, t.y - p.y) < 0.3) {
        p.x = t.x;
        p.y = t.y;
        apply();
        return;
      }
      apply();
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }

  function toGraph(event: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: vb.x + ((event.clientX - rect.left) / rect.width) * vb.w,
      y: Math.min(H - 60, Math.max(40, ((event.clientY - rect.top) / rect.height) * H)),
    };
  }

  const pct = (x: number) => `${((x - vb.x) / vb.w) * 100}%`;

  return (
    <div className="relative select-none">
      {/* Own positioning box, so label offsets are a share of the graph's
          height alone (on a phone the annotation flows below it). */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} 0 ${vb.w} ${H}`}
          className="block h-auto w-full touch-pan-y"
          role="img"
          aria-label="Seven meetings drawn as columns of connected points. One issue, highlighted in orange, comes up in five of them and is still open. A lens magnifies it."
          onPointerMove={(event) => event.pointerType === "mouse" && moveTo(toGraph(event))}
          onPointerDown={(event) => event.pointerType !== "mouse" && moveTo(toGraph(event))}
          onPointerLeave={(event) => event.pointerType === "mouse" && moveTo(HOME)}
        >
          <defs>
            <mask id={`${id}-outside`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <rect width={W} height={H} fill="white" />
              <circle ref={maskCircle} cx={HOME.x} cy={HOME.y} r={LENS_R} fill="black" />
            </mask>
            <clipPath id={`${id}-inside`}>
              <circle ref={clipCircle} cx={HOME.x} cy={HOME.y} r={LENS_R} />
            </clipPath>
          </defs>

          <g mask={`url(#${id}-outside)`} className="anim-hairlines">
            <GraphLayer sharp={false} />
          </g>

          <g clipPath={`url(#${id}-inside)`} className="anim-hairlines">
            <g ref={magnified} transform={`translate(${HOME.x} ${HOME.y}) scale(${ZOOM}) translate(${-HOME.x} ${-HOME.y})`}>
              <GraphLayer sharp />
            </g>
          </g>

          <g ref={ring}>
            <g className="anim-settle">
              <circle cx={HOME.x} cy={HOME.y} r={LENS_R} fill="none" className="stroke-foreground" strokeOpacity={0.7} strokeWidth={1} />
              <circle cx={HOME.x} cy={HOME.y} r={LENS_R + 7} fill="none" className="stroke-foreground" strokeOpacity={0.14} strokeWidth={1} />
              <path
                d={`M${HOME.x + LENS_R * 0.71 + 5} ${HOME.y + LENS_R * 0.71 + 5}l26 26`}
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

      {/* Outer div fades with the lens position; the inner one carries the
          entrance animation (an animation would override inline opacity). */}
      <div
        ref={annotation}
        className="pointer-events-none mt-12 transition-opacity duration-300 sm:absolute sm:mt-0 sm:w-64"
        style={mobile ? undefined : { left: pct(HOME.x + LENS_R + 44), top: `${((HOME.y + 18) / H) * 100}%` }}
      >
        <div className="anim-rise">
          <p className="text-sm font-medium text-foreground">Checkout blocked on the payments webhook</p>
          <p className="mt-0.5 text-xs text-secondary">
            Raised in 5 of 7 meetings. <span className="text-accent-ink">Still open.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
