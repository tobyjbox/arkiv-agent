"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogueData, DatasetRow as Row } from "../../lib/catalogue";
import { applyView, countBy, FRESHNESS, SORTS, type Sort, type View, viewFromParams, viewToParams, writeAgeSeconds } from "../../lib/catalogue-filter";
import { formatCount } from "../../lib/format";
import { useLive, useSecondsSince } from "../live/live-provider";
import { DatasetRow } from "./dataset-row";
import { FilterPopover } from "./filter-popover";
import { StatTiles } from "./stat-tiles";
import { useLiveRows } from "./use-live-rows";

export function CatalogueView({ initial }: { initial: CatalogueData }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const view = useMemo(() => viewFromParams(new URLSearchParams(params.toString())), [params]);
  const setView = (patch: Partial<View>) => router.replace(`${path}?${viewToParams({ ...view, ...patch })}`, { scroll: false });

  const live = useLive();
  const sinceSync = useSecondsSince(live.syncedAt) ?? 0;
  const list = useRef<HTMLDivElement>(null);
  const { data, flashes, pending, applyPending, isRefreshing, announcement } = useLiveRows(initial, live.version, list);
  const ageOf = (r: Row) => writeAgeSeconds(r, data.summary.chainHead, sinceSync);
  const rows = applyView(data.rows, view, ageOf);
  const base = applyView(data.rows, { ...view, project: [], ownership: [], content: [], freshness: null }, ageOf);
  const s = data.summary;

  return (
    <div className="space-y-6">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <StatTiles tiles={[
        { label: "Datasets", value: s.datasets, tooltip: "Datasets with decoded records, load generators excluded. From ArkivAgent index." },
        { label: "Live records", value: s.liveRecords, tooltip: `Excludes expired and deleted. From ArkivAgent index, block ${formatCount(s.indexedBlock)}.` },
        { label: "Projects", value: s.projects, tooltip: "Distinct project labels or writer wallets, load generators excluded." },
        { label: "Writes / 24h", value: s.writes24h, series: s.hourlyWrites24h, tooltip: "Records created in the last 24 hours, load generators excluded." },
      ]} />

      {s.undecodedLive > 0 && (
        <p className="rounded-md px-4 py-2.5 tint-warn">
          {formatCount(s.undecodedLive)} of {formatCount(s.liveRecords)} live records are still being decoded, so their datasets are not listed yet. They appear as the indexer catches up.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-64 flex-1 items-center">
          <Search size={16} className="absolute left-3 text-text-tertiary" aria-hidden />
          <span className="sr-only">Search datasets</span>
          <input value={view.q} onChange={(e) => setView({ q: e.target.value })} placeholder="Search datasets, attributes, projects…"
            className="h-9 w-full rounded-sm border border-border-control bg-raised pl-9 pr-3 outline-none placeholder:text-text-tertiary focus:border-accent" />
        </label>
        <FilterPopover label="Project" options={countBy(base, (r) => [r.project.label])} selected={view.project} onChange={(project) => setView({ project })} />
        <FilterPopover label="Ownership" options={countBy(base, (r) => [r.ownership])} selected={view.ownership} onChange={(ownership) => setView({ ownership })} />
        <FilterPopover label="Freshness" isSingle options={Object.entries(FRESHNESS)} selected={view.freshness ? [view.freshness] : []}
          onChange={([f]) => setView({ freshness: (f as View["freshness"]) ?? null })} />
        <FilterPopover label="Content type" options={countBy(base, (r) => r.contentTypes)} selected={view.content} onChange={(content) => setView({ content })} />
        <label className="flex h-8 items-center gap-2 rounded-sm border border-border-control px-3 text-text-secondary">
          <span>Sort</span>
          <select value={view.sort} onChange={(e) => setView({ sort: e.target.value as Sort })} className="bg-transparent text-text-primary outline-none">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k} className="bg-overlay">{v}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 caption text-text-secondary">
        <span>Active filters:</span>
        {!view.showLoadGen && <Chip onRemove={() => setView({ showLoadGen: true })}>Hide load generators</Chip>}
        {view.ownership.map((o) => <Chip key={o} onRemove={() => setView({ ownership: view.ownership.filter((x) => x !== o) })}>Ownership: {o}</Chip>)}
        {view.project.map((p) => <Chip key={p} onRemove={() => setView({ project: view.project.filter((x) => x !== p) })}>Project: {p}</Chip>)}
        {view.freshness && <Chip onRemove={() => setView({ freshness: null })}>{FRESHNESS[view.freshness]}</Chip>}
        {view.content.map((c) => <Chip key={c} onRemove={() => setView({ content: view.content.filter((x) => x !== c) })}>{c}</Chip>)}
        <span className="ml-auto">{formatCount(rows.length)} datasets</span>
      </div>

      <div ref={list} className="relative overflow-x-auto rounded-md bg-surface">
        {isRefreshing && <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" aria-hidden><div className="h-full w-1/3 bg-accent [animation:progress_1.2s_linear_infinite]" /></div>}
        {pending > 0 && (
          <button type="button" onClick={applyPending} className="sticky top-0 z-10 w-full border-b border-border-subtle bg-raised px-4 py-2 text-left text-accent">
            ↑ {pending > 8 ? `${pending} updates` : `${pending} updated dataset${pending === 1 ? "" : "s"}`} · Show
          </button>
        )}
        {rows.length ? (
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="label border-b border-border-subtle text-left text-text-secondary">
                <th className="px-3 py-2.5">Dataset</th><th className="px-3 py-2.5">Project</th><th className="px-3 py-2.5 text-right">Live</th>
                <th className="px-3 py-2.5 text-right">Writers</th><th className="hidden px-3 py-2.5 text-right md:table-cell">Lifetime</th><th className="px-3 py-2.5 text-right">Last write</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <DatasetRow key={r.id} row={r} ageSeconds={ageOf(r)} description={r.description ?? undefined} flash={flashes.get(r.id) ?? null} onPrefetch={() => router.prefetch(`/catalogue/${r.id}`)} />)}
            </tbody>
          </table>
        ) : (
          <NoResults view={view} onClear={() => router.replace(path, { scroll: false })} isEmpty={data.rows.length === 0} />
        )}
      </div>
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border-default py-0.5 pl-2.5 pr-1 text-text-primary">
      {children}
      <button type="button" onClick={onRemove} aria-label={`Remove filter ${String(children)}`} className="rounded-full p-0.5 hover:bg-raised"><X size={12} /></button>
    </span>
  );
}

function NoResults({ view, onClear, isEmpty }: { view: View; onClear: () => void; isEmpty: boolean }) {
  if (isEmpty) return <div className="p-10 text-center text-text-secondary">No datasets decoded yet. The indexer is still reading Arkiv; this list fills in as it goes.</div>;
  return (
    <div className="space-y-3 p-10 text-center">
      <p className="text-text-primary">No datasets match{view.q ? ` '${view.q}'` : " these filters"}.</p>
      <div className="flex items-center justify-center gap-4">
        <button type="button" onClick={onClear} className="text-accent hover:underline">Clear filters</button>
        {view.q && <a href={`/ask?q=${encodeURIComponent(view.q)}`} className="text-ai hover:underline">Ask Arkiv instead</a>}
      </div>
    </div>
  );
}
