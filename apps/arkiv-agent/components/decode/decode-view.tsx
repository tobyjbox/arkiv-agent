"use client";

import type { Decode, GraphNode } from "@arkiv-agent/decode";
import { ArrowLeft, Maximize2, Minimize2, PanelBottom, PanelRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatCount } from "../../lib/format";
import { useSyncState } from "../live/live-provider";
import { type ColorBy, Graph3D } from "./graph-3d";
import { MapGuide } from "./map-guide";
import { ARCHETYPE_COLOR, BROKEN_COLOR, flagColor, LINK_KINDS } from "./palette";
import { PatternsSection } from "./patterns-section";
import { PrivacySection } from "./privacy-section";
import { ARCHETYPE_LABEL, ProjectPanel } from "./project-panel";

/** The key's name for a privacy colour: no flags, one kind, or several. */
const flagKey = (flags: number) => `flag:${Math.min(flags, 2)}`;

type LinkKind = (typeof LINK_KINDS)[number]["kind"];

export function DecodeView({ decode }: { decode: Decode }) {
  const [selected, setSelectedProject] = useState<string | null>(null);
  // The dataset node that was clicked: its records fill the pane as a table.
  const [datasetId, setDatasetId] = useState<string | null>(null);
  // Full screen only: the pane on the right can be folded away to give the map everything.
  const [isPaneOpen, setPaneOpen] = useState(true);
  // Full screen only: the pane sits beside the map, or under it across the full width.
  const [isPaneBelow, setPaneBelow] = useState(false);
  // The pane's share of the full-screen view in each position; the divider between map and pane drags it.
  const [paneSize, setPaneSize] = useState({ side: 0.5, below: 0.225 });
  const mapSection = useRef<HTMLElement>(null);
  const resizePane = (share: number) => setPaneSize((p) => (isPaneBelow ? { ...p, below: Math.min(0.8, Math.max(0.1, share)) } : { ...p, side: Math.min(0.8, Math.max(0.2, share)) }));
  const dragDivider = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const box = mapSection.current?.getBoundingClientRect();
    if (!box) return;
    // 12px is the view's padding: the pane's share is measured inside it.
    resizePane(isPaneBelow ? (box.bottom - 12 - e.clientY) / (box.height - 24) : (box.right - 12 - e.clientX) / (box.width - 24));
  };
  const setSelected = (id: string | null) => { setSelectedProject(id); setDatasetId(null); };
  const [colorBy, setColorBy] = useState<ColorBy>("purpose");
  const [kinds, setKinds] = useState<ReadonlySet<LinkKind>>(new Set(["ref", "shape", "builder"]));
  const [showWallets, setShowWallets] = useState(false);
  // Full screen: only the map and the project pane, over the whole window. Escape leaves it.
  const [isFull, setFull] = useState(false);
  useEffect(() => {
    if (!isFull) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [isFull]);
  const s = decode.summary;
  const sync = useSyncState();
  // "behind": the indexer is running and working through blocks it missed, so the map is still moving.
  const isLive = sync !== "stale" && sync !== "offline";

  // Items of the key that are switched off; everything is on to begin with.
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) => setOff((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  // Unlabelled wallets are 1-dataset islands, mostly: shown only when linked, unless asked for.
  // Before the key's filter: what the key lists, so an item switched off stays there to switch back on.
  const base = useMemo(() => {
    const linked = new Set(decode.links.filter((l) => l.kind !== "member").flatMap((l) => [l.source, l.target]));
    const keep = new Set(decode.projects.filter((p) => showWallets || p.isLabel || p.refs > 0 || p.datasets.some((d) => linked.has(d.id))).map((p) => p.id));
    return decode.nodes.filter((n) => keep.has(n.project));
  }, [decode, showWallets]);
  const graph = useMemo(() => {
    // A project goes, with its datasets, when its colour in the key is switched off.
    const gone = new Set(base.filter((n) => n.kind === "project" && off.has(colorBy === "purpose" ? n.archetype : flagKey(n.flags))).map((n) => n.id));
    const nodes = base.filter((n) => !gone.has(n.project));
    const ids = new Set(nodes.map((n) => n.id));
    const links = decode.links.filter((l) => ids.has(l.source) && ids.has(l.target) && (l.kind === "member" || kinds.has(l.kind)) && !(off.has("broken") && l.kind === "ref" && l.broken * 2 > l.count));
    return { nodes, links };
  }, [base, decode, kinds, off, colorBy]);

  const project = selected ? decode.projects.find((p) => p.id === selected) ?? null : null;
  const select = (node: GraphNode | null) => { setSelectedProject(node ? node.project : null); setDatasetId(node?.kind === "dataset" ? node.id : null); };
  const usedArchetypes = useMemo(() => [...new Set(base.filter((n) => n.kind === "project").map((n) => n.archetype))].sort((a, b) => (a === "unclear" ? 1 : b === "unclear" ? -1 : a.localeCompare(b))), [base]);

  const tiles = [
    { label: "Record links", value: s.refs, note: `${formatCount(s.implicit)} stored as text, not as a key`, tip: "Attributes whose value is another record's key. Arkiv has a key type for this, and no tool that shows it." },
    { label: "Broken links", value: s.broken, note: "live records pointing at expired or missing ones", tip: "A live record whose link target has expired, was deleted, or was never on this chain.", tone: "text-danger" },
    { label: "Across wallets", value: s.crossWallet, note: `${formatCount(s.crossProject)} cross between projects`, tip: "Links whose two ends have different owners: one wallet's data depending on another's." },
    { label: "Shared shapes", value: s.sharedShapes, note: `${formatCount(s.multiProjectWallets)} wallets write for several projects`, tip: "Record shapes (the same attribute names and types) that appear under more than one project." },
    { label: "Privacy flags", value: s.flaggedDatasets, note: "datasets with attribute names that suggest personal data", tip: "From attribute names only. Values are not read.", tone: "text-warn" },
  ];

  return (
    <div className="mx-auto max-w-[1280px] space-y-8 px-4 pb-16 pt-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.015em]">Arkiv-Decode</h1>
        <p className="text-text-secondary">What the data on Arkiv is for, how it links together, and what projects have in common. All of it is inferred from attribute names, types and record keys.</p>
      </header>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-md bg-surface p-4" title={t.tip}>
            <div className="label text-text-tertiary">{t.label}</div>
            <div className={`stat mt-1 ${t.tone ?? ""}`}>{formatCount(t.value)}</div>
            <div className="caption mt-1 text-text-secondary">{t.note}</div>
          </div>
        ))}
      </section>

      {/* The same elements in both views, so the map keeps its state when switching. */}
      <section ref={mapSection} aria-label="Map" style={{ "--pane-side": `${paneSize.side * 100}%`, "--pane-below": `${paneSize.below * 100}%` } as CSSProperties} className={isFull ? `fixed inset-0 z-40 m-0 grid gap-3 bg-canvas p-3 ${!isPaneOpen ? "grid-rows-1" : isPaneBelow ? "grid-rows-[minmax(0,1fr)_var(--pane-below)]" : "grid-rows-[minmax(0,1fr)_42%] lg:grid-cols-[minmax(0,1fr)_var(--pane-side)] lg:grid-rows-1"}` : "grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]"}>
        <div className={`relative ${isFull ? "h-full min-h-0" : "h-[620px]"} overflow-hidden rounded-md border border-border-default bg-black shadow-[0_0_0_1px_rgba(61,220,197,0.08),0_0_40px_rgba(61,220,197,0.06)]`}>
          <Graph3D nodes={graph.nodes} links={graph.links} colorBy={colorBy} selected={selected} onSelect={select} />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
            <div className="pointer-events-auto flex flex-wrap gap-1.5">
              {LINK_KINDS.map((k) => (
                <button key={k.kind} type="button" title={k.hint} aria-pressed={kinds.has(k.kind)}
                  onClick={() => setKinds((prev) => { const next = new Set(prev); if (next.has(k.kind)) next.delete(k.kind); else next.add(k.kind); return next; })}
                  className={`caption flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${kinds.has(k.kind) ? "border-border-default bg-overlay text-text-primary" : "border-border-subtle bg-surface/80 text-text-tertiary"}`}>
                  <span className="h-0.5 w-3 rounded" style={{ background: kinds.has(k.kind) ? k.color : "#566175" }} aria-hidden />{k.label}
                </button>
              ))}
              <button type="button" aria-pressed={showWallets} onClick={() => setShowWallets((v) => !v)} title="Wallets that write without a project label, and link to nothing"
                className={`caption rounded-full border px-2.5 py-1 ${showWallets ? "border-border-default bg-overlay text-text-primary" : "border-border-subtle bg-surface/80 text-text-tertiary"}`}>Unlabelled wallets</button>
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5">
            <MapGuide />
            <span className="caption flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border-subtle bg-surface/80 px-2.5 py-1 text-text-secondary" title={isLive ? "The map re-reads the index about every 30 seconds and changes in place." : "The indexer isn't running, so the map shows the last stored result. Start it with pnpm live."}>
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse bg-live" : "bg-text-tertiary"}`} aria-hidden />
              {sync === "behind" ? "Catching up" : isLive ? "Live" : "Paused"} · block {formatCount(decode.indexedBlock)}
            </span>
            <div className="flex overflow-hidden rounded-full border border-border-default bg-overlay caption" role="group" aria-label="Colour by">
              {(["purpose", "privacy"] as const).map((mode) => (
                <button key={mode} type="button" aria-pressed={colorBy === mode} onClick={() => setColorBy(mode)} className={`px-3 py-1 ${colorBy === mode ? "bg-accent text-on-accent" : "text-text-secondary hover:text-text-primary"}`}>
                  {mode === "purpose" ? "Colour by purpose" : "Colour by privacy flags"}
                </button>
              ))}
            </div>
            {isFull && (
              <button type="button" onClick={() => setPaneOpen((v) => !v)} aria-expanded={isPaneOpen} title={isPaneOpen ? "Give the map the whole screen" : "Bring the project pane back"}
                className="caption flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border-default bg-overlay px-3 py-1 text-text-primary hover:bg-raised">
                {isPaneOpen ? <PanelRightClose size={13} aria-hidden /> : <PanelRightOpen size={13} aria-hidden />}{isPaneOpen ? "Hide pane" : "Show pane"}
              </button>
            )}
            {isFull && isPaneOpen && (
              <button type="button" onClick={() => setPaneBelow((v) => !v)} title={isPaneBelow ? "Put the pane beside the map" : "Put the pane under the map, across the full width"}
                className="caption flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border-default bg-overlay px-3 py-1 text-text-primary hover:bg-raised">
                {isPaneBelow ? <PanelRight size={13} aria-hidden /> : <PanelBottom size={13} aria-hidden />}{isPaneBelow ? "Pane at side" : "Pane at bottom"}
              </button>
            )}
            <button type="button" onClick={() => setFull((v) => !v)} aria-pressed={isFull} title={isFull ? "Back to the page (Esc)" : "Only the map and the project pane"}
              className="caption flex items-center gap-1.5 rounded-full border border-border-default bg-overlay px-3 py-1 text-text-primary hover:bg-raised">
              {isFull ? <Minimize2 size={13} aria-hidden /> : <Maximize2 size={13} aria-hidden />}{isFull ? "Exit full screen" : "Full screen"}
            </button>
            </div>
          </div>
          {selected && (
            <button type="button" onClick={() => setSelected(null)}
              className="absolute left-3 top-14 flex items-center gap-1.5 rounded-full border border-border-default bg-overlay px-3 py-1.5 font-medium text-text-primary shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:bg-raised">
              <ArrowLeft size={14} aria-hidden /> Back to the full map
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2 caption text-text-secondary">
            <ul aria-label="Show or hide by colour" className="pointer-events-auto flex max-w-[62%] flex-wrap gap-x-1 gap-y-0.5 rounded-md bg-canvas/70 px-1.5 py-1.5 backdrop-blur-sm">
              {(colorBy === "purpose"
                ? usedArchetypes.map((a) => ({ key: a as string, label: ARCHETYPE_LABEL(a), color: ARCHETYPE_COLOR[a], isLine: false }))
                : [0, 1, 2].map((n) => ({ key: flagKey(n), label: n === 0 ? "No flags" : n === 1 ? "One kind of personal data" : "Several kinds", color: flagColor(n), isLine: false }))
              ).concat({ key: "broken", label: "Mostly broken links", color: BROKEN_COLOR, isLine: true }).map((item) => {
                const isOn = !off.has(item.key);
                return (
                  <li key={item.key}>
                    <button type="button" aria-pressed={isOn} onClick={() => toggle(item.key)} title={isOn ? "Click to hide these" : "Click to show these"}
                      className={`flex items-center gap-1.5 rounded-full px-1.5 py-0.5 hover:bg-raised ${isOn ? "text-text-secondary" : "text-text-tertiary line-through opacity-60"}`}>
                      <span className={item.isLine ? "h-0.5 w-3 rounded" : "h-2 w-2 rounded-full"} style={{ background: isOn ? item.color : "#566175" }} aria-hidden />{item.label}
                    </button>
                  </li>
                );
              })}
              {off.size > 0 && <li><button type="button" onClick={() => setOff(new Set())} className="rounded-full px-1.5 py-0.5 text-accent hover:underline">Show all</button></li>}
            </ul>
            <span className="rounded-md bg-canvas/70 px-2 py-1 text-text-tertiary">{formatCount(graph.nodes.filter((n) => n.kind === "project").length)} projects · {formatCount(graph.nodes.filter((n) => n.kind === "dataset").length)} datasets · drag to turn, scroll to zoom, click a node</span>
          </div>
        </div>
        {/* Hidden, not removed, so a table that is open keeps its rows and scroll place. */}
        <div className={isFull && !isPaneOpen ? "hidden" : "relative min-h-0 min-w-0"}>
          {isFull && (
            // biome-ignore lint/a11y/useSemanticElements: a draggable divider between two panes, not a thematic break.
            <div role="separator" tabIndex={0} aria-label="Divider between the map and the pane. Drag it, or use the arrow keys." aria-orientation={isPaneBelow ? "horizontal" : "vertical"}
              aria-valuenow={Math.round((isPaneBelow ? paneSize.below : paneSize.side) * 100)} aria-valuemin={isPaneBelow ? 10 : 20} aria-valuemax={80}
              onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={dragDivider}
              onKeyDown={(e) => {
                const grow = isPaneBelow ? e.key === "ArrowUp" : e.key === "ArrowLeft";
                const shrink = isPaneBelow ? e.key === "ArrowDown" : e.key === "ArrowRight";
                if (!grow && !shrink) return;
                e.preventDefault();
                resizePane((isPaneBelow ? paneSize.below : paneSize.side) + (grow ? 0.02 : -0.02));
              }}
              className={`group absolute z-10 touch-none items-center justify-center ${isPaneBelow ? "inset-x-0 -top-3 flex h-3 cursor-row-resize" : "inset-y-0 -left-3 hidden w-3 cursor-col-resize lg:flex"}`}>
              <span className={`rounded-full bg-border-default group-hover:bg-accent group-focus-visible:bg-accent group-active:bg-accent ${isPaneBelow ? "h-1 w-16" : "h-16 w-1"}`} aria-hidden />
            </div>
          )}
          <ProjectPanel decode={decode} project={project} datasetId={datasetId} onCloseDataset={() => setDatasetId(null)} onSelect={setSelected} heightClass={isFull ? "h-full min-h-0" : "h-[620px]"} />
        </div>
      </section>

      <PatternsSection decode={decode} onSelect={setSelected} />
      <PrivacySection decode={decode} onSelect={setSelected} />
      <p className="caption text-text-tertiary">From the ArkivAgent index at block {formatCount(decode.indexedBlock)}: live records and those created in the last 7 days, load generators left out. Purposes come from a keyword match on names, and are a guess with its evidence shown.</p>
    </div>
  );
}
