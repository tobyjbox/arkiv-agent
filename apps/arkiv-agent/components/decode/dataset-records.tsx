"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCount, middle } from "../../lib/format";
import { RecordDialog } from "./record-dialog";

type Row = { key: string; createdAtBlock: number; attributes: { name: string; value: string }[] };
type Loaded = { total: number; records: Row[] };

/**
 * Every live record of one dataset as a table: one row per record, one column per attribute name.
 * Values are rendered as text by React, so nothing a record holds can run as markup.
 */
export function DatasetRecords({ id, live }: { id: string; live: number }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [hasFailed, setFailed] = useState(false);
  // The record whose full detail is open in a window.
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const stop = new AbortController();
    fetch(`/api/datasets/${encodeURIComponent(id)}?records=live`, { cache: "no-store", signal: stop.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Loaded>) : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => { if (!stop.signal.aborted) setFailed(true); });
    return () => stop.abort();
  }, [id]);

  // Columns: attribute names, the ones most records carry first.
  const columns = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of data?.records ?? []) for (const a of r.attributes) seen.set(a.name, (seen.get(a.name) ?? 0) + 1);
    return [...seen].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [data]);

  if (hasFailed) return <p className="text-text-secondary">Its records could not be read. <a href={`/catalogue/${id}`} className="text-accent hover:underline">Open the dataset</a></p>;
  if (!data) return <p className="text-text-secondary" aria-busy="true">Reading {formatCount(live)} records…</p>;
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
