"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCount, middle } from "../../lib/format";
import { RecordDialog } from "./record-dialog";

type Row = { key: string; createdAtBlock: number; attributes: { name: string; value: string }[] };
type Loaded = { total: number; records: Row[] };
/** Records asked for per request, and the most the table holds (the API's own cap). */
const PAGE = 200;
const MAX = 2_000;
/** The first answer's share of the progress bar, and the fastest the bar may cross its whole length. */
const FIRST = 0.35;
const FULL_MS = 900;

/**
 * Every live record of one dataset as a table: one row per record, one column per attribute name.
 * Values are rendered as text by React, so nothing a record holds can run as markup.
 */
export function DatasetRecords({ id, live }: { id: string; live: number }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [hasFailed, setFailed] = useState(false);
  // The record whose full detail is open in a window.
  const [open, setOpen] = useState<string | null>(null);

  // Read a page at a time, so a large dataset shows how far the read has got.
  const [progress, setProgress] = useState({ read: 0, of: Math.min(live, MAX) });
  useEffect(() => {
    const stop = new AbortController();
    void (async () => {
      const records: Row[] = [];
      let total = 0;
      do {
        const r = await fetch(`/api/datasets/${encodeURIComponent(id)}?records=live&offset=${records.length}&limit=${PAGE}`, { cache: "no-store", signal: stop.signal });
        if (!r.ok) throw new Error(String(r.status));
        const page = (await r.json()) as Loaded;
        total = page.total;
        records.push(...page.records);
        setProgress({ read: records.length, of: Math.min(total, MAX) });
        if (page.records.length < PAGE) break;
      } while (records.length < Math.min(total, MAX));
      setData({ total, records });
    })().catch(() => { if (!stop.signal.aborted) setFailed(true); });
    return () => stop.abort();
  }, [id]);

  // The bar's share of the whole job. The first answer carries the set-up cost (the server may be
  // re-reading the index), so it is worth FIRST of the bar; the remaining pages split the rest. While
  // an answer is awaited the bar keeps creeping towards that step's end, slowing as it nears it, so a
  // long wait shows as movement and not as a stall at 0%. It never claims a step that has not landed.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const pages = Math.max(1, Math.ceil(progress.of / PAGE));
    const done = Math.min(pages, Math.ceil(progress.read / PAGE));
    const at = (n: number) => (n <= 0 ? 0 : pages === 1 || n >= pages ? 1 : FIRST + (1 - FIRST) * ((n - 1) / (pages - 1)));
    // Everything has arrived: finish the climb whatever the page arithmetic says.
    const [from, to] = data ? [1, 1] : [at(done), at(done + 1)];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(from); return; }
    const since = performance.now();
    let last = since;
    // A timer, not animation frames: frames stop while the tab is hidden, and the table must still arrive.
    const timer = setInterval(() => {
      const now = performance.now();
      const target = from + (to - from) * 0.92 * (1 - Math.exp(-(now - since) / 900));
      const gain = (now - last) / FULL_MS;
      last = now;
      setShown((v) => Math.min(Math.max(target, from), v + gain));
    }, 33);
    return () => clearInterval(timer);
  }, [progress, data]);
  const isCounting = progress.of > 0 && shown < 0.999;

  // Columns: attribute names, the ones most records carry first.
  const columns = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of data?.records ?? []) for (const a of r.attributes) seen.set(a.name, (seen.get(a.name) ?? 0) + 1);
    return [...seen].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [data]);

  if (hasFailed) return <p className="text-text-secondary">Its records could not be read. <a href={`/catalogue/${id}`} className="text-accent hover:underline">Open the dataset</a></p>;
  if (!data || isCounting) {
    const share = Math.min(1, shown);
    return (
      // The same bar as "Decoding records" on the Catalogue: spinner and label, count and percent, a
      // teal-to-violet fill with a moving sheen, quarter marks, and a bright marker at the leading edge.
      <div className="rounded-md border border-border-default bg-surface px-3 py-3 sm:px-4" aria-busy="true">
        <div className="flex items-center gap-2">
          <span className="decode-spin size-3 rounded-full border-2 border-accent border-t-accent/25" aria-hidden />
          <span className="label text-text-secondary">Reading records</span>
          <span className="ml-auto whitespace-nowrap leading-4 tabular-nums">
            <span className="font-mono text-[13px] text-text-primary">{formatCount(progress.read)} / {formatCount(progress.of)} · </span>
            <span className="font-semibold text-text-primary">{Math.round(share * 100)}%</span>
          </span>
        </div>
        <div role="progressbar" aria-label="Reading the records" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}
          className="relative mt-1.5 h-1.5 rounded-full bg-raised ring-1 ring-border-subtle ring-inset">
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="decode-fill-active absolute inset-0 origin-left rounded-full" style={{ transform: `scaleX(${share})` }} />
            <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${share * 100}%` }}>
              <div className="decode-sheen absolute inset-0" />
            </div>
            {[25, 50, 75].map((p) => <span key={p} className="absolute top-1/2 h-0.5 w-px -translate-y-1/2 bg-border-subtle" style={{ left: `${p}%` }} />)}
          </div>
          <div className="pointer-events-none absolute inset-0" style={{ transform: `translateX(${(share - 1) * 100}%)` }}>
            <span className="decode-breathe absolute -right-px -top-[3px] h-3 w-0.5 rounded-full bg-focus shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]" />
          </div>
        </div>
        <p className="caption mt-1.5 text-text-tertiary">{progress.read === 0 ? "Getting the dataset ready" : `${formatCount(progress.of - progress.read)} waiting`}</p>
      </div>
    );
  }
  if (data.records.length === 0) return <p className="text-text-secondary">No live records right now. <a href={`/catalogue/${id}`} className="text-accent hover:underline">Open the dataset</a></p>;

  const isCut = data.records.length < data.total;
  return (
    <>
      <p className="caption text-text-secondary">
        {isCut ? `The newest ${formatCount(data.records.length)} of ${formatCount(data.total)} live records` : `${formatCount(data.total)} live record${data.total === 1 ? "" : "s"}, newest first`}
        {" · "}click a row for its transaction{" · "}<a href={`/catalogue/${id}`} className="text-accent hover:underline">Open dataset</a>
      </p>
      {open && <RecordDialog key={open} recordKey={open} onClose={() => setOpen(null)} />}
      <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-border-subtle" tabIndex={0} role="region" aria-label="Live records">
        <table className="w-max min-w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-raised">
            <tr>
              <th scope="col" title="Position by age among the live records: the newest has the highest number" className="label whitespace-nowrap px-2.5 py-2 font-medium text-text-tertiary">#</th>
              <th scope="col" className="label whitespace-nowrap px-2.5 py-2 font-medium text-text-tertiary">Record</th>
              {columns.map((c) => <th key={c} scope="col" className="label whitespace-nowrap px-2.5 py-2 font-medium text-text-tertiary">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.records.map((r, i) => {
              const values = new Map(r.attributes.map((a) => [a.name, a.value]));
              return (
                <tr key={r.key} onClick={() => setOpen(r.key)} className="cursor-pointer border-t border-border-subtle hover:bg-raised/60">
                  <td className="caption px-2.5 py-1.5 tabular-nums text-text-tertiary">{formatCount(data.total - i)}</td>
                  <td className="mono-sm whitespace-nowrap px-2.5 py-1.5" title={r.key}><button type="button" onClick={(e) => { e.stopPropagation(); setOpen(r.key); }} className="text-accent hover:underline" aria-label={`Open record ${r.key}`}>{middle(r.key)}</button></td>
                  {columns.map((c) => {
                    const v = values.get(c);
                    return <td key={c} className="mono-sm max-w-[220px] truncate px-2.5 py-1.5" title={v}>{v ?? <span className="text-text-tertiary">·</span>}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
