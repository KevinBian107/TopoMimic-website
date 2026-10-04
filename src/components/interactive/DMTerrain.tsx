import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Level {
  delta: number;
  edges: [number, number][];
  cycles: number[][];
  paths: number[][];
  beta1: number;
}
interface Data {
  points: [number, number][];
  rho: number[];
  height: number[];
  hidden: [[number, number], [number, number]][];
  grid: { lim: number; n: number; z: number[][] };
  k: number;
  levels: Level[];
}

type Layer = "graph" | "primitives";

const Z_SCALE = 1.6;
const CYCLE_COLORS = [0xd62728, 0x9467bd, 0xe377c2];
const PATH_COLORS = [0x2ca02c, 0x1f77b4, 0xff7f0e, 0x17becf, 0xbcbd22, 0x8c564b];

/** Density terrain of the Figure 3A road network with the real DM-G output at each delta. */
export default function DMTerrain({ data, hero = false }: { data: Data; hero?: boolean }) {
  const mount = useRef<HTMLDivElement>(null);
  const [li, setLi] = useState(hero ? 0 : 5);
  const [layer, setLayer] = useState<Layer>("graph");
  const [showCloud, setShowCloud] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const sceneRef = useRef<{ scene: THREE.Scene; overlay: THREE.Group; render: () => void } | null>(null);

  const level = data.levels[li];
  const zOf = useMemo(() => (i: number) => data.height[i] * Z_SCALE + 0.03, [data]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = hero ? Math.round(w * 0.75) : Math.min(520, Math.round(w * 0.62));
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setNoGL(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(-6.5, -9.5, 7.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0.3);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = hero ? 1.1 : 0.6;
    controls.enableZoom = false;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-4, -6, 10);
    scene.add(sun);

    const { lim, n, z } = data.grid;
    const geo = new THREE.PlaneGeometry(2 * lim, 2 * lim, n - 1, n - 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) pos.setZ(r * n + c, z[r][c] * Z_SCALE);
    // PlaneGeometry rows run top to bottom; the grid rows run bottom to top.
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        pos.setY(i, -(r / (n - 1)) * 2 * lim + lim);
        pos.setZ(i, z[n - 1 - r][c] * Z_SCALE);
      }
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x5ec8cc, roughness: 0.75, metalness: 0.0, transparent: true, opacity: 0.88 }),
    );
    scene.add(terrain);

    const overlay = new THREE.Group();
    scene.add(overlay);

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    const stop = () => (controls.autoRotate = false);
    renderer.domElement.addEventListener("pointerdown", stop);

    sceneRef.current = { scene, overlay, render: () => renderer.render(scene, camera) };
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [data]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const g = s.overlay;
    g.children.forEach((o: THREE.Object3D) => {
      (o as THREE.Mesh).geometry?.dispose();
    });
    g.clear();
    const P = data.points;
    const v = (i: number) => new THREE.Vector3(P[i][0], P[i][1], zOf(i));

    if (showCloud) {
      const pts = new Float32Array(P.length * 3);
      P.forEach((p, i) => pts.set([p[0], p[1], zOf(i) + 0.01], i * 3));
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: hero ? 0xf4f4f5 : 0x27272a, size: 0.05, transparent: true, opacity: hero ? 0.7 : 0.55 })));
    }
    if (showHidden) {
      const seg: number[] = [];
      data.hidden.forEach(([a, b]) => {
        for (let t = 0; t < 1; t += 0.05) {
          const p0 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          const p1 = [a[0] + (b[0] - a[0]) * (t + 0.05), a[1] + (b[1] - a[1]) * (t + 0.05)];
          seg.push(p0[0], p0[1], Z_SCALE + 0.06, p1[0], p1[1], Z_SCALE + 0.06);
        }
      });
      const hg = new THREE.BufferGeometry();
      hg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
      g.add(new THREE.LineSegments(hg, new THREE.LineDashedMaterial({ color: 0x111111, dashSize: 0.12, gapSize: 0.08 })).computeLineDistances());
    }

    const tube = (idx: number[], color: number, r: number, closed = false) => {
      if (idx.length < 2) return;
      const pts = idx.map(v);
      if (closed) pts.push(pts[0].clone());
      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.2);
      const m = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(8, pts.length * 3), r, 6, false),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
      );
      g.add(m);
    };

    if (layer === "graph") {
      level.edges.forEach(([a, b]) => tube([a, b], 0xd62728, 0.035));
    } else {
      const sorted = [...level.paths].sort((a, b) => b.length - a.length);
      sorted.forEach((p, i) => tube(p, PATH_COLORS[i % PATH_COLORS.length], 0.035));
      level.cycles.forEach((c, i) => {
        const set = new Set(c);
        level.edges.forEach(([a, b]) => set.has(a) && set.has(b) && tube([a, b], CYCLE_COLORS[i % CYCLE_COLORS.length], 0.06));
      });
    }
  }, [level, layer, showCloud, showHidden, data, zOf]);

  useEffect(() => {
    if (!hero) return;
    // Sweep delta up to the last level that still has a graph, then restart.
    const last = data.levels.findIndex((l) => l.edges.length === 0);
    const top = last > 0 ? last : data.levels.length;
    const id = setInterval(() => setLi((i) => (i + 1) % top), 1800);
    return () => clearInterval(id);
  }, [hero, data]);

  if (hero)
    return (
      <div className="not-prose relative overflow-hidden rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-2xl ring-1 ring-white/10">
        {noGL && <FlatView data={data} level={level} layer="graph" showCloud showHidden={false} />}
        <div ref={mount} style={noGL ? { display: "none" } : undefined} className="w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-3 text-white">
          <span className="font-mono text-sm">
            persistence δ = <b>{level.delta}</b>
          </span>
          <span className="text-sm">
            <b className="font-mono text-red-400">{level.beta1}</b> loop{level.beta1 === 1 ? "" : "s"} recovered
          </span>
        </div>
      </div>
    );

  const btn = (on: boolean) =>
    `rounded-full px-3 py-1 text-sm transition ${
      on ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
    }`;

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">interactive</span>
        <button className={btn(layer === "graph")} onClick={() => setLayer("graph")}>Recovered DM-graph</button>
        <button className={btn(layer === "primitives")} onClick={() => setLayer("primitives")}>DM-cycles + DM-paths</button>
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        <button className={btn(showCloud)} onClick={() => setShowCloud(!showCloud)}>point cloud</button>
        <button className={btn(showHidden)} onClick={() => setShowHidden(!showHidden)}>hidden graph</button>
      </div>
      {noGL && <FlatView data={data} level={level} layer={layer} showCloud={showCloud} showHidden={showHidden} />}
      <div ref={mount} style={noGL ? { display: "none" } : undefined} className="w-full cursor-grab overflow-hidden rounded-xl bg-gradient-to-b from-zinc-50 to-white active:cursor-grabbing dark:from-zinc-800 dark:to-zinc-900" />
      <div className="mt-4 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
            <span>
              persistence threshold <b className="font-mono">δ = {level.delta}</b>
            </span>
            <span className="text-xs text-zinc-400">drag the terrain to rotate</span>
          </div>
          <input
            type="range"
            min={0}
            max={data.levels.length - 1}
            value={li}
            onChange={(e) => setLi(+e.target.value)}
            className="mt-2 w-full accent-red-600"
          />
          <div className="flex justify-between font-mono text-[11px] text-zinc-400">
            {data.levels.map((l) => (
              <span key={l.delta}>{l.delta}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-3 text-center sm:flex-col sm:gap-1 sm:text-right">
          <Stat label="graph edges" value={level.edges.length} />
          <Stat label="DM-cycles (β₁)" value={level.beta1} accent />
          <Stat label="DM-paths" value={level.paths.length} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <span className={`font-mono text-xl font-semibold ${accent ? "text-red-600" : "text-zinc-800 dark:text-zinc-100"}`}>{value}</span>{" "}
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

/** Top-down fallback for browsers without WebGL: same points, graph and primitives. */
function FlatView({ data, level, layer, showCloud, showHidden }: { data: Data; level: Level; layer: Layer; showCloud: boolean; showHidden: boolean }) {
  const lim = data.grid.lim;
  const S = 500;
  const X = (x: number) => ((x + lim) / (2 * lim)) * S;
  const Y = (y: number) => S - ((y + lim) / (2 * lim)) * S;
  const P = data.points;
  const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
  const poly = (idx: number[]) => idx.map((i, j) => `${j ? "L" : "M"}${X(P[i][0])},${Y(P[i][1])}`).join(" ");
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-xl rounded-xl bg-[#e8f6f6]">
      {showCloud && P.map((p, i) => <circle key={i} cx={X(p[0])} cy={Y(p[1])} r={1.6} fill="#27272a" opacity={0.45} />)}
      {showHidden && data.hidden.map(([a, b], i) => <line key={i} x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} stroke="#111" strokeDasharray="5 4" />)}
      {layer === "graph"
        ? level.edges.map(([a, b], i) => <line key={i} x1={X(P[a][0])} y1={Y(P[a][1])} x2={X(P[b][0])} y2={Y(P[b][1])} stroke="#d62728" strokeWidth={1.6} />)
        : [
            ...level.paths.map((p, i) => <path key={"p" + i} d={poly(p)} fill="none" stroke={hex(PATH_COLORS[i % PATH_COLORS.length])} strokeWidth={1.8} />),
            ...level.cycles.flatMap((c, i) => {
              const set = new Set(c);
              return level.edges
                .filter(([a, b]) => set.has(a) && set.has(b))
                .map(([a, b], j) => <line key={`c${i}-${j}`} x1={X(P[a][0])} y1={Y(P[a][1])} x2={X(P[b][0])} y2={Y(P[b][1])} stroke={hex(CYCLE_COLORS[i % CYCLE_COLORS.length])} strokeWidth={3.5} strokeLinecap="round" />);
            }),
          ]}
    </svg>
  );
}
