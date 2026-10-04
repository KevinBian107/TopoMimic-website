import { useState } from "react";

/** Paper Table 1, one metric block at a time. null = not discovered; "†" = one seed only. */
type Cell = number | null | [number, "†"];
const COLS = ["DMC-Int*", "DMP-Qpos*", "Mapper-Qpos", "KPMS-KP"];
const ROWS: { t: string; v: Record<string, Cell[]> }[] = [
  { t: "Immobile → Rear [L]", v: { dtw: [null, 0.854, null, 0.831], con: [null, 0.803, null, 0.821], nd: [null, 0.128, null, 0.245], kid: [null, 0.002, null, 0.006] } },
  { t: "Rear → Immobile [L]", v: { dtw: [null, [0.855, "†"], 0.879, 0.855], con: [null, [0.659, "†"], 0.743, 0.708], nd: [null, [0.111, "†"], 0.178, 0.165], kid: [null, [0.026, "†"], 0.009, 0.01] } },
  { t: "Immobile → Rear [R]", v: { dtw: [null, [0.88, "†"], null, [0.848, "†"]], con: [null, [0.718, "†"], null, [0.854, "†"]], nd: [null, [0.17, "†"], null, [0.173, "†"]], kid: [null, [0.033, "†"], null, [0.01, "†"]] } },
  { t: "Immobile → Rear [S]", v: { dtw: [0.934, 0.892, 0.895, 0.967], con: [0.766, 0.632, 0.714, 0.936], nd: [0.08, 0.063, 0.055, 0.096], kid: [0.032, 0.024, 0.01, 0.011] } },
  { t: "Rear → Immobile [S]", v: { dtw: [[0.863, "†"], null, 0.856, 0.877], con: [[0.802, "†"], null, 0.765, 0.816], nd: [[0.08, "†"], null, 0.052, 0.109], kid: [[0.011, "†"], null, 0.008, 0.008] } },
  { t: "Immobile → Turn [L]", v: { dtw: [0.809, 0.788, 0.801, 0.77], con: [0.652, 0.724, 0.69, 0.686], nd: [0.012, 0.019, 0.033, 0.036], kid: [0.009, 0.003, 0.006, 0.002] } },
  { t: "Turn → Immobile [L]", v: { dtw: [0.74, 0.721, 0.79, [0.849, "†"]], con: [0.601, 0.585, 0.59, [0.659, "†"]], nd: [0.032, 0.054, 0.062, [0.086, "†"]], kid: [0.005, 0.008, 0.01, [0.013, "†"]] } },
  { t: "Immobile → Turn [R]", v: { dtw: [0.759, [0.756, "†"], [0.715, "†"], 0.747], con: [0.703, [0.729, "†"], [0.669, "†"], 0.688], nd: [0.013, [0.005, "†"], [0.019, "†"], 0.025], kid: [0.007, [0.009, "†"], [0.008, "†"], 0.003] } },
  { t: "Immobile → Walk [L]", v: { dtw: [[0.759, "†"], null, null, null], con: [[0.928, "†"], null, null, null], nd: [[0.08, "†"], null, null, null], kid: [[0.003, "†"], null, null, null] } },
  { t: "Rear → Turn [L]", v: { dtw: [0.826, 0.778, 0.818, 0.918], con: [0.782, 0.607, 0.643, 0.795], nd: [0.142, 0.169, 0.189, 0.164], kid: [0.005, 0.015, 0.008, 0.013] } },
  { t: "Turn → Walk [L]", v: { dtw: [0.643, null, null, null], con: [0.582, null, null, null], nd: [0.096, null, null, null], kid: [0.004, null, null, null] } },
];
const METRICS = [
  { key: "dtw", label: "DTW to GT", note: "Frame-level alignment to the annotated window under a monotone time correspondence." },
  { key: "con", label: "Consistency", note: "Mean pairwise DTW among the members of a cluster: how alike its members are." },
  { key: "nd", label: "Non-diagonal fraction", note: "Share of the DTW warping path off the diagonal. Lower means the primitive matches the transition at its own timescale instead of being stretched onto it." },
  { key: "kid", label: "KID", note: "Kernel distance between the frame distributions of a cluster and its window. Order-invariant and cannot warp; here the DM columns claim no advantage." },
];

const num = (c: Cell) => (c === null ? null : Array.isArray(c) ? c[0] : c);

export default function AlignmentTable() {
  const [m, setM] = useState(METRICS[0]);
  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">metric (lower is better)</span>
        {METRICS.map((x) => (
          <button
            key={x.key}
            onClick={() => setM(x)}
            className={`rounded-full px-3 py-1 text-sm ${x.key === m.key ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm text-zinc-500">{m.note}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-t-2 border-b border-zinc-800 dark:border-zinc-300">
              <th className="py-1.5 text-left font-semibold">Transition</th>
              {COLS.map((c, i) => (
                <th key={c} className={`py-1.5 text-right font-semibold ${i < 2 ? "text-sky-700 dark:text-sky-300" : ""}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const cells = r.v[m.key];
              const vals = cells.map(num).filter((x): x is number => x !== null);
              const best = vals.length > 1 ? Math.min(...vals) : null;
              return (
                <tr key={r.t} className="border-b border-zinc-100 last:border-b-2 last:border-zinc-800 dark:border-zinc-800 dark:last:border-zinc-300">
                  <td className="py-1 text-left">{r.t}</td>
                  {cells.map((c, i) => {
                    const v = num(c);
                    return (
                      <td key={i} className={`py-1 text-right ${v !== null && v === best ? "font-bold" : ""} ${v === null ? "text-zinc-300 dark:text-zinc-600" : ""}`}>
                        {v === null ? "—" : v.toFixed(3)}
                        {Array.isArray(c) && <sup className="text-zinc-400">†</sup>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        One variant per family, chosen by transition information. Bold = best in the row among populated cells. — = not discovered. † = one seed only. Direction tags: [L] left, [R] right, [S] straight. *Ours.
      </p>
    </div>
  );
}
