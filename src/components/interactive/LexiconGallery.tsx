import { useState } from "react";
import LoopVideo from "./LoopVideo";
import { asset, BEHAVIOR_COLORS } from "./util";

interface Item {
  from: string;
  to: string;
  n: number;
  clip: number;
  frames: [number, number];
  src: string;
  poster: string;
}

function Chip({ b }: { b: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BEHAVIOR_COLORS[b] }} />
      {b}
    </span>
  );
}

/** Figure 5 as video: one representative instance of every directed ground-truth transition. */
export default function LexiconGallery({ data, base }: { data: Item[]; base: string }) {
  const [open, setOpen] = useState<Item | null>(null);
  return (
    <div className="not-prose">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {data.map((it) => (
          <button key={it.src} onClick={() => setOpen(it)} className="group relative overflow-hidden rounded-lg bg-zinc-300 text-left">
            <LoopVideo src={asset(base, it.src)} poster={asset(base, it.poster)} className="block aspect-[1088/960] w-full object-cover" />
            <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-x-1.5 bg-gradient-to-b from-black/65 to-transparent px-2 pt-1.5 pb-4 text-xs font-semibold text-white sm:text-sm">
              <Chip b={it.from} /> <span className="opacity-80">→</span> <Chip b={it.to} />
              <span className="ml-auto text-[11px] font-normal opacity-75">n={it.n}</span>
            </div>
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <LoopVideo src={asset(base, open.src)} poster={asset(base, open.poster)} className="w-full rounded-lg" />
            <div className="mt-2 flex items-center justify-between text-sm text-white">
              <span className="flex items-center gap-2">
                <Chip b={open.from} /> → <Chip b={open.to} />
                <span className="opacity-60">
                  clip {open.clip}, frames {open.frames[0]}–{open.frames[1]} · {open.n} instances in the dataset
                </span>
              </span>
              <button className="rounded bg-white/15 px-3 py-1 hover:bg-white/25" onClick={() => setOpen(null)}>
                close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
