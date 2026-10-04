import { useMemo, useState } from "react";

interface Row {
  method: string;
  family: string;
  space: string;
  seed: number;
  H_T_bits: number;
  I_TY_bits: number;
  AMI: number;
  NMI: number;
  lift_over_floor_bits: number;
  n_primitives: number;
}

const FAMILY: Record<string, { color: string; label: string; ours: boolean }> = {
  DMC: { color: "#1f6fb4", label: "DM-cycles", ours: true },
  DMP: { color: "#29a3c4", label: "DM-paths", ours: true },
  KPMS: { color: "#3a9a3a", label: "Keypoint-MoSeq", ours: false },
  Mapper: { color: "#d43d3d", label: "Mapper", ours: false },
};
const METRICS = [
  { key: "I_TY_bits", label: "I(T;Y) bits", max: 1.0 },
  { key: "AMI", label: "AMI", max: 0.25 },
] as const;

const W = 640,
  H = 380,
  L = 56,
  R = 16,
  T = 16,
  B = 46;

/** Figure 2A as an interactive scatter: capacity H(T) against transition information. */
export default function IBPlane({ data }: { data: Row[] }) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]>(METRICS[0]);
  const [hover, setHover] = useState<Row | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const xMax = 5.6;
  const sx = (x: number) => L + (x / xMax) * (W - L - R);
  const sy = (y: number) => H - B - (y / metric.max) * (H - T - B);

  const means = useMemo(() => {
    const g = new Map<string, Row[]>();
    data.forEach((r) => g.set(r.method, [...(g.get(r.method) ?? []), r]));
    return [...g.entries()]
      .map(([m, rs]) => ({
        method: m,
        family: rs[0].family,
        I: rs.reduce((a, r) => a + r.I_TY_bits, 0) / rs.length,
        AMI: rs.reduce((a, r) => a + r.AMI, 0) / rs.length,
        H: rs.reduce((a, r) => a + r.H_T_bits, 0) / rs.length,
        n: rs.length,
      }))
      .sort((a, b) => b.I - a.I);
  }, [data]);

  const toggle = (f: string) => {
    const s = new Set(hidden);
    if (s.has(f)) s.delete(f);
    else s.add(f);
    setHidden(s);
  };
  const val = (r: Row) => (metric.key === "AMI" ? r.AMI : r.I_TY_bits);

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">y axis</span>
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m)}
            className={`rounded-full px-3 py-1 text-sm ${m.key === metric.key ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"}`}
          >
            {m.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        {Object.entries(FAMILY).map(([k, f]) => (
          <button key={k} onClick={() => toggle(k)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm ${hidden.has(k) ? "opacity-35" : ""}`}>
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: f.color }} />
            {f.label}
            {f.ours && <sup>*</sup>}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
          {[0, 1, 2, 3, 4, 5].map((x) => (
            <g key={x}>
              <line x1={sx(x)} x2={sx(x)} y1={T} y2={H - B} stroke="#f4f4f5" />
              <text x={sx(x)} y={H - B + 16} fontSize={11} textAnchor="middle" fill="#71717a">
                {x}
              </text>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={L} x2={W - R} y1={sy(f * metric.max)} y2={sy(f * metric.max)} stroke="#f4f4f5" />
              <text x={L - 8} y={sy(f * metric.max) + 4} fontSize={11} textAnchor="end" fill="#71717a">
                {(f * metric.max).toFixed(metric.key === "AMI" ? 2 : 2)}
              </text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#a1a1aa" />
          <line x1={L} x2={L} y1={T} y2={H - B} stroke="#a1a1aa" />
          <text x={(L + W - R) / 2} y={H - 8} fontSize={12} textAnchor="middle" fill="#3f3f46">
            H(T): capacity of the coarse-graining (bits)
          </text>
          <text x={16} y={(T + H - B) / 2} fontSize={12} textAnchor="middle" fill="#3f3f46" transform={`rotate(-90 16 ${(T + H - B) / 2})`}>
            {metric.key === "AMI" ? "AMI (cardinality corrected)" : "I(T;Y): transition information (bits)"}
          </text>
          <text x={L + 8} y={T + 12} fontSize={11} fill="#a1a1aa">
            up and left dominates
          </text>
          {data
            .filter((r) => !hidden.has(r.family))
            .map((r) => (
              <circle
                key={r.method + r.seed}
                cx={sx(r.H_T_bits)}
                cy={sy(val(r))}
                r={hover && hover.method === r.method ? 9 : 7}
                fill={FAMILY[r.family].color}
                stroke="white"
                strokeWidth={1.5}
                opacity={hover && hover.method !== r.method ? 0.35 : 0.95}
                onMouseEnter={() => setHover(r)}
                style={{ cursor: "pointer", transition: "r .15s" }}
              />
            ))}
          {hover && (
            <g pointerEvents="none">
              <rect x={Math.min(sx(hover.H_T_bits) + 10, W - 190)} y={Math.max(sy(val(hover)) - 58, T)} width={180} height={54} rx={6} fill="white" stroke="#d4d4d8" />
              <text x={Math.min(sx(hover.H_T_bits) + 20, W - 180)} y={Math.max(sy(val(hover)) - 38, T + 20)} fontSize={12} fontWeight={600} fill="#18181b">
                {hover.method}
                {hover.seed >= 0 ? ` · seed ${hover.seed}` : " · deterministic"}
              </text>
              <text x={Math.min(sx(hover.H_T_bits) + 20, W - 180)} y={Math.max(sy(val(hover)) - 20, T + 38)} fontSize={11} fill="#52525b">
                I = {hover.I_TY_bits.toFixed(3)} · AMI = {hover.AMI.toFixed(3)} · H = {hover.H_T_bits.toFixed(2)}
              </text>
            </g>
          )}
        </svg>
        <div className="text-sm">
          <table className="w-full border-collapse text-left tabular-nums">
            <thead>
              <tr className="border-b border-zinc-300 text-xs text-zinc-500 dark:border-zinc-600">
                <th className="py-1 font-medium">variant</th>
                <th className="py-1 text-right font-medium">I(T;Y)</th>
                <th className="py-1 text-right font-medium">AMI</th>
              </tr>
            </thead>
            <tbody>
              {means
                .filter((m) => !hidden.has(m.family))
                .map((m) => (
                  <tr
                    key={m.method}
                    className={`border-b border-zinc-100 dark:border-zinc-800 ${hover?.method === m.method ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
                    onMouseEnter={() => setHover(data.find((r) => r.method === m.method) ?? null)}
                  >
                    <td className="py-1">
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: FAMILY[m.family].color }} />
                      {m.method}
                      {FAMILY[m.family].ours && <sup>*</sup>}
                    </td>
                    <td className="py-1 text-right">{m.I.toFixed(3)}</td>
                    <td className="py-1 text-right">{m.AMI.toFixed(3)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-500">Baselines: mean over 3 seeds. DM decomposition is deterministic. H(Y) = 2.67 bits bounds I(T;Y).</p>
        </div>
      </div>
    </div>
  );
}
