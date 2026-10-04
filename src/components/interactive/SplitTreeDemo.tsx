import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Figure 3B, animated. The synthetic skeleton of the paper (a split tree plus one loop,
 * topo_mimic/figure_generation/dm_primitives.dm_skeleton) is decomposed in two steps:
 * the minimum cycle basis is removed first (DM-cycle), then a density level sweeps down
 * the remaining split tree; at each saddle the younger peak dies (elder rule), and every
 * (peak, saddle) pair is one DM-path, plus the essential global-max to global-min path.
 */

type N = "r" | "s1" | "s2" | "ma" | "mb" | "mc" | "p0" | "p1" | "p2";
const POS: Record<N, [number, number]> = {
  r: [0.0, 0.0],
  s1: [0.0, 1.0],
  s2: [0.95, 2.0],
  ma: [-1.7, 2.9],
  mb: [0.15, 3.45],
  mc: [1.7, 2.8],
  p0: [2.5, 3.25],
  p1: [3.05, 2.5],
  p2: [2.4, 1.95],
};
const TREE: [N, N][] = [
  ["r", "s1"],
  ["s1", "ma"],
  ["s1", "s2"],
  ["s2", "mb"],
  ["s2", "mc"],
];
const LOOP: [N, N][] = [
  ["mc", "p0"],
  ["p0", "p1"],
  ["p1", "p2"],
  ["p2", "mc"],
];
interface Pair {
  seq: N[];
  kind: "ordinary" | "essential";
  death: number;
  color: string;
  fill: string;
  label: string;
}
const PAIRS: Pair[] = [
  { seq: ["mc", "s2"], kind: "ordinary", death: 2.0, color: "#4daf4a", fill: "#ccebc5", label: "peak c dies at saddle 2" },
  { seq: ["ma", "s1"], kind: "ordinary", death: 1.0, color: "#e41a1c", fill: "#fbb4ae", label: "peak a dies at saddle 1" },
  { seq: ["mb", "s2", "s1", "r"], kind: "essential", death: 0.0, color: "#1f78b4", fill: "#a6cee3", label: "essential: global max to global min" },
];
const PEAKS: { n: N; name: string }[] = [
  { n: "mb", name: "b" },
  { n: "ma", name: "a" },
  { n: "mc", name: "c" },
];

const X0 = -2.4,
  X1 = 3.5,
  Y0 = -0.35,
  Y1 = 3.8;
const W = 640,
  H = 430;
const sx = (x: number) => 60 + ((x - X0) / (X1 - X0)) * (W - 90);
const sy = (y: number) => H - 30 - ((y - Y0) / (Y1 - Y0)) * (H - 50);

const PHASES = ["skeleton", "cycle", "sweep", "done"] as const;
type Phase = (typeof PHASES)[number];

export default function SplitTreeDemo() {
  const [phase, setPhase] = useState<Phase>("skeleton");
  const [level, setLevel] = useState(3.7);
  const [playing, setPlaying] = useState(true);
  const raf = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let hold = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPhase((ph) => {
        if (ph === "skeleton" || ph === "cycle" || ph === "done") {
          hold += dt;
          if (hold > (ph === "done" ? 2.6 : 1.8)) {
            hold = 0;
            if (ph === "skeleton") return "cycle";
            if (ph === "cycle") {
              setLevel(3.7);
              return "sweep";
            }
            return "skeleton";
          }
          return ph;
        }
        setLevel((l) => {
          const nl = l - dt * 0.7;
          if (nl <= -0.2) {
            setPhase("done");
            return -0.2;
          }
          return nl;
        });
        return ph;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const showCycle = phase !== "skeleton";
  const sweeping = phase === "sweep" || phase === "done";
  const lv = phase === "done" ? -0.2 : level;
  const above = (n: N) => POS[n][1] >= lv;
  const donePairs = useMemo(() => (sweeping ? PAIRS.filter((p) => p.death >= lv) : []), [sweeping, lv]);

  // Components of the super-level set: report which peaks are still alive.
  const alive = PEAKS.filter((p) => {
    if (!sweeping || !above(p.n)) return false;
    const pr = PAIRS.find((q) => q.seq[0] === p.n);
    return !pr || pr.kind === "essential" || pr.death < lv;
  });

  const line = (a: N, b: N) => `M${sx(POS[a][0])},${sy(POS[a][1])} L${sx(POS[b][0])},${sy(POS[b][1])}`;
  const poly = (seq: N[]) => seq.map((n, i) => `${i ? "L" : "M"}${sx(POS[n][0])},${sy(POS[n][1])}`).join(" ");

  const caption: Record<Phase, string> = {
    skeleton: "A DM skeleton: a split tree with one loop attached. Height is density f; peaks are dense behavioral regions.",
    cycle: "Step 1. A minimum cycle basis of the skeleton gives the DM-cycles (here one H₁ loop). Their edges are set aside.",
    sweep: "Step 2. Sweep a density level down the remaining tree. A peak is born when the level reaches it; at a saddle two branches merge and the lower peak dies.",
    done: "Every (peak, saddle) pair is a DM-path, plus the essential path from the global max to the global min. Together with the DM-cycle they tile the skeleton.",
  };

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">animation</span>
        {PHASES.map((p, i) => (
          <button
            key={p}
            onClick={() => {
              setPlaying(false);
              setPhase(p);
              setLevel(p === "sweep" ? 2.4 : 3.7);
            }}
            className={`rounded-full px-3 py-1 text-sm transition ${
              phase === p ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {["Skeleton", "1 · DM-cycle", "2 · Density sweep", "DM-paths"][i]}
          </button>
        ))}
        <button onClick={() => setPlaying(!playing)} className="ml-auto rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
          {playing ? "❚❚ pause" : "▶ play"}
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="lvl" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#f5a623" stopOpacity="0.16" />
              <stop offset="1" stopColor="#f5a623" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line x1={30} x2={30} y1={sy(-0.2)} y2={sy(3.7)} stroke="#71717a" strokeWidth={1.2} markerEnd="" />
          <path d={`M24,${sy(3.7) + 8} L30,${sy(3.7)} L36,${sy(3.7) + 8}`} fill="none" stroke="#71717a" strokeWidth={1.2} />
          <text x={22} y={sy(1.8)} fontSize={12} fill="#71717a" transform={`rotate(-90 22 ${sy(1.8)})`} textAnchor="middle">
            density f
          </text>
          {sweeping && (
            <g>
              <rect x={40} y={sy(3.75)} width={W - 50} height={Math.max(0, sy(lv) - sy(3.75))} fill="url(#lvl)" />
              <line x1={40} x2={W - 10} y1={sy(lv)} y2={sy(lv)} stroke="#f5a623" strokeWidth={1.5} strokeDasharray="5 4" />
              <text x={W - 12} y={sy(lv) - 5} fontSize={11} textAnchor="end" fill="#b45309">
                level
              </text>
            </g>
          )}
          {donePairs.map((p) => (
            <path
              key={p.seq.join()}
              d={poly(p.seq)}
              fill="none"
              stroke={p.fill}
              strokeWidth={p.kind === "essential" ? 30 : 24}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          ))}
          {LOOP.map(([a, b]) => (
            <g key={a + b}>
              {showCycle && <path d={line(a, b)} stroke="#d62728" strokeWidth={9} strokeLinecap="round" opacity={sweeping ? 0.35 : 1} />}
              <path d={line(a, b)} stroke={sweeping ? "#d4d4d8" : "#18181b"} strokeWidth={2} />
            </g>
          ))}
          {TREE.map(([a, b]) => {
            const lit = sweeping && above(a) && above(b);
            return <path key={a + b} d={line(a, b)} stroke={!sweeping || lit ? "#18181b" : "#d4d4d8"} strokeWidth={lit ? 3 : 2} />;
          })}
          {(Object.keys(POS) as N[]).map((n) => {
            const on = !sweeping || above(n) || LOOP.some(([a, b]) => a === n || b === n);
            return <circle key={n} cx={sx(POS[n][0])} cy={sy(POS[n][1])} r={7} fill={on ? "#f5a623" : "#fde7c2"} stroke="#18181b" strokeWidth={1} />;
          })}
          {PEAKS.map((p) => (
            <text key={p.n} x={sx(POS[p.n][0])} y={sy(POS[p.n][1]) - 13} fontSize={13} textAnchor="middle" fill="#3f3f46" fontStyle="italic">
              {p.name}
            </text>
          ))}
          <text x={sx(POS.s2[0]) + 12} y={sy(POS.s2[1]) + 4} fontSize={11} fill="#71717a">
            saddle 2
          </text>
          <text x={sx(POS.s1[0]) + 12} y={sy(POS.s1[1]) + 4} fontSize={11} fill="#71717a">
            saddle 1
          </text>
          <text x={sx(POS.r[0]) + 12} y={sy(POS.r[1]) + 4} fontSize={11} fill="#71717a">
            global min
          </text>
          {showCycle && (
            <text x={sx(2.75)} y={sy(2.62)} fontSize={12} textAnchor="middle" fill="#d62728" fontWeight={600}>
              DM-cycle
            </text>
          )}
        </svg>
        <div className="flex flex-col justify-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          <p className="mb-3 min-h-[5.5rem] text-[0.95rem] text-zinc-800 dark:text-zinc-100">{caption[phase]}</p>
          {sweeping && (
            <div className="mb-2 text-xs text-zinc-500">
              alive components: {alive.length ? alive.map((a) => a.name).join(", ") : "none above the level"}
            </div>
          )}
          <ul className="space-y-1.5">
            {PAIRS.map((p) => {
              const on = donePairs.includes(p);
              return (
                <li key={p.label} className={`flex items-center gap-2 transition-opacity ${on ? "opacity-100" : "opacity-30"}`}>
                  <span className="inline-block h-3 w-6 rounded-full" style={{ background: p.fill, border: `1.5px solid ${p.color}` }} />
                  <span>
                    <b>DM-path</b> · {p.label}
                  </span>
                </li>
              );
            })}
            <li className={`flex items-center gap-2 ${showCycle ? "opacity-100" : "opacity-30"}`}>
              <span className="inline-block h-1.5 w-6 rounded-full bg-red-600" />
              <span>
                <b>DM-cycle</b> · the loop (minimum cycle basis)
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
