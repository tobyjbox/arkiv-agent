"use client";

import { ArrowUp, ChevronDown, History, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { InterpretationCard, InterpretingCard } from "./interpretation-card";
import { type AskPlan, type AskQuery, askApi, chipText, type Failure, type Interpreted, leafPaths, replaceAt, runApi } from "./plan";
import { Results, type RunState } from "./results";

type Turn = {
  id: number;
  question: string;
  result: Interpreted | null;
  failure: (Failure & { examples: string[] }) | null;
  run: RunState | null;
};

const HISTORY_KEY = "arkiv-agent.ask.history";
const HISTORY_SIZE = 10;
const EMPTY_RUN: RunState = { status: "querying", rows: [], block: null, cursor: null, ms: null, failure: null, isLoadingMore: false };

function readHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[]; } catch { return []; }
}
function remember(q: string) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...readHistory().filter((x) => x !== q)].slice(0, HISTORY_SIZE))); } catch { /* private mode: history is optional */ }
}

export function AskView({ examples, scopes, initialScope, initialQuestion, engine }: {
  examples: string[];
  scopes: { id: string; label: string }[];
  initialScope: string | null;
  initialQuestion: string | null;
  engine: "rules" | "claude";
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [scope, setScope] = useState<string | null>(initialScope);
  const [announcement, setAnnouncement] = useState("");
  const nextId = useRef(1);
  const update = useCallback((id: number, patch: (t: Turn) => Partial<Turn>) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch(t) } : t))), []);
  const latest = turns[turns.length - 1];
  const isBusy = latest !== undefined && (latest.result === null && latest.failure === null || latest.run?.status === "querying");

  const run = useCallback(async (id: number, result: Interpreted, more?: { cursor: string; block: string }) => {
    update(id, (t) => ({ run: more ? { ...t.run!, isLoadingMore: true } : EMPTY_RUN }));
    const r = await runApi({ plan: result.plan, ...(more && { cursor: more.cursor, block: more.block }) });
    if (!r.ok) {
      update(id, (t) => ({ run: { ...(t.run ?? EMPTY_RUN), status: "failed", failure: { kind: r.kind, message: r.message }, isLoadingMore: false } }));
      setAnnouncement(r.kind === "timeout" ? r.message : "The query failed.");
      return;
    }
    update(id, (t) => {
      const rows = more ? [...(t.run?.rows ?? []), ...r.rows] : r.rows;
      return {
        result: t.result && { ...t.result, query: r.query, typescript: r.typescript, explorerUrl: r.explorerUrl },
        run: { status: "done", rows, block: r.block, cursor: r.cursor, ms: (more ? t.run?.ms ?? 0 : 0) + r.ms, failure: null, isLoadingMore: false },
      };
    });
    if (!more) setAnnouncement(`${r.rows.length}${r.cursor ? " or more" : ""} results.`);
  }, [update]);

  /** A new question starts fresh; a follow-up (the box under the results) narrows the last answer. */
  const ask = useCallback(async (question: string, isFollowUp = false) => {
    const q = question.trim();
    if (!q) return;
    remember(q);
    const id = nextId.current++;
    const previous = [...turns].reverse().find((t) => t.result)?.result?.plan ?? null;
    setTurns((ts) => [...ts, { id, question: q, result: null, failure: null, run: null }]);
    const r = await askApi({ question: q, scope, previous: isFollowUp ? previous : null });
    if (!r.ok) {
      update(id, () => ({ failure: { kind: r.kind, message: r.message, examples: r.examples } }));
      setAnnouncement("Not understood. Example questions are shown below.");
      return;
    }
    const { ok: _, ...result } = r;
    update(id, () => ({ result }));
    setAnnouncement(`Interpreted as ${leafPaths(result.plan.where).length || "no"} conditions.`);
    void run(id, result);
  }, [turns, scope, update, run]);

  const edit = (turn: Turn, path: number[], next: AskQuery | null) => {
    if (!turn.result) return;
    const where = turn.result.plan.where ? replaceAt(turn.result.plan.where, path, next) : next;
    const plan: AskPlan = { ...turn.result.plan, where, explain: turn.result.plan.explain };
    const result = { ...turn.result, plan };
    update(turn.id, () => ({ result }));
    void run(turn.id, result);
  };

  const started = useRef(false);
  useEffect(() => {
    if (initialQuestion && !started.current) { started.current = true; void ask(initialQuestion); }
  }, [initialQuestion, ask]);

  return (
    <div className="space-y-8">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <QuestionBox onAsk={(q) => ask(q)} isBusy={isBusy} examples={turns.length === 0 ? examples : []} variant="main" />

      <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-x-4 gap-y-2 caption text-text-tertiary">
        <label className="flex min-w-0 items-center gap-1.5">
          Scope
          <span className="relative min-w-0">
            <select value={scope ?? ""} onChange={(e) => setScope(e.target.value || null)} className="h-7 w-full max-w-[min(300px,70vw)] appearance-none truncate rounded-sm border border-border-default bg-surface pl-2 pr-7 text-text-primary">
              <option value="">All datasets</option>
              {scopes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-2 text-text-tertiary" aria-hidden />
          </span>
        </label>
        <span>Read-only · runs live on Arkiv testnet</span>
        <span>{engine === "claude" ? "Questions are read by Claude, checked against the catalogue." : "Questions are read by catalogue rules. Add ANTHROPIC_API_KEY to use Claude."}</span>
      </div>

      {turns.length === 0 && (
        <p className="mx-auto max-w-[760px] text-text-secondary">
          ArkivAgent turns your question into an Arkiv query using the catalogue's schema, then runs it live. You'll always see the query.
        </p>
      )}

      {turns.map((t, i) => {
        const isLatest = i === turns.length - 1;
        if (!isLatest && t.result) {
          return (
            <details key={t.id} className="rounded-md border border-border-subtle bg-surface px-4 py-2">
              <summary className="cursor-pointer caption text-text-secondary">
                <span className="text-text-primary">“{t.question}”</span> · {leafPaths(t.result.plan.where).map((l) => chipText(l.leaf, l.negated)).join(" · ") || "all records"}
              </summary>
              <div className="mt-3 space-y-3 pb-2">
                <InterpretationCard result={t.result} onEdit={(p, n) => edit(t, p, n)} isBusy={isBusy} />
                {t.run && <Results result={t.result} run={t.run} onLoadMore={() => t.run?.cursor && t.run.block && void run(t.id, t.result!, { cursor: t.run.cursor, block: t.run.block })} onRetry={() => void run(t.id, t.result!)} onRemove={(p) => edit(t, p, null)} />}
              </div>
            </details>
          );
        }
        return (
          <article key={t.id} className="space-y-3 fade-in">
            <p className="caption text-text-tertiary">You asked: <span className="text-text-secondary">“{t.question}”</span></p>
            {!t.result && !t.failure && <InterpretingCard />}
            {t.failure && <NotUnderstood failure={t.failure} onAsk={ask} />}
            {t.result && <InterpretationCard result={t.result} onEdit={(p, n) => edit(t, p, n)} isBusy={isBusy} />}
            {t.result && t.run && (
              <Results result={t.result} run={t.run}
                onLoadMore={() => t.run?.cursor && t.run.block && void run(t.id, t.result!, { cursor: t.run.cursor, block: t.run.block })}
                onRetry={() => void run(t.id, t.result!)} onRemove={(p) => edit(t, p, null)} />
            )}
          </article>
        );
      })}

      {turns.some((t) => t.result) && <QuestionBox onAsk={(q) => ask(q, true)} isBusy={isBusy} examples={[]} variant="follow-up" />}
    </div>
  );
}

function NotUnderstood({ failure, onAsk }: { failure: Failure & { examples: string[] }; onAsk: (q: string) => void }) {
  return (
    <section className="space-y-2 rounded-md border border-border-default bg-surface p-4">
      <p className="text-text-primary">{failure.kind === "refused" ? "Claude declined this question." : "ArkivAgent couldn't turn that into a query."}</p>
      <p className="caption text-text-secondary">Mention a kind of data or an attribute, for example:</p>
      <div className="flex flex-wrap gap-2">
        {failure.examples.map((e) => <button key={e} type="button" onClick={() => onAsk(e)} className="rounded-full border border-border-default px-3 py-1 caption text-text-secondary hover:text-text-primary">{e}</button>)}
      </div>
      {failure.kind === "invalid" && (
        <details className="caption text-text-tertiary"><summary className="cursor-pointer">Technical details</summary><p className="mt-1 font-mono">{failure.message}</p></details>
      )}
    </section>
  );
}

function QuestionBox({ onAsk, isBusy, examples, variant }: { onAsk: (q: string) => void; isBusy: boolean; examples: string[]; variant: "main" | "follow-up" }) {
  const isFirst = variant === "main";
  const [text, setText] = useState("");
  const [isFocused, setFocused] = useState(false);
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState<string[] | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Placeholder rotates through the examples while empty and unfocused; never under reduced motion.
  useEffect(() => {
    if (examples.length < 2 || text || isFocused || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTick((n) => n + 1), 4_000);
    return () => clearInterval(t);
  }, [examples.length, text, isFocused]);

  // "/" focuses the input from anywhere on the page.
  useEffect(() => {
    if (!isFirst) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.isContentEditable) { e.preventDefault(); box.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFirst]);

  const submit = (q = text) => {
    if (!q.trim() || isBusy) return;
    onAsk(q);
    setText("");
  };
  const placeholder = isFirst ? (examples.length ? examples[tick % examples.length]! : "Ask a new question") : "Ask a follow-up, like “only in Surat”…";

  return (
    <div className={isFirst ? "mx-auto max-w-[760px] space-y-3" : "space-y-2"}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}
        className={`relative flex items-start gap-3 rounded-lg border bg-raised px-4 transition-[border-color,box-shadow] duration-200 ${isFirst ? "py-4" : "py-2.5"} ${isFocused ? "border-focus shadow-[0_0_0_1px_var(--color-focus),0_0_48px_color-mix(in_srgb,var(--color-ai)_12%,transparent)]" : "border-border-control shadow-[0_0_48px_color-mix(in_srgb,var(--color-ai)_8%,transparent)]"}`}>
        <Sparkles size={18} className="mt-0.5 shrink-0 text-ai" aria-hidden />
        <label htmlFor={isFirst ? "ask-input" : "ask-follow-up"} className="sr-only">{isFirst ? "Ask a question about data on Arkiv" : "Ask a follow-up"}</label>
        <textarea id={isFirst ? "ask-input" : "ask-follow-up"} ref={box} rows={1} value={text} placeholder={placeholder}
          onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          className={`min-w-0 flex-1 resize-none bg-transparent text-text-primary outline-none placeholder:text-text-tertiary ${isFirst ? "text-[16px] leading-6" : ""}`} />
        {isFirst && (
          <span className="relative">
            <button type="button" aria-label="Recent questions" aria-expanded={history !== null} onClick={() => setHistory((h) => (h ? null : readHistory()))}
              className="inline-flex size-7 items-center justify-center rounded-sm text-text-tertiary hover:bg-overlay hover:text-text-primary"><History size={16} /></button>
            {history && (
              <div className="absolute right-0 top-full z-20 mt-2 w-[320px] rounded-md border border-border-default bg-overlay p-1 shadow-[0_12px_32px_rgb(0_0_0/0.45)]">
                <p className="px-2 py-1.5 label text-text-tertiary">Recent (this browser only)</p>
                {history.length === 0 && <p className="px-2 pb-2 caption text-text-secondary">No questions yet.</p>}
                {history.map((h) => <button key={h} type="button" onClick={() => { setHistory(null); submit(h); }} className="block w-full truncate rounded-sm px-2 py-1.5 text-left text-text-secondary hover:bg-raised hover:text-text-primary">{h}</button>)}
              </div>
            )}
          </span>
        )}
        <button type="submit" disabled={!text.trim() || isBusy} aria-label="Ask"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm bg-accent text-on-accent disabled:bg-overlay disabled:text-text-disabled"><ArrowUp size={16} /></button>
      </form>
      {isFirst && examples.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 caption [scrollbar-width:none] md:flex-wrap md:justify-center md:overflow-visible">
          <span className="shrink-0 text-text-tertiary">Try:</span>
          {examples.map((e) => (
            <button key={e} type="button" disabled={isBusy} onClick={() => submit(e)} className="shrink-0 rounded-full border border-border-default px-3 py-1 text-text-secondary hover:border-ai/50 hover:text-text-primary">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}
