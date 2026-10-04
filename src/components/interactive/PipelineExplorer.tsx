import { useMemo, useState } from "react";
import { DensityPanel, OverviewPanel, PrimitivesPanel, TakensPanel, W2VideoPanel, type MethodData } from "./MethodPanels";

/**
 * Tabbed walkthrough of the method (paper Figure 1, Sections 4.1-4.4). Each tab lights up
 * the modules active in one step; the panel on the right animates that step on real
 * pipeline outputs (one clip in intention space, and the seed-0 DMC-Int clustering).
 */

type NodeId = "traj" | "feat" | "takens" | "dmg" | "skel" | "cyc" | "path" | "w2" | "km" | "clus";
type EdgeId = "traj-feat" | "feat-takens" | "takens-dmg" | "dmg-skel" | "skel-cyc" | "skel-path" | "cyc-w2" | "path-w2" | "w2-km" | "km-clus";

interface Stage {
  key: string;
  tab: string;
  title: string;
  body: string[];
  nodes: NodeId[];
  edges: EdgeId[];
  viz: "overview" | "takens" | "skeleton" | "primitives" | "clusters";
}

const ALL_N: NodeId[] = ["traj", "feat", "takens", "dmg", "skel", "cyc", "path", "w2", "km", "clus"];
const ALL_E: EdgeId[] = ["traj-feat", "feat-takens", "takens-dmg", "dmg-skel", "skel-cyc", "skel-path", "cyc-w2", "path-w2", "w2-km", "km-clus"];

const STAGES: Stage[] = [
  {
    key: "overview",
    tab: "Overview",
    title: "Transitions read off the shape of a trajectory",
    body: [
      "Each recorded clip becomes a point cloud in a feature space. Its discrete-Morse skeleton traces the ridges of the cloud's density, and two kinds of structure are cut from it: DM-cycles, loops whose way out and way back differ, and DM-paths, corridors between dense behavioral regions.",
      "Primitives from all clips are pooled and clustered under the 2-Wasserstein distance. Each cluster is a candidate behavioral transition. No state partition is fit anywhere, and ground-truth labels are used only to evaluate the clusters afterwards.",
    ],
    nodes: ALL_N,
    edges: ALL_E,
    viz: "overview",
  },
  {
    key: "takens",
    tab: "1 · Takens embedding",
    title: "Step 1a: every frame carries its recent motion",
    body: [
      "A single frame is an ambiguous descriptor: the same pose occurs inside different movements. A time-delay embedding stacks each feature vector with two delayed copies, x_t = [p_t, p_t−τ, p_t−2τ], so each point is a short window of how the signal evolves.",
      "τ is the first minimum of the average mutual information (6, 9 and 8 frames for intention, qpos and ekp) and m = 3 from false nearest neighbours. qpos and ekp are first reduced to 10 principal components.",
    ],
    nodes: ["traj", "feat", "takens"],
    edges: ["traj-feat", "feat-takens"],
    viz: "takens",
  },
  {
    key: "dmg",
    tab: "2 · DM skeleton",
    title: "Step 1b: the skeleton of the density terrain",
    body: [
      "A k-nearest-neighbour density (k = 3) gives every point an inverse-density score ρ. A sparse weighted Rips filtration is built over the cloud and the persistence-guided discrete-Morse simplification of Magee and Wang (2022) cancels ridges below a threshold δ.",
      "What remains is a one-dimensional graph G whose edges follow the density ridges: a 500-frame clip becomes a skeleton of a few hundred vertices.",
    ],
    nodes: ["takens", "dmg", "skel"],
    edges: ["takens-dmg", "dmg-skel"],
    viz: "skeleton",
  },
  {
    key: "prims",
    tab: "3 · Primitives",
    title: "Step 2: cut the skeleton into DM-cycles and DM-paths",
    body: [
      "DM-cycles are a minimum cycle basis of G, with each edge weighted by the inverse density of its sparser endpoint so loops through dense regions are preferred. A loop means the embedded trajectory left a region and came back a different way.",
      "Removing the cycles leaves a forest. Ordered by density it is a split tree, and 0-dimensional persistence pairs every peak with the saddle where it merges into a higher one. Each pair, plus the global max to global min path, is a DM-path. Primitives are mapped back to their frames.",
    ],
    nodes: ["skel", "cyc", "path"],
    edges: ["skel-cyc", "skel-path"],
    viz: "primitives",
  },
  {
    key: "w2",
    tab: "4 · W2 clustering",
    title: "Step 3: Wasserstein clustering of the pooled primitives (DM-WKC)",
    body: [
      "Primitives differ in length, so each is resampled to L = 100 frames and read as an empirical distribution. Exact optimal transport gives the squared 2-Wasserstein distance for every pair; it matches the regions two primitives occupy rather than forcing a frame-by-frame alignment.",
      "The distance matrix is embedded with metric MDS (dimension chosen by within-cluster consistency, no labels) and clustered with K-means, K = 25. Cycles and paths, and each feature space, are clustered separately.",
    ],
    nodes: ["cyc", "path", "w2", "km", "clus"],
    edges: ["cyc-w2", "path-w2", "w2-km", "km-clus"],
    viz: "clusters",
  },
];

const BOX: Record<NodeId, { x: number; y: number; w: number; h: number; t: string; s: string; color: string }> = {
  traj: { x: 10, y: 30, w: 132, h: 70, t: "Behavior clip", s: "≈500 frames, 30 Hz", color: "#e4e4e7" },
  feat: { x: 178, y: 30, w: 140, h: 70, t: "Feature space", s: "intention · qpos · ekp", color: "#e0e7ff" },
  takens: { x: 354, y: 30, w: 150, h: 70, t: "Takens embedding", s: "xₜ = [pₜ, pₜ₋τ, pₜ₋₂τ]", color: "#dbeafe" },
  dmg: { x: 540, y: 30, w: 190, h: 70, t: "Discrete-Morse G", s: "k-NN ρ · sparse Rips · δ", color: "#fee2e2" },
  skel: { x: 766, y: 30, w: 124, h: 70, t: "Skeleton G", s: "density ridges", color: "#fecaca" },
  cyc: { x: 690, y: 170, w: 120, h: 64, t: "DM-cycles", s: "H₁ · min cycle basis", color: "#fca5a5" },
  path: { x: 840, y: 170, w: 120, h: 64, t: "DM-paths", s: "split-tree pairs", color: "#bbf7d0" },
  w2: { x: 470, y: 170, w: 170, h: 64, t: "W₂ distances", s: "exact OT · L = 100", color: "#fef3c7" },
  km: { x: 270, y: 170, w: 160, h: 64, t: "MDS → K-means", s: "K = 25", color: "#fde68a" },
  clus: { x: 60, y: 170, w: 170, h: 64, t: "Transition clusters", s: "e.g. Rear → Turn", color: "#e9d5ff" },
};
const cx = (n: NodeId) => BOX[n].x + BOX[n].w / 2;
const cy = (n: NodeId) => BOX[n].y + BOX[n].h / 2;
const R = (n: NodeId) => BOX[n].x + BOX[n].w;
const Lf = (n: NodeId) => BOX[n].x;
const T = (n: NodeId) => BOX[n].y;
const B = (n: NodeId) => BOX[n].y + BOX[n].h;

const EDGES: Record<EdgeId, string> = {
  "traj-feat": `M${R("traj")},${cy("traj")} L${Lf("feat")},${cy("feat")}`,
  "feat-takens": `M${R("feat")},${cy("feat")} L${Lf("takens")},${cy("takens")}`,
  "takens-dmg": `M${R("takens")},${cy("takens")} L${Lf("dmg")},${cy("dmg")}`,
  "dmg-skel": `M${R("dmg")},${cy("dmg")} L${Lf("skel")},${cy("skel")}`,
  "skel-cyc": `M${cx("skel") - 20},${B("skel")} C${cx("skel") - 20},${B("skel") + 40} ${cx("cyc")},${T("cyc") - 40} ${cx("cyc")},${T("cyc")}`,
  "skel-path": `M${cx("skel") + 20},${B("skel")} C${cx("skel") + 20},${B("skel") + 40} ${cx("path")},${T("path") - 40} ${cx("path")},${T("path")}`,
  "cyc-w2": `M${Lf("cyc")},${cy("cyc")} L${R("w2")},${cy("w2")}`,
  "path-w2": `M${cx("path")},${B("path")} C${cx("path")},${B("path") + 45} ${cx("w2")},${B("w2") + 45} ${cx("w2")},${B("w2")}`,
  "w2-km": `M${Lf("w2")},${cy("w2")} L${R("km")},${cy("km")}`,
  "km-clus": `M${Lf("km")},${cy("km")} L${R("clus")},${cy("clus")}`,
};

interface Props {
  method: MethodData;
  base: string;
}

export default function PipelineExplorer(props: Props) {
  const [k, setK] = useState(0);
  const stage = STAGES[k];
  const on = useMemo(() => new Set<string>([...stage.nodes, ...stage.edges]), [stage]);

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <style>{`@keyframes flow { to { stroke-dashoffset: -24; } } .flow { animation: flow 0.9s linear infinite; }`}</style>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">interactive</span>
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setK(i)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              i === k ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {s.tab}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 970 270" className="w-full">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#52525b" />
          </marker>
        </defs>
        <text x={10} y={18} fontSize={11} fill="#a1a1aa" letterSpacing={1}>
          PER CLIP
        </text>
        <text x={10} y={160} fontSize={11} fill="#a1a1aa" letterSpacing={1}>
          POOLED OVER CLIPS
        </text>
        <line x1={10} x2={960} y1={140} y2={140} stroke="#f4f4f5" strokeDasharray="4 4" />
        {(Object.keys(EDGES) as EdgeId[]).map((e) => {
          const active = on.has(e);
          return (
            <g key={e} opacity={active ? 1 : 0.18}>
              <path d={EDGES[e]} fill="none" stroke="#52525b" strokeWidth={1.6} markerEnd="url(#arr)" />
              {active && <path d={EDGES[e]} fill="none" stroke="#f59e0b" strokeWidth={3} strokeDasharray="4 20" className="flow" />}
            </g>
          );
        })}
        {(Object.keys(BOX) as NodeId[]).map((n) => {
          const b = BOX[n];
          const active = on.has(n);
          return (
            <g key={n} opacity={active ? 1 : 0.25} style={{ transition: "opacity .3s" }}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill={b.color} stroke={active ? "#18181b" : "#a1a1aa"} strokeWidth={active ? 1.6 : 1} />
              <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 4} fontSize={14} fontWeight={600} textAnchor="middle" fill="#18181b">
                {b.t}
              </text>
              <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 15} fontSize={11.5} textAnchor="middle" fill="#52525b">
                {b.s}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div>
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{stage.title}</div>
          {stage.body.map((p, i) => (
            <p key={i} className="mt-2 text-[0.93rem] leading-relaxed text-zinc-600 dark:text-zinc-300">
              {p}
            </p>
          ))}
        </div>
        <div>
          {stage.viz === "overview" && <OverviewPanel d={props.method} base={props.base} />}
          {stage.viz === "takens" && <TakensPanel d={props.method} base={props.base} />}
          {stage.viz === "skeleton" && <DensityPanel d={props.method} base={props.base} />}
          {stage.viz === "primitives" && <PrimitivesPanel d={props.method} base={props.base} />}
          {stage.viz === "clusters" && <W2VideoPanel d={props.method} base={props.base} />}
        </div>
      </div>
    </div>
  );
}
