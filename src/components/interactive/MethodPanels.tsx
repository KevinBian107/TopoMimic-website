import { useCallback, useMemo, useState } from "react";
import LoopVideo from "./LoopVideo";
import { asset, BEHAVIOR_COLORS } from "./util";

interface Vid {
  src: string;
  poster: string;
  fps?: number;
  start?: number;
}
interface Prim extends Vid {
  type: "cycle" | "path";
  frames: [number, number];
  stride: number;
}
interface W2Vid extends Vid {
  role: "anchor" | "same" | "different";
  cluster: number;
  label: string;
  clip: number;
  frames: [number, number];
  w2sq: number | null;
}
export interface MethodData {
  clip: number;
  n_frames: number;
  labels: string[];
  tau: number;
  offset: number;
  overview: Vid;
  takens: Vid & { window: [number, number] };
  density: Vid & { rho: number[]; speed: number[]; skeleton: number[] };
  primitives: Prim[];
  noise?: number[];
  w2: W2Vid[];
}

const CYC = ["#d62728", "#9467bd", "#e377c2", "#8c564b"];
const PTH = ["#2ca02c", "#1f77b4", "#17becf"];
export const primColor = (ps: { type: string }[], i: number) => {
  const k = ps.slice(0, i).filter((p) => p.type === ps[i].type).length;
  return ps[i].type === "cycle" ? CYC[k % CYC.length] : PTH[k % PTH.length];
};
const pretty = (s: string) => s.replace(/->/g, "→");
const primName = (d: MethodData, i: number) => `DM-${d.primitives[i].type} ${d.primitives.slice(0, i).filter((q) => q.type === d.primitives[i].type).length + 1}`;
const primBars = (d: MethodData) =>
  d.primitives.map((p, i) => ({
    a: p.frames[0],
    b: p.frames[1],
    color: primColor(d.primitives, i),
    label: primName(d, i) + (d.noise?.includes(i) ? " (noise)" : ""),
  }));

function useFrame(fps: number, start: number) {
  const [f, setF] = useState(start);
  const onTime = useCallback((t: number) => setF(start + Math.floor(t * fps)), [fps, start]);
  return [f, onTime] as const;
}

/** Ground-truth behavior strip over [lo, hi) with optional overlays and a playhead. */
function Timeline({
  labels,
  lo,
  hi,
  frame,
  bars = [],
  rho,
  speed,
  ticks,
  bracket,
}: {
  labels: string[];
  lo: number;
  hi: number;
  frame?: number;
  bars?: { a: number; b: number; color: string; label?: string; on?: boolean }[];
  rho?: number[];
  speed?: number[];
  ticks?: number[];
  bracket?: [number, number];
}) {
  const n = hi - lo;
  const pct = (f: number) => `${(100 * (f - lo)) / n}%`;
  const runs = useMemo(() => {
    const r: { b: string; s: number; e: number }[] = [];
    for (let i = lo; i < hi; i++) {
      const b = labels[i] ?? "";
      if (r.length && r[r.length - 1].b === b) r[r.length - 1].e = i + 1;
      else r.push({ b, s: i, e: i + 1 });
    }
    return r;
  }, [labels, lo, hi]);
  return (
    <div className="mt-2 select-none">
      {rho && (
        <svg viewBox={`0 0 ${n} 40`} preserveAspectRatio="none" className="mb-1 block h-10 w-full">
          <defs>
            <linearGradient id="rhoGrad" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0" stopColor="rgb(56,107,217)" />
              <stop offset="1" stopColor="rgb(235,77,46)" />
            </linearGradient>
          </defs>
          <path d={"M0,40 " + rho.slice(lo, hi).map((r, i) => `L${i},${40 - r * 36}`).join(" ") + ` L${n},40 Z`} fill="url(#rhoGrad)" opacity={0.85} />
          {speed && (
            <path d={speed.slice(lo, hi).map((v, i) => `${i ? "L" : "M"}${i},${40 - v * 36}`).join(" ")} fill="none" stroke="#18181b" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          )}
          {ticks?.filter((t) => t >= lo && t < hi).map((t) => <line key={t} x1={t - lo} x2={t - lo} y1={0} y2={4} stroke="#18181b" strokeWidth={0.6} />)}
        </svg>
      )}
      <div className="relative h-3.5 overflow-hidden rounded-sm">
        {runs.map((r) => (
          <div key={r.s} className="absolute top-0 h-full" style={{ left: pct(r.s), width: pct(lo + r.e - r.s), background: BEHAVIOR_COLORS[r.b] ?? "#e4e4e7" }} title={r.b} />
        ))}
        {bracket && <div className="absolute top-0 h-full border-x-2 border-black bg-white/45" style={{ left: pct(bracket[0]), width: pct(lo + bracket[1] - bracket[0]) }} />}
        {frame !== undefined && <div className="absolute top-0 h-full w-0.5 bg-black" style={{ left: pct(frame) }} />}
      </div>
      {bars.length > 0 && (
        <div className="relative mt-1.5" style={{ height: bars.length * 13 + 2 }}>
          {bars.map((b, i) => (
            <div key={i} className="absolute h-1.5 rounded-full transition-opacity" style={{ left: pct(b.a), width: pct(lo + b.b - b.a), top: i * 13 + 2, background: b.color, opacity: b.on === false ? 0.25 : 1 }} />
          ))}
          {bars.map((b, i) =>
            b.label ? (
              <span key={`l${i}`} className="absolute text-[9.5px] leading-none whitespace-nowrap" style={{ left: `calc(${pct(b.b)} + 4px)`, top: i * 13 - 1, color: b.color }}>
                {b.label}
              </span>
            ) : null,
          )}
          {frame !== undefined && <div className="absolute top-0 h-full w-px bg-black/60" style={{ left: pct(frame) }} />}
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
      {Object.entries(BEHAVIOR_COLORS).map(([k, v]) => (
        <span key={k} className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: v }} />
          {k}
        </span>
      ))}
    </div>
  );
}

const videoCls = "mx-auto block aspect-[1088/960] w-full max-w-[23rem] rounded-lg bg-zinc-300 object-cover";

export function OverviewPanel({ d, base }: { d: MethodData; base: string }) {
  const [f, onTime] = useFrame(30, 0);
  const bars = primBars(d);
  return (
    <div>
      <LoopVideo src={asset(base, d.overview.src)} poster={asset(base, d.overview.poster)} className={videoCls} onTime={onTime} />
      <Timeline labels={d.labels} lo={0} hi={d.n_frames} frame={f} bars={bars} />
      <div className="mt-1 text-[11px] text-zinc-500">
        clip {d.clip}, real time. Strip: ground-truth behavior. Rows below it: the {d.primitives.length} DM primitives the pipeline cuts from this clip in intention space, each drawn over the frames it covers (reds and purples = DM-cycles, green = DM-path).
      </div>
      <Legend />
    </div>
  );
}

export function TakensPanel({ d, base }: { d: MethodData; base: string }) {
  const [f, onTime] = useFrame(15, d.takens.window[0]);
  const t = Math.min(f, d.takens.window[1] - 1);
  return (
    <div>
      <LoopVideo src={asset(base, d.takens.src)} poster={asset(base, d.takens.poster)} className={videoCls} onTime={onTime} />
      <Timeline labels={d.labels} lo={d.takens.window[0]} hi={d.takens.window[1]} frame={t} bracket={[t - 2 * d.tau, t + 1]} />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-300">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ee9e52]" /> pₜ (now)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#9e9ea8]" /> pₜ₋τ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#cfcfd6]" /> pₜ₋₂τ
        </span>
        <span className="text-zinc-400">τ = {d.tau} frames · half speed</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
        The three bodies are one point of the Takens cloud: the pose now and the poses τ and 2τ frames ago (the bracket on the strip). A still pose is ambiguous; the triple says which way the body is moving.
      </p>
    </div>
  );
}

export function DensityPanel({ d, base }: { d: MethodData; base: string }) {
  const [f, onTime] = useFrame(30, 0);
  return (
    <div>
      <LoopVideo src={asset(base, d.density.src)} poster={asset(base, d.density.poster)} className={videoCls} onTime={onTime} />
      <Timeline labels={d.labels} lo={0} hi={d.n_frames} frame={f} rho={d.density.rho} speed={d.density.speed} ticks={d.density.skeleton} />
      <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
        <span>dense</span>
        <span className="inline-block h-2 w-20 rounded-full bg-gradient-to-r from-[rgb(56,107,217)] to-[rgb(235,77,46)]" />
        <span>sparse (ρ, filled)</span>
        <span className="ml-3 inline-block h-0.5 w-5 bg-zinc-900" />
        <span>joint-angle speed</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
        The body is tinted by the k-NN inverse density ρ of its Takens point (filled trace). <b>Sparse means moving.</b> While the rat holds a rear, consecutive frames barely change, so their Takens points pile up and the region is dense (blue). When it walks, every frame is a new configuration, the points spread out and the region is sparse (red): here the median ρ of the walk is three to five times that of the two rears. The black line is joint-angle speed, which ρ follows closely (Spearman 0.96 in this clip; median 0.93 over all 842 clips, positive in every one). The skeleton's ridges join the dense, held behaviors through these sparse, moving stretches, which is where transitions live. Ticks mark frames whose point is a vertex of the DM skeleton.
      </p>
    </div>
  );
}

export function PrimitivesPanel({ d, base }: { d: MethodData; base: string }) {
  const bars = primBars(d);
  const shown = d.primitives.map((_, i) => i).filter((i) => !d.noise?.includes(i));
  const noise = d.noise ?? [];
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {shown.map((i) => {
          const p = d.primitives[i];
          return (
            <div key={i}>
              <LoopVideo src={asset(base, p.src)} poster={asset(base, p.poster)} className="block aspect-[1088/960] w-full rounded-md bg-zinc-300 object-cover" />
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: primColor(d.primitives, i) }} />
                <b>{primName(d, i)}</b>
                <span className="text-zinc-400">
                  {p.frames[0]}–{p.frames[1]} · {p.stride / 2}×
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <Timeline labels={d.labels} lo={0} hi={d.n_frames} bars={bars} />
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
        The stored intention primitives of clip {d.clip}, replayed with the six poses dropped as the amber body passes them; the bars place each one in the clip. A DM-cycle is a stretch whose way out and way back differ; a DM-path is a corridor between two dense stretches.
        {noise.length > 0 && (
          <>
            {" "}
            {noise.map((i) => primName(d, i)).join(" and ")} cover the same frames inside the first rear, where the body barely moves; they are small noise loops the extraction also keeps, so we show their bars but not their videos.
          </>
        )}
      </p>
      <Legend />
    </div>
  );
}

export function W2VideoPanel({ d, base }: { d: MethodData; base: string }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {d.w2.map((w) => (
          <div key={w.role}>
            <LoopVideo src={asset(base, w.src)} poster={asset(base, w.poster)} className="block aspect-[1088/960] w-full rounded-md bg-zinc-300 object-cover" />
            <div className="mt-1 text-[11px] leading-tight">
              <div className="font-semibold text-zinc-800 dark:text-zinc-100">{w.role === "anchor" ? "primitive A" : w.role === "same" ? "B · same cluster" : "C · other cluster"}</div>
              <div className="text-zinc-500">{pretty(w.label)}</div>
              <div className="font-mono text-zinc-700 dark:text-zinc-200">{w.w2sq === null ? "reference" : `W₂²(A,·) = ${w.w2sq.toFixed(1)}`}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-zinc-500">
        Three real intention DM-cycles. Each is read as a set of 100 frames and compared by exact optimal transport in the 16-d intention space. A and B, from the same cluster, are closer than A and C. Distances like these, for every pair of primitives, are what MDS and K-means cluster.
      </p>
    </div>
  );
}
