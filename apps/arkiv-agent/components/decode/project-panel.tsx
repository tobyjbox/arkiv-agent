"use client";

import type { ArchetypeId, Decode, DecodeProject } from "@arkiv-agent/decode";
// The purpose module has no database imports, so it is safe in the browser bundle.
import { archetypeLabel } from "@arkiv-agent/decode/purpose";
import { formatCount, middle } from "../../lib/format";
import { DatasetRecords } from "./dataset-records";
import { ARCHETYPE_COLOR } from "./palette";

export const ARCHETYPE_LABEL = (id: ArchetypeId) => archetypeLabel(id);
const name = (p: Pick<DecodeProject, "label" | "isLabel">) => (p.isLabel ? p.label : middle(p.label));

function Overview({ decode, onSelect }: { decode: Decode; onSelect: (id: string) => void }) {
  const decoded = decode.projects.filter((p) => p.purpose.archetype !== "unclear").slice(0, 14);
  return (
    <>
      <h2 className="text-[16px] font-semibold">Pick a project</h2>
      <p className="mt-1 text-text-secondary">Click a node, or start with one of the largest projects whose purpose could be read from its data.</p>
      <ul className="mt-3 space-y-1">
        {decoded.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onSelect(p.id)} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-raised">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ARCHETYPE_COLOR[p.purpose.archetype] }} aria-hidden />
              <span className="mono-sm min-w-0 flex-1 truncate">{name(p)}</span>
              <span className="caption shrink-0 text-text-tertiary">{ARCHETYPE_LABEL(p.purpose.archetype)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ProjectPanel({ decode, project, datasetId, onCloseDataset, onSelect, heightClass }: { decode: Decode; project: DecodeProject | null; datasetId: string | null; onCloseDataset: () => void; onSelect: (id: string | null) => void; heightClass: string }) {
  if (!project) return <aside className={`${heightClass} overflow-y-auto rounded-md border border-border-subtle bg-surface p-5`}><Overview decode={decode} onSelect={onSelect} /></aside>;
  const ids = new Map(decode.projects.flatMap((p) => p.datasets.map((d) => [d.id, { name: d.name, project: p }] as const)));
  const own = new Set(project.datasets.map((d) => d.id));
  const model = decode.refEdges.filter((e) => own.has(e.from) || (e.to !== null && own.has(e.to))).slice(0, 14);
  const shapes = decode.sharedShapes.filter((s) => s.projects.includes(project.id));
  const builders = decode.sharedBuilders.filter((b) => b.a === project.id || b.b === project.id);
  const labelOf = (id: string) => { const p = decode.projects.find((x) => x.id === id); return p ? name(p) : id; };
  const flagged = project.datasets.filter((d) => d.flags.length);
  const { purpose } = project;
  const dataset = datasetId ? project.datasets.find((d) => d.id === datasetId) ?? null : null;

  // A dataset was clicked on the map: the pane becomes its records, and the table takes the height.
  if (dataset) {
    return (
      <aside className={`${heightClass} flex flex-col gap-3 rounded-md border border-border-subtle bg-surface p-5`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="caption truncate text-text-tertiary">{name(project)}</p>
            <h2 className="mono-sm break-all text-[15px] font-semibold">{dataset.name}</h2>
          </div>
          <button type="button" onClick={onCloseDataset} className="caption shrink-0 rounded-full border border-border-default px-2.5 py-1 text-text-secondary hover:text-text-primary">← Project</button>
        </div>
        <DatasetRecords key={dataset.id} id={dataset.id} live={dataset.live} />
      </aside>
    );
  }

  return (
    <aside className={`${heightClass} space-y-5 overflow-y-auto rounded-md border border-border-subtle bg-surface p-5`} aria-live="polite">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="mono-sm min-w-0 break-all text-[15px] font-semibold">{name(project)}</h2>
          <button type="button" onClick={() => onSelect(null)} className="caption shrink-0 rounded-full border border-border-default px-2.5 py-1 text-text-secondary hover:text-text-primary">← Back</button>
        </div>
        <p className="caption mt-1 text-text-secondary">{formatCount(project.live)} live records · {project.datasets.length} dataset{project.datasets.length === 1 ? "" : "s"} · {project.writers} writer{project.writers === 1 ? "" : "s"}</p>
        {project.isLabel && <a href={`/catalogue?q=${encodeURIComponent(project.label)}`} className="caption text-accent hover:underline">Open in the catalogue</a>}
      </div>

      <section>
        <h3 className="label text-text-tertiary">Appears to be</h3>
        <p className="mt-1 flex items-center gap-2 text-[15px] font-medium">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ARCHETYPE_COLOR[purpose.archetype] }} aria-hidden />
          {ARCHETYPE_LABEL(purpose.archetype)}
          {purpose.archetype !== "unclear" && <span className="caption font-normal text-text-tertiary">{Math.round(purpose.confidence * 100)}% of the evidence{purpose.runnerUp ? `, then ${ARCHETYPE_LABEL(purpose.runnerUp).toLowerCase()}` : ""}</span>}
        </p>
        <p className="caption mt-1 text-text-secondary">{purpose.evidence.length ? <>Words in its names: {purpose.evidence.map((w) => <code key={w} className="mr-1 rounded-sm bg-raised px-1 font-mono">{w}</code>)}</> : "Its names gave no clue."}</p>
        <ul className="mt-2 space-y-0.5 text-text-secondary">{project.traits.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>

      <section>
        <h3 className="label text-text-tertiary">Data model</h3>
        {model.length === 0 ? <p className="mt-1 text-text-secondary">No links between its records.</p> : (
          <ul className="mt-1 space-y-1.5">
            {model.map((e) => {
              const to = e.to === null ? null : ids.get(e.to);
              return (
                <li key={`${e.from}|${e.attr}|${e.to}`} className="mono-sm leading-5">
                  <a href={`/catalogue/${e.from}`} className="hover:underline">{ids.get(e.from)?.name ?? e.from}</a>
                  <span className="text-text-tertiary">.{e.attr} → </span>
                  {to ? <a href={`/catalogue/${e.to}`} className="hover:underline">{to.name}</a> : <span className="text-danger">not in the catalogue</span>}
                  {to && !own.has(e.to!) && <span className="caption text-info"> ({name(to.project)})</span>}
                  {!own.has(e.from) && <span className="caption text-info"> (from {labelOf(ids.get(e.from)?.project.id ?? "")})</span>}
                  <span className="caption block font-sans text-text-tertiary">{formatCount(e.count)} link{e.count === 1 ? "" : "s"}{e.broken ? <span className="text-danger">, {formatCount(e.broken)} broken</span> : ""}{e.isImplicit ? ", stored as text" : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(shapes.length > 0 || builders.length > 0) && (
        <section>
          <h3 className="label text-text-tertiary">In common with other projects</h3>
          <ul className="mt-1 space-y-1 text-text-secondary">
            {shapes.map((s) => <li key={s.fields.join()}>Same {s.fields.length}-attribute record shape as {s.projects.filter((p) => p !== project.id).map((p) => <button key={p} type="button" onClick={() => onSelect(p)} className="mono-sm mr-1 text-ai hover:underline">{labelOf(p)}</button>)}</li>)}
            {builders.map((b) => { const other = b.a === project.id ? b.b : b.a; return <li key={other}>Shares {b.wallets} wallet{b.wallets === 1 ? "" : "s"} with <button type="button" onClick={() => onSelect(other)} className="mono-sm text-info hover:underline">{labelOf(other)}</button></li>; })}
          </ul>
        </section>
      )}

      {flagged.length > 0 && (
        <section>
          <h3 className="label text-text-tertiary">Privacy flags</h3>
          <ul className="mt-1 space-y-1.5">
            {flagged.map((d) => (
              <li key={d.id}>
                <a href={`/catalogue/${d.id}`} className="mono-sm hover:underline">{d.name}</a>{d.isSealed && <span className="caption text-text-tertiary"> (payload encrypted)</span>}
                <span className="caption block text-text-secondary">{d.flags.map((f) => `${f.category}: ${f.fields.join(", ")}`).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
