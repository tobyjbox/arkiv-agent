"use client";

import type { GraphLink, GraphNode } from "@arkiv-agent/decode";
import { useEffect, useRef, useState } from "react";
import { IntroHud, type IntroStep } from "./intro-hud";
import type { CloudRecord } from "./records-cloud";
import { ARCHETYPE_COLOR, BROKEN_COLOR, escapeHtml, flagColor, LINK_KINDS, MEMBER_COLOR } from "./palette";

export type ColorBy = "purpose" | "privacy";
type Node = GraphNode & { x?: number; y?: number; z?: number };
type Link = Omit<GraphLink, "source" | "target"> & { source: string | Node; target: string | Node };
type Props = { nodes: GraphNode[]; links: GraphLink[]; colorBy: ColorBy; selected: string | null; onSelect: (node: GraphNode | null) => void };

const LINK_COLOR = Object.fromEntries(LINK_KINDS.map((k) => [k.kind, k.color])) as Record<string, string>;
const endId = (end: string | Node) => (typeof end === "string" ? end : end.id);
/** Hubs with at least this many live records carry their name in the scene. */
const LABEL_MIN_LIVE = 700;
export const hubRadius = (live: number) => 3 + Math.log2(1 + live) * 0.85;
export const datasetRadius = (live: number) => 1.1 + Math.log2(1 + live) * 0.32;
/** Time between the start-up steps: long enough to watch each part arrive. */
const STEP_MS = 1150;
const UNDECODED = "#5b6884";
/** Cards shown for a clicked dataset, and how long they stay before dissolving. */
const CLOUD_RECORDS = 10;
const CLOUD_HOLD_S = 12;
type Cloud = { id: string; label: string; shown: number; live: number; status: "loading" | "shown" | "empty" | "failed" };

/** The 3D map: projects are glowing hubs, their datasets orbit them, and light runs along the links between records. */
export function Graph3D({ nodes, links, colorBy, selected, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  // biome-ignore lint/suspicious/noExplicitAny: 3d-force-graph's instance type is a chained builder
  const graph = useRef<any>(null);
  const [isReady, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The dataset whose records are in the air, for the caption under them.
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const cloudRef = useRef<{ id: string; dismiss: () => void } | null>(null);
  // How many start-up steps are done; equal to the step count once the map is whole.
  const [stage, setStage] = useState(0);
  // What the map shows in full: which nodes and links (shape), and the nodes' facts (detail).
  const drawn = useRef({ shape: "", detail: "" });
  const state = useRef({ colorBy, selected, onSelect, isDecoded: false, hasIntroRun: false, frame: (_force?: boolean) => {}, hadSelection: false, focus: null as string | null, showRecords: (_node: Node) => {} });
  Object.assign(state.current, { colorBy, selected, onSelect });
  const intro: IntroStep[] = [
    { label: "Placing projects", count: nodes.filter((n) => n.kind === "project").length, unit: "projects" },
    { label: "Attaching datasets", count: nodes.filter((n) => n.kind === "dataset").length, unit: "datasets" },
    { label: "Tracing record links", count: links.reduce((n, l) => n + (l.kind === "ref" ? l.count : 0), 0), unit: "links" },
    { label: "Matching shapes and wallets", count: links.filter((l) => l.kind === "shape" || l.kind === "builder").length, unit: "matches" },
    { label: "Reading purposes", count: nodes.filter((n) => n.kind === "project" && n.archetype !== "unclear").length, unit: "decoded" },
  ];

  useEffect(() => {
    let isGone = false;
    let observer: ResizeObserver | null = null;
    const el = box.current;
    if (!el) return;
    void Promise.all([import("3d-force-graph"), import("three"), import("three/examples/jsm/postprocessing/UnrealBloomPass.js"), import("./graph-scene")])
      .then(([{ default: ForceGraph3D }, THREE, { UnrealBloomPass }, scene]) => {
        if (isGone) return;
        const isStill = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const g = new ForceGraph3D(el, { controlType: "orbit" })
          .backgroundColor("#000000")
          .showNavInfo(false)
          .nodeThreeObject((n: object) => {
            const node = n as Node;
            const s = state.current;
            const isHub = node.kind === "project";
            return scene.nodeObject({
              radius: isHub ? hubRadius(node.live) : datasetRadius(node.live), isHub,
              color: !s.isDecoded ? UNDECODED : s.colorBy === "privacy" ? flagColor(node.flags) : ARCHETYPE_COLOR[node.archetype],
              isDimmed: s.selected !== null && node.project !== s.selected,
              isQuiet: !s.isDecoded ? !isHub : s.colorBy === "purpose" ? node.archetype === "unclear" : node.flags === 0,
              label: isHub && (node.live >= LABEL_MIN_LIVE || node.id === s.selected) ? node.label : null,
            });
          })
          .nodeLabel((n: object) => {
            const node = n as Node;
            // The centre ball is the project as a whole, not a dataset of its own: say so, with what it adds up.
            const datasets = node.kind === "project" ? ((graph.current?.graphData().nodes ?? []) as Node[]).filter((d) => d.kind === "dataset" && d.project === node.id).length : 0;
            const what = node.kind === "project" ? `the whole project · ${datasets} dataset${datasets === 1 ? "" : "s"} · ${node.live.toLocaleString("en")} live records in all` : `dataset · ${node.live.toLocaleString("en")} live records`;
            return `<div style="font:12px/16px var(--font-sans);background:#1b2232;border:1px solid #2a3447;border-radius:6px;padding:4px 8px;color:#e8ecf4">${escapeHtml(node.label)}<span style="color:#8590a6"> · ${what}</span></div>`;
          })
          .linkColor((l: object) => { const link = l as Link; return link.kind === "member" ? MEMBER_COLOR : link.kind === "ref" && link.broken * 2 > link.count ? BROKEN_COLOR : (LINK_COLOR[link.kind] ?? MEMBER_COLOR); })
          .linkOpacity(0.42)
          .linkWidth((l: object) => { const link = l as Link; return link.kind === "member" ? 0 : Math.min(1.8, 0.35 + Math.log10(1 + link.count) * 0.4); })
          .linkCurvature((l: object) => ((l as Link).kind === "member" ? 0 : 0.22))
          .linkDirectionalParticles((l: object) => { const link = l as Link; return link.kind === "ref" && !isStill ? Math.min(5, 1 + Math.round(Math.log10(1 + link.count))) : 0; })
          .linkDirectionalParticleWidth(1.5)
          .linkDirectionalParticleSpeed(0.005)
          .linkDirectionalParticleColor((l: object) => ((l as Link).broken * 2 > (l as Link).count ? "#ffb3b3" : "#b6fff3"))
          .warmupTicks(80)
          .cooldownTime(9000)
          .onNodeClick((n: object) => {
            const node = n as Node;
            // A dataset: stay on it and show its records; the selection effect then leaves the camera alone.
            state.current.focus = node.kind === "dataset" ? node.id : null;
            if (node.kind === "dataset") state.current.showRecords(node); else cloudRef.current?.dismiss();
            state.current.onSelect(node);
          })
          // A line between nodes: hovering says what it stands for, and a click travels along it to the far end.
          .linkHoverPrecision(8)
          .linkLabel((l: object) => {
            const link = l as Link;
            if (link.kind === "member" || typeof link.source === "string" || typeof link.target === "string") return "";
            const hubs = new Map((g.graphData().nodes as Node[]).filter((n) => n.kind === "project").map((n) => [n.id, n.label]));
            const name = (n: Node) => (n.kind === "project" ? n.label : `${hubs.get(n.project) ?? n.project} / ${n.label}`);
            const from = escapeHtml(name(link.source));
            const to = escapeHtml(name(link.target));
            const n = link.count.toLocaleString("en");
            const [title, detail] = link.kind === "ref"
              ? [`${from} → ${to}`, `${n} link${link.count === 1 ? "" : "s"}: records in the first hold the key of a record in the second${link.broken ? `, <span style="color:${BROKEN_COLOR}">${link.broken.toLocaleString("en")} broken</span>` : ""}${link.source.project !== link.target.project ? " · crosses projects" : ""}`]
              : link.kind === "shape" ? [`${from} ↔ ${to}`, `Same record shape: both store records with the same ${n} attribute${link.count === 1 ? "" : "s"}`]
              : [`${from} ↔ ${to}`, `Shared wallet: ${n} wallet${link.count === 1 ? "" : "s"} write for both`];
            const other = farEnd(link);
            return `<div style="font:12px/17px var(--font-sans);background:#1b2232;border:1px solid #2a3447;border-radius:6px;padding:6px 9px;color:#e8ecf4;max-width:340px">${title}<div style="color:#a3aec2">${detail}</div><div style="color:#8590a6">Click to go to ${escapeHtml(other.label)}</div></div>`;
          })
          .onLinkClick((l: object) => {
            const link = l as Link;
            if (link.kind === "member" || typeof link.source === "string" || typeof link.target === "string") return;
            const node = farEnd(link);
            state.current.focus = node.kind === "dataset" ? node.id : null;
            if (node.kind === "dataset") state.current.showRecords(node); else cloudRef.current?.dismiss();
            state.current.onSelect(node);
          })
          .onBackgroundClick(() => { cloudRef.current?.dismiss(); state.current.focus = null; state.current.onSelect(null); });

        // Where a click on a line leads: its target, or its source when you are already at the target.
        const farEnd = (link: Link): Node => {
          const [from, to] = [link.source as Node, link.target as Node];
          const here = state.current.focus ?? state.current.selected;
          return here === to.id || (here === to.project && here !== from.project) ? from : to;
        };
        state.current.showRecords = (node: Node) => {
          cloudRef.current?.dismiss();
          const token = { id: node.id, dismiss: () => {} };
          cloudRef.current = token;
          const base = { id: node.id, label: node.label, shown: 0, live: node.live };
          setCloud({ ...base, status: "loading" });
          (g.controls() as { autoRotate: boolean }).autoRotate = false;
          const reach = Math.max(1, Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0));
          const ratio = 1 + 215 / reach;
          g.cameraPosition({ x: (node.x ?? 0) * ratio, y: (node.y ?? 0) * ratio, z: (node.z ?? 0) * ratio }, { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 }, 1000);
          void Promise.all([fetch(`/api/datasets/${encodeURIComponent(node.id)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found")))), import("./records-cloud")])
            .then(([body, { createRecordCloud }]) => {
              if (cloudRef.current !== token) return;
              const records = ((body as { records?: CloudRecord[] }).records ?? []).slice(0, CLOUD_RECORDS);
              if (!records.length) { setCloud({ ...base, status: "empty" }); return; }
              setCloud({ ...base, shown: records.length, status: "shown" });
              token.dismiss = createRecordCloud({
                scene: g.scene(), anchor: node, records, color: ARCHETYPE_COLOR[node.archetype], holdSeconds: CLOUD_HOLD_S, isStill,
                onGone: () => { if (cloudRef.current === token) { cloudRef.current = null; setCloud(null); } },
              }).dismiss;
            })
            .catch(() => { if (cloudRef.current === token) setCloud({ ...base, status: "failed" }); });
        };

        // Datasets sit close to their hub; links between projects pull only gently, so clusters stay apart.
        g.d3Force("link")?.distance((l: Link) => (l.kind === "member" ? 26 : 110)).strength((l: Link) => (l.kind === "member" ? 0.9 : 0.04));
        // Repulsion fades with distance, so unlinked projects settle as a cloud instead of flying apart.
        g.d3Force("charge")?.strength(-70).distanceMax(380);

        g.scene().add(scene.starfield());
        g.scene().fog = new THREE.FogExp2(0x000000, 0.00028);
        const bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), 0.55, 0.3, 0.34);
        g.postProcessingComposer().addPass(bloom);

        const controls = g.controls() as { autoRotate: boolean; autoRotateSpeed: number; addEventListener: (type: string, f: () => void) => void };
        controls.autoRotate = !isStill;
        controls.autoRotateSpeed = 0.45;
        controls.addEventListener("start", () => { controls.autoRotate = false; });

        // Frame the whole map once it has taken shape, and again when it settles, unless the reader has taken over.
        let isTouched = false;
        controls.addEventListener("start", () => { isTouched = true; });
        // Far enough back that the whole cloud fits the shorter side of the view.
        const frame = (force = false) => {
          if (!force && (isTouched || state.current.selected)) return;
          const reach = Math.max(200, ...(g.graphData().nodes as Node[]).map((n) => Math.hypot(n.x ?? 0, n.y ?? 0, n.z ?? 0)));
          const halfFov = (Math.min(1, el.clientWidth / el.clientHeight) * 50 * Math.PI) / 360;
          const distance = (reach * 0.66) / Math.sin(halfFov);
          g.cameraPosition({ x: 0, y: distance * 0.18, z: distance }, { x: 0, y: 0, z: 0 }, 1600);
        };
        g.cameraPosition({ x: 0, y: 260, z: 1500 });
        state.current.frame = frame;
        g.onEngineStop(() => frame());

        const resize = () => { g.width(el.clientWidth).height(el.clientHeight); bloom.resolution.set(el.clientWidth, el.clientHeight); };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(el);
        graph.current = g;
        // Dev only: where a node is on screen, so a test can hover it.
        if (process.env.NODE_ENV !== "production") (window as unknown as { __decodeScreen?: (id: string) => unknown }).__decodeScreen = (id) => { const n = (g.graphData().nodes as Node[]).find((x) => x.id === id); const box = el.getBoundingClientRect(); const at = n ? g.graph2ScreenCoords(n.x ?? 0, n.y ?? 0, n.z ?? 0) : null; return at ? { x: Math.round(at.x + box.left), y: Math.round(at.y + box.top) } : null; };
        if (process.env.NODE_ENV !== "production") (window as unknown as { __decodeShowRecords?: (id: string) => void }).__decodeShowRecords = (id) => { const n = (g.graphData().nodes as Node[]).find((x) => x.id === id); if (n) { state.current.focus = n.id; state.current.showRecords(n); state.current.onSelect(n); } };
        setReady(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "The 3D view could not load"));
    return () => {
      isGone = true;
      cloudRef.current?.dismiss();
      observer?.disconnect();
      graph.current?._destructor?.();
      graph.current = null;
    };
  }, []);

  // New data. Nodes already on the map keep their object, and so their place. The first time, the map
  // is built in steps the reader can watch: hubs, datasets, record links, pattern links, then colour.
  useEffect(() => {
    const g = graph.current;
    if (!isReady || !g) return;
    const s = state.current;
    // The page re-reads the decode every 30 s. Mostly nothing moved: leave the map alone, so it doesn't jolt.
    const shape = JSON.stringify([nodes.map((n) => n.id), links]);
    const detail = JSON.stringify(nodes);
    if (drawn.current.shape === shape && drawn.current.detail === detail) return;
    const placed = new Map((g.graphData().nodes as Node[]).map((n) => [n.id, n]));
    // A node already on the map keeps its object, and so its place, and takes the new facts.
    const all = nodes.map((n) => { const old = placed.get(n.id); return old ? Object.assign(old, n) : { ...n }; });
    const allLinks: Link[] = links.map((l) => ({ ...l }));
    const of = (...kinds: string[]) => allLinks.filter((l) => kinds.includes(l.kind));
    const whole = () => { drawn.current = { shape, detail }; };
    const steps = [
      () => g.graphData({ nodes: all.filter((n) => n.kind === "project"), links: [] }),
      () => { g.graphData({ nodes: all, links: of("member") }); s.frame(); },
      () => g.graphData({ nodes: all, links: of("member", "ref") }),
      () => { g.graphData({ nodes: all, links: allLinks }); whole(); },
      () => { s.isDecoded = true; g.nodeThreeObject(g.nodeThreeObject()); s.frame(); },
    ];
    if (s.hasIntroRun || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.isDecoded = true;
      s.hasIntroRun = true;
      // Same nodes and links, new facts on the nodes: redraw the nodes in place, without restarting the layout.
      if (drawn.current.shape !== shape) g.graphData({ nodes: all, links: allLinks });
      g.nodeThreeObject(g.nodeThreeObject());
      whole();
      setStage(steps.length);
      return;
    }
    let done = 0;
    const timers = steps.map((step, i) => setTimeout(() => { step(); done = i + 1; setStage(i + 1); if (done === steps.length) s.hasIntroRun = true; }, 300 + i * STEP_MS));
    // Interrupted (the data changed, or the page was left): the next run draws the whole map at once.
    return () => { timers.forEach(clearTimeout); if (done > 0) s.hasIntroRun = true; };
  }, [isReady, nodes, links]);

  // Selection and colour mode: rebuild the node objects, and fly to the selected project's hub.
  useEffect(() => {
    const g = graph.current;
    if (!isReady || !g) return;
    g.nodeThreeObject(g.nodeThreeObject()).linkVisibility((l: object) => {
      const link = l as Link;
      if (!selected) return true;
      const ends = [link.source, link.target].map((e) => (typeof e === "string" ? null : e.project));
      return ends.includes(selected) || endId(link.source) === selected;
    });
    // Back from a project: pull out to the whole map again.
    if (!selected) {
      cloudRef.current?.dismiss();
      state.current.focus = null;
      if (state.current.hadSelection) state.current.frame(true);
      state.current.hadSelection = false;
      return;
    }
    state.current.hadSelection = true;
    // A dataset was clicked: the camera is already on its way there.
    if (state.current.focus) return;
    const hub = (g.graphData().nodes as Node[]).find((n) => n.id === selected);
    if (hub?.x === undefined) return;
    (g.controls() as { autoRotate: boolean }).autoRotate = false;
    const ratio = 1 + 240 / Math.max(1, Math.hypot(hub.x, hub.y ?? 0, hub.z ?? 0));
    g.cameraPosition({ x: hub.x * ratio, y: (hub.y ?? 0) * ratio, z: (hub.z ?? 0) * ratio }, hub, 1100);
  }, [isReady, selected, colorBy]);

  if (error) return <div className="flex h-full items-center justify-center p-6 text-center text-text-secondary">The 3D view needs WebGL, which this browser didn&apos;t provide ({error}). The lists below hold the same findings.</div>;
  return (
    <div className="relative h-full w-full">
      <div ref={box} className="h-full w-full" role="img" aria-label="3D map of projects, their datasets and the links between them. The same findings are listed below." />
      <IntroHud steps={intro} stage={stage} />
      {cloud && (
        <p aria-live="polite" className="fade-in pointer-events-auto absolute left-1/2 top-24 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 rounded-full border border-border-default bg-canvas/85 px-3.5 py-1.5 caption text-text-secondary backdrop-blur">
          <span className="mono-sm max-w-[24ch] truncate text-text-primary">{cloud.label}</span>
          {cloud.status === "loading" ? "reading records…" : cloud.status === "empty" ? "no decoded records to show" : cloud.status === "failed" ? "its records could not be read" : `${cloud.shown} newest of ${cloud.live.toLocaleString("en")} live records`}
          <a href={`/catalogue/${cloud.id}`} className="text-accent hover:underline">Open dataset</a>
        </p>
      )}
    </div>
  );
}
