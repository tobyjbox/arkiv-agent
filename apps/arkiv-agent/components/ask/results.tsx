"use client";

import { ExternalLink, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BLOCK_SECONDS, ago, duration, formatCount, middle } from "../../lib/format";
import { CopyButton } from "../ui/copy-button";
import { RollingNumber } from "../ui/rolling-number";
import { type AskQuery, type AskRow, chipText, type Failure, type Interpreted, leafPaths } from "./plan";

const SHOWN_COLUMNS = 5;
const CELL_CHARS = 48;

export type RunState = {
  status: "querying" | "done" | "failed";
  rows: AskRow[];
  block: string | null;
  cursor: string | null;
  ms: number | null;
  failure: Failure | null;
  isLoadingMore: boolean;
};

const clip = (s: string) => (s.length > CELL_CHARS ? `${s.slice(0, CELL_CHARS)}…` : s);

/** Columns: the dataset's schema order, or (across datasets) the attributes the rows carry most. */
function columnsFor(result: Interpreted, rows: AskRow[]): string[] {
  if (result.dataset) return result.dataset.columns.map((c) => c.name);
  const counts = new Map<string, number>();
  for (const r of rows) for (const k of Object.keys(r.attributes)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export function Results({ result, run, onLoadMore, onRetry, onRemove }: {
  result: Interpreted; run: RunState; onLoadMore: () => void; onRetry: () => void; onRemove: (path: number[]) => void;
}) {
  const [tab, setTab] = useState<"results" | "query" | "ts">("results");
  const [isWide, setWide] = useState(false);
  const tabs = useRef<HTMLDivElement>(null);
  const all = columnsFor(result, run.rows);
  const columns = isWide ? all : all.slice(0, SHOWN_COLUMNS);
  const head = run.block ? Number(run.block) : null;
  const created = (r: AskRow) => (head && r.createdAtBlock ? ago(Math.max(0, (head - Number(r.createdAtBlock)) * BLOCK_SECONDS)) : "—");
  const expires = (r: AskRow) => (head && r.expiresAtBlock ? `in ${duration(Math.max(0, Number(r.expiresAtBlock) - head)).replace("~", "")}` : "—");
  const names = ["results", "query", "ts"] as const;
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = names[(names.indexOf(tab) + (e.key === "ArrowRight" ? 1 : names.length - 1)) % names.length]!;
    setTab(next);
    tabs.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
  };

  return (
    <section aria-label="Results" className="overflow-hidden rounded-md border border-border-subtle bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-2">
        <div ref={tabs} role="tablist" aria-label="Result views" className="flex" onKeyDown={onTabKey}>
          {names.map((t) => (
            <button key={t} data-tab={t} role="tab" type="button" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-2.5 caption ${tab === t ? "text-text-primary shadow-[inset_0_-2px_0_var(--color-accent)]" : "text-text-secondary hover:text-text-primary"}`}>
              {t === "results" ? <>Results <span className="rounded-full bg-raised px-1.5 text-text-secondary"><RollingNumber value={run.rows.length} />{run.cursor ? "+" : ""}</span></> : t === "query" ? "Query" : "TypeScript"}
            </button>
          ))}
        </div>
        <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 px-2 py-2 caption text-info hover:underline">
          Open in Data Explorer <ExternalLink size={13} aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>

      {tab === "query" && <Code text={result.query} label="Copy query" />}
      {tab === "ts" && (
        <>
          <Code text={result.typescript} label="Copy code" />
          <p className="border-t border-border-subtle px-4 py-2 caption text-text-tertiary">Read-only. Uses the public client; no wallet needed.</p>
        </>
      )}
      {tab === "results" && (
        <div>
          {run.status === "querying" && <QueryingRows columns={columns.length} />}
          {run.status === "failed" && run.failure && <RunFailure failure={run.failure} onRetry={onRetry} />}
          {run.status === "done" && run.rows.length === 0 && <NoResults result={result} onRemove={onRemove} />}
          {run.rows.length > 0 && (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead className="caption text-text-tertiary">
                    <tr className="border-b border-border-subtle">
                      <th scope="col" className="px-4 py-2 font-medium">key</th>
                      {columns.map((c) => <th key={c} scope="col" className="px-3 py-2 font-mono font-medium">{c}</th>)}
                      <th scope="col" className="px-3 py-2 font-medium">created</th>
                      <th scope="col" className="px-3 py-2 font-medium">expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.rows.map((r, i) => (
                      <tr key={r.key} className="row-in border-b border-border-subtle last:border-0 hover:bg-raised/50" style={{ animationDelay: `${Math.min(i, 20) * 16}ms`, animationFillMode: "backwards" }}>
                        <td className="whitespace-nowrap px-4 py-2"><span className="font-mono text-[13px]" title={r.key}>{middle(r.key, 6)}</span><CopyButton value={r.key} label="Copy entity key" className="ml-1 align-middle" /></td>
                        {columns.map((c) => <td key={c} className="max-w-[24ch] truncate px-3 py-2 font-mono text-[13px] text-text-secondary" title={r.attributes[c]}>{r.attributes[c] === undefined ? <span className="text-text-disabled">—</span> : clip(r.attributes[c]!)}</td>)}
                        <td className="whitespace-nowrap px-3 py-2 caption text-text-secondary">{created(r)}</td>
                        <td className="whitespace-nowrap px-3 py-2 caption text-text-secondary">{expires(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-border-subtle md:hidden">
                {run.rows.map((r) => (
                  <li key={r.key} className="space-y-1 px-4 py-3 row-in">
                    <div className="flex items-center justify-between"><span className="font-mono text-[13px]">{middle(r.key, 6)}</span><span className="caption text-text-tertiary">{created(r)}</span></div>
                    {all.slice(0, 2).map((c) => <div key={c} className="truncate caption"><span className="font-mono text-text-tertiary">{c}</span> <span className="font-mono text-text-secondary">{clip(r.attributes[c] ?? "—")}</span></div>)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {(run.status === "done" || run.rows.length > 0) && run.ms !== null && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle px-4 py-2 caption text-text-tertiary">
              <span>
                {run.cursor ? `Showing first ${formatCount(run.rows.length)}, more available.` : `${formatCount(run.rows.length)} ${run.rows.length === 1 ? "record" : "records"}.`}
                {" "}Ran in {(run.ms / 1000).toFixed(1)} s, live on Arkiv at block {formatCount(Number(run.block))}.
              </span>
              {all.length > SHOWN_COLUMNS && <button type="button" onClick={() => setWide((w) => !w)} className="text-text-secondary hover:text-text-primary">{isWide ? "Fewer columns" : `All ${all.length} columns`}</button>}
              {run.cursor && <button type="button" onClick={onLoadMore} disabled={run.isLoadingMore} className="ml-auto rounded-sm border border-border-default px-2.5 py-1 text-text-primary hover:bg-raised disabled:opacity-60">{run.isLoadingMore ? "Loading…" : "Load more"}</button>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Code({ text, label }: { text: string; label: string }) {
  return (
    <div className="relative bg-canvas">
      <CopyButton value={text} label={label} className="absolute right-2 top-2" />
      <pre className="overflow-x-auto p-4 pr-12 mono-sm text-text-primary"><code>{text}</code></pre>
    </div>
  );
}

function QueryingRows({ columns }: { columns: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const t = setInterval(() => setSeconds((s) => s + 1), 1_000); return () => clearInterval(t); }, []);
  return (
    <div aria-busy>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-4 border-b border-border-subtle px-4 py-3 last:border-0">
          {Array.from({ length: Math.min(columns, 5) + 2 }, (_, k) => <span key={k} className="shimmer relative h-4 flex-1 overflow-hidden rounded-sm bg-raised" />)}
        </div>
      ))}
      <p className="px-4 py-2 caption text-text-secondary">
        Running live on Arkiv… {seconds} s{seconds >= 8 && <span className="text-text-tertiary"> · Arkiv reads can be slow. Still working.</span>}
      </p>
    </div>
  );
}

function NoResults({ result, onRemove }: { result: Interpreted; onRemove: (path: number[]) => void }) {
  const leaves = leafPaths(result.plan.where);
  const typed = leaves.map((l) => l.leaf).find((l): l is Extract<typeof l, { type: string }> => "type" in l && l.type !== "str");
  return (
    <div className="space-y-3 px-4 py-5">
      <p className="text-text-primary">No records match this query.</p>
      <ul className="list-disc space-y-0.5 pl-5 caption text-text-secondary">
        <li>Values are type-strict and case-sensitive{typed ? <>: <span className="font-mono">{typed.attr}</span> is <span className="font-mono">{typed.type}</span></> : ""}.</li>
        <li>Records may have expired; Ask reads live records only.</li>
      </ul>
      {leaves.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 caption">
          <span className="text-text-tertiary">Broaden: remove</span>
          {leaves.map((l) => (
            <button key={l.path.join(".")} type="button" onClick={() => onRemove(l.path)} className="rounded-sm border border-border-default px-2 py-0.5 font-mono text-text-secondary hover:text-text-primary">
              {chipText(l.leaf, l.negated)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RunFailure({ failure, onRetry }: { failure: Failure; onRetry: () => void }) {
  if (failure.kind === "invalid") return <p className="px-4 py-5 text-danger">This query can't run: {failure.message}</p>;
  return (
    <div className="m-4 flex flex-wrap items-center gap-3 rounded-md px-4 py-3 tint-danger">
      <span>{failure.kind === "rpc" ? `Arkiv returned an error: ${failure.message}` : failure.message} The Query and TypeScript tabs still work.</span>
      <button type="button" onClick={onRetry} className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-danger/40 px-2.5 py-1 hover:bg-danger/10"><RotateCw size={13} aria-hidden /> Retry</button>
    </div>
  );
}

export type { AskQuery };
