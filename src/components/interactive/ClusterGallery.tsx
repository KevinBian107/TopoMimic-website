import { useState } from "react";
import LoopVideo from "./LoopVideo";
import { asset } from "./util";

interface Member {
  clip: number;
  frames: [number, number];
  stride: number;
  src: string;
  poster: string;
}
interface Cluster {
  label: string;
  cluster: number;
  size: number;
  members: Member[];
}
interface Method {
  name: string;
  seed: number;
  clusters: Cluster[];
}

const ORDER = [
  { key: "w2_dmp_qpos_kmeans", ours: true, note: "DM-paths in joint-angle space" },
  { key: "w2_dmc_int_kmeans", ours: true, note: "DM-cycles in intention space" },
  { key: "kpms_keypoint", ours: false, note: "Keypoint-MoSeq syllable pairs" },
  { key: "mapper_qpos", ours: false, note: "Mapper node pairs in joint-angle space" },
];

const pretty = (l: string) => l.replace("->", "→");

/** Figures 10-13 as video: discovered transition clusters, two members each. */
export default function ClusterGallery({ data, base }: { data: Record<string, Method>; base: string }) {
  const [tab, setTab] = useState(ORDER[0].key);
  const m = data[tab];
  return (
    <div className="not-prose">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">method</span>
        {ORDER.map((o) => (
          <button
            key={o.key}
            onClick={() => setTab(o.key)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              o.key === tab ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {data[o.key]?.name}
            {o.ours && <sup className="ml-0.5">*</sup>}
            <span className="hidden opacity-60 sm:inline"> · {o.note}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
        {m.clusters.map((c) => (
          <div key={c.cluster}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{pretty(c.label)}</span>
              <span className="text-xs text-zinc-400">
                cluster {c.cluster} · {c.size} members
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {c.members.map((mem, j) => (
                <div key={j} className="relative overflow-hidden rounded-lg bg-zinc-300">
                  <LoopVideo src={asset(base, mem.src)} poster={asset(base, mem.poster)} className="block aspect-[1088/960] w-full object-cover" />
                  <div className="absolute top-1 left-1.5 rounded bg-black/45 px-1.5 py-0.5 font-mono text-[10px] text-white">
                    clip {mem.clip} · {mem.frames[0]}–{mem.frames[1]}
                    {` · ${mem.stride / 2}× speed`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
