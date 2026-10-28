"use client";

import { Pencil, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type AskQuery, chipText, type Interpreted, invalidValue, type Leaf, OP_SYMBOL, OP_WORDS, opsFor, typeOf } from "./plan";

/** "Interpreted as": the plan as chips, each editable without asking again (design/04-ask-arkiv.md). */
export function InterpretationCard({ result, onEdit, isBusy }: { result: Interpreted; onEdit: (path: number[], next: AskQuery | null) => void; isBusy: boolean }) {
  const { plan, dataset, engine } = result;
  return (
    <section aria-label="Interpretation" className="rounded-md p-4 tint-ai">
      <div className="label flex items-center gap-1.5">
        <Sparkles size={14} aria-hidden /> Interpreted as
        <span className="ml-auto normal-case tracking-normal caption text-text-tertiary">{engine === "claude" ? "by Claude" : "by catalogue rules"}</span>
      </div>
      {dataset && (
        <p className="mt-2 mono-sm text-text-primary">
          dataset = <Link href={`/catalogue/${dataset.id}`} className="underline decoration-ai/50 underline-offset-2 hover:decoration-ai">{dataset.project} / {dataset.name}</Link>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {plan.where ? <Node q={plan.where} path={[]} negated={false} onEdit={onEdit} isBusy={isBusy} /> : <span className="caption text-text-secondary">Every record in this dataset.</span>}
      </div>
      {plan.ignored?.length > 0 && (
        <p className="mt-3 rounded-sm px-2.5 py-1.5 caption tint-warn">
          Not used: {plan.ignored.map((w) => `“${w}”`).join(", ")}. The results are not filtered by {plan.ignored.length === 1 ? "it" : "them"}; name
          the attribute to filter (for example “city Pune”).
        </p>
      )}
      {(plan.explain.length > 0 || result.note) && (
        <ul className="mt-3 space-y-0.5 caption text-text-secondary">
          {plan.explain.map((e) => <li key={e}>{e}</li>)}
          {result.note && <li className="text-warn">{result.note}</li>}
          {engine === "claude" && plan.explain.length > 0 && <li className="text-text-tertiary">Notes are model output; the query above is checked against the catalogue.</li>}
        </ul>
      )}
    </section>
  );
}

function Node({ q, path, negated, onEdit, isBusy }: { q: AskQuery; path: number[]; negated: boolean; onEdit: (path: number[], next: AskQuery | null) => void; isBusy: boolean }) {
  if (q.op === "not") return <Node q={q.term} path={[...path, 0]} negated={!negated} onEdit={onEdit} isBusy={isBusy} />;
  if (q.op === "and" || q.op === "or") {
    const inner = q.terms.map((t, i) => (
      <span key={i} className="contents">
        {i > 0 && <span className="caption font-medium text-text-tertiary">{q.op.toUpperCase()}</span>}
        <Node q={t} path={[...path, i]} negated={false} onEdit={onEdit} isBusy={isBusy} />
      </span>
    ));
    const grouped = path.length > 0 || negated;
    return grouped ? <span className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-ai/30 px-1.5 py-1">{negated && <span className="caption font-medium">NOT</span>}<span className="text-text-tertiary">(</span>{inner}<span className="text-text-tertiary">)</span></span> : <>{inner}</>;
  }
  return <Chip leaf={q as Leaf} negated={negated} path={path} onEdit={onEdit} isBusy={isBusy} />;
}

function Chip({ leaf, negated, path, onEdit, isBusy }: { leaf: Leaf; negated: boolean; path: number[]; onEdit: (path: number[], next: AskQuery | null) => void; isBusy: boolean }) {
  const [isOpen, setOpen] = useState(false);
  const type = typeOf(leaf);
  return (
    <span className="relative">
      <button type="button" disabled={isBusy} onClick={() => setOpen((o) => !o)} aria-expanded={isOpen}
        aria-label={`Edit condition: ${negated ? "not " : ""}${leaf.attr} ${OP_WORDS[leaf.op]} ${leaf.value}`}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border-default bg-canvas px-2 py-1 mono-sm text-text-primary hover:border-ai/60 disabled:opacity-60">
        <span className="max-w-[28ch] truncate" title={chipText(leaf, negated)}>{chipText(leaf, negated)}</span>
        <span className="rounded-[4px] bg-raised px-1 text-[11px] leading-4 text-text-tertiary">{type}</span>
        <Pencil size={12} className="text-text-tertiary" aria-hidden />
      </button>
      {isOpen && <ChipEditor leaf={leaf} negated={negated} onClose={() => setOpen(false)} onApply={(next) => { setOpen(false); onEdit(path, next); }} />}
    </span>
  );
}

function ChipEditor({ leaf, negated, onClose, onApply }: { leaf: Leaf; negated: boolean; onClose: () => void; onApply: (next: AskQuery | null) => void }) {
  const type = typeOf(leaf);
  const [op, setOp] = useState<Leaf["op"]>(leaf.op);
  const [value, setValue] = useState(leaf.value);
  const panel = useRef<HTMLDivElement>(null);
  const problem = invalidValue(type, value);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("select, input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const apply = () => {
    if (problem) return;
    const next: Leaf = op === "startsWith" ? { op, attr: leaf.attr, value } : { op, attr: leaf.attr, type, value };
    // The chip's path points inside any NOT, so the NOT stays.
    onApply(next);
  };
  return (
    <div ref={panel} role="dialog" aria-label={`Edit ${leaf.attr}`} className="absolute left-0 top-full z-20 mt-1.5 w-[300px] space-y-3 rounded-md border border-border-default bg-overlay p-3 shadow-[0_12px_32px_rgb(0_0_0/0.45)] fade-in">
      <div className="flex items-center justify-between">
        <span className="mono-sm text-text-primary">{negated ? "NOT " : ""}{leaf.attr} <span className="caption text-text-tertiary">{type}</span></span>
        <button type="button" onClick={onClose} aria-label="Close" className="text-text-tertiary hover:text-text-primary"><X size={14} /></button>
      </div>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); apply(); }}>
        <div className="flex gap-2">
          <select value={op} onChange={(e) => setOp(e.target.value as Leaf["op"])} aria-label="Operator"
            className="h-8 rounded-sm border border-border-control bg-canvas px-2 mono-sm text-text-primary">
            {opsFor(type).map((o) => <option key={o} value={o}>{OP_SYMBOL[o]}</option>)}
          </select>
          {type === "bool" ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Value" className="h-8 flex-1 rounded-sm border border-border-control bg-canvas px-2 mono-sm text-text-primary">
              <option value="true">true</option><option value="false">false</option>
            </select>
          ) : (
            <input value={value} onChange={(e) => setValue(e.target.value.trim())} aria-label="Value" aria-invalid={problem !== null} aria-describedby="chip-problem"
              inputMode={["i32", "u64", "u256", "dec"].includes(type) ? "decimal" : "text"}
              className="h-8 min-w-0 flex-1 rounded-sm border border-border-control bg-canvas px-2 mono-sm text-text-primary aria-[invalid=true]:border-danger" />
          )}
        </div>
        <p id="chip-problem" className={`caption ${problem ? "text-danger" : "text-text-tertiary"}`}>{problem ?? "Values are exact: same case, the attribute's own unit."}</p>
        <div className="flex items-center gap-2 pt-1">
          <button type="submit" disabled={problem !== null} className="h-8 rounded-sm bg-accent px-3 font-medium text-on-accent disabled:opacity-50">Run again</button>
          <button type="button" onClick={() => onApply(null)} className="h-8 rounded-sm px-2 text-text-secondary hover:text-text-primary">Remove condition</button>
        </div>
      </form>
    </div>
  );
}

/** Skeleton while the question is read (appears after 150 ms, Pattern 2). */
export function InterpretingCard() {
  const [isShown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 150); return () => clearTimeout(t); }, []);
  return (
    <section aria-busy className="rounded-md p-4 tint-ai">
      <div className="label flex items-center gap-1.5"><Sparkles size={14} aria-hidden /> Interpreted as</div>
      <div className={`mt-3 flex gap-2 transition-opacity ${isShown ? "opacity-100" : "opacity-0"}`}>
        <span className="h-7 w-44 rounded-sm bg-raised" /><span className="h-7 w-32 rounded-sm bg-raised" />
      </div>
      <p className="mt-3 caption text-text-secondary">Reading the catalogue schema…</p>
    </section>
  );
}
