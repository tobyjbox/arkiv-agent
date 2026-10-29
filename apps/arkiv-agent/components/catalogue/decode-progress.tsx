"use client";

import { Check, Info, Pause } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { announcement, formatPercent, type Phase, paceParts, paceText, phase as phaseOf, quarter, type Spoken, type Tracker, track } from "../../lib/decode-progress";
import { formatCount } from "../../lib/format";
import { useLive, useSyncState } from "../live/live-provider";
import { RollingNumber } from "../ui/rolling-number";

/** Caught up: hold the full bar this long, then collapse. */
const HOLD_MS = 3_000;
const COLLAPSE_MS = 240;
/** After it has collapsed, only a real backlog brings the bar back (new writes wait a moment for decoding). */
const REAPPEAR_AT = 50;

type Visibility = "shown" | "caught-up" | "collapsing" | "gone";

/**
 * design/07: how far the indexer is with decoding live records, how fast, and whether it's moving.
 * Fed by the change feed's `undecodedLive` every 5 s; rate, ETA and stalls come from those samples.
 * Speaks through the page's polite region (`onAnnounce`) at the spec's cadence.
 */
export function DecodeProgress({ onAnnounce }: { onAnnounce: (text: string) => void }) {
  const live = useLive();
  const sync = useSyncState();
  const total = live.liveCount;
  const waiting = Math.min(live.undecodedLive, total);
  const decoded = total - waiting;
  const [visibility, setVisibility] = useState<Visibility>(() => (waiting > 0 && total > 0 ? "shown" : "gone"));
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const spoken = useRef<Spoken | null>(null);
  const labelId = useId();

  // One sample per poll that reached the server.
  useEffect(() => {
    if (live.lastOkAt !== null) setTracker((t) => track(t, { at: live.lastOkAt!, waiting }));
  }, [live.lastOkAt, waiting]);

  // Caught up: full bar, hold, collapse, gone. A real backlog later brings it back.
  useEffect(() => {
    if (visibility === "shown" && waiting === 0 && total > 0) setVisibility("caught-up");
    if (visibility === "caught-up" && waiting > 0) setVisibility("shown");
    if (visibility === "gone" && waiting >= REAPPEAR_AT) { setTracker(null); spoken.current = null; setVisibility("shown"); }
  }, [visibility, waiting, total]);
  useEffect(() => {
    if (visibility !== "caught-up" && visibility !== "collapsing") return;
    const t = setTimeout(() => setVisibility(visibility === "caught-up" ? "collapsing" : "gone"), visibility === "caught-up" ? HOLD_MS : COLLAPSE_MS);
    return () => clearTimeout(t);
  }, [visibility]);

  // The server render has no samples, so it shows the plain decoding (or first-run) state.
  const now = tracker ? tracker.samples.at(-1)!.at : 0;
  const phase: Phase = tracker ? phaseOf(tracker, now, total, sync) : sync === "offline" ? "offline" : waiting >= total ? "first-run" : "decoding";
  const isDone = visibility === "caught-up" || visibility === "collapsing";
  const percent = isDone ? "100%" : formatPercent(decoded, total);
  const pace = tracker && !isDone ? paceText(phase, tracker) : null;
  const { rate, eta } = tracker && !isDone ? paceParts(phase, tracker) : { rate: null, eta: null };

  useEffect(() => {
    if (visibility === "gone" || (!tracker && !isDone)) return;
    const cur: Spoken = { phase: isDone ? "caught-up" : phase, quarter: quarter(isDone ? 100 : (decoded / Math.max(1, total)) * 100), at: Date.now() };
    const text = announcement(spoken.current, cur, percent);
    if (text) { spoken.current = cur; onAnnounce(text); }
  }, [visibility, tracker, isDone, phase, decoded, total, percent, onAnnounce]);

  if (visibility === "gone" || total === 0) return null;

  const isPaused = phase === "offline" || phase === "stale";
  const isFirstRun = phase === "first-run" && !isDone;
  const ratio = isDone ? 1 : decoded / total;
  // Last known numbers: the last answer when unreachable, the last index sync when the indexer stopped.
  const asOfMs = phase === "stale" && live.syncedAt ? Date.parse(live.syncedAt) : live.lastOkAt;
  const asOf = asOfMs === null ? "" : new Date(asOfMs).toTimeString().slice(0, 5);
  const stalledMin = tracker ? Math.max(2, Math.floor((now - tracker.changedAt) / 60_000)) : 2;

  const status: ReactNode = isDone ? "All live records decoded"
    : phase === "first-run" ? "Starting to decode · datasets will appear here"
    : phase === "stalled" ? `Decoding paused · no progress for ${stalledMin} min`
    : phase === "offline" ? <>Paused while the index is unreachable · as of {asOf} · <button type="button" onClick={live.retry} className="text-accent underline-offset-2 hover:underline">Retry</button></>
    : phase === "stale" ? `Paused while the indexer isn't running · as of ${asOf}`
    : <><RollingNumber value={waiting} /> waiting{pace && ` · ${pace}`}</>;
  const tip = phase === "stalled" ? "The indexer is running but not decoding. Check the indexer logs."
    : phase === "stale" ? "The indexer isn't running. Start pnpm index --watch to keep decoding."
    : `${formatCount(waiting)} of ${formatCount(total)} live records are still being decoded, so their datasets are not listed yet. They appear as the indexer catches up. From ArkivAgent index, block ${formatCount(Number(live.indexedBlock))}.`;
  const valueText = isFirstRun ? `Starting to decode ${formatCount(total)} records`
    : `${formatCount(decoded)} of ${formatCount(total)} records decoded, ${percent}${eta ? `, ${eta.replace(" min ", " minutes ").replace(" h ", " hours ")}` : ""}`;
  const tone = isDone ? "done" : phase === "stalled" ? "stalled" : isPaused ? "paused" : "active";

  return (
    <div className={`decode-collapse grid ${visibility === "collapsing" ? "is-collapsed" : ""}`}>
      {/* Clipped only while collapsing, so the info tooltip can overhang the panel. */}
      <section aria-labelledby={labelId} data-phase={isDone ? "caught-up" : phase} className={`min-h-0 ${visibility === "collapsing" ? "overflow-hidden" : ""}`}>
        <div className="rounded-md border border-border-default bg-surface px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <Glyph tone={tone} phase={phase} />
            <span id={labelId} className={`label ${isDone ? "text-live" : "text-text-secondary"}`}>
              {isDone ? "All records decoded" : <><span className="sm:hidden">Decoding</span><span className="hidden sm:inline">Decoding records</span></>}
            </span>
            {/* First run shows "0 / 37,288" without a percent; phones show only the percent. */}
            <span className="ml-auto whitespace-nowrap leading-4 tabular-nums">
              <span className="hidden font-mono text-[13px] text-text-primary sm:inline">
                <RollingNumber value={isDone ? total : decoded} /> / <RollingNumber value={total} />{isFirstRun ? "" : " · "}
              </span>
              <span className={`font-semibold text-text-primary ${isFirstRun ? "sm:hidden" : ""}`}>{isFirstRun ? "0%" : percent}</span>
            </span>
          </div>

          <div role="progressbar" aria-labelledby={labelId} aria-valuemin={0} aria-valuemax={total} aria-valuenow={isFirstRun ? undefined : decoded} aria-valuetext={valueText}
            className="relative mt-1.5 h-1.5 rounded-full bg-raised ring-1 ring-border-subtle ring-inset">
            <div className="absolute inset-0 overflow-hidden rounded-full">
              {isFirstRun ? (
                <div className="decode-indeterminate absolute inset-y-0 left-0 w-1/4 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
              ) : (
                <>
                  <div className={`decode-move absolute inset-0 origin-left rounded-full decode-fill-${tone}`} style={{ transform: `scaleX(${ratio})` }} />
                  {tone === "active" && (
                    <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${ratio * 100}%` }}>
                      <div className="decode-sheen absolute inset-0" />
                    </div>
                  )}
                </>
              )}
              {[25, 50, 75].map((p) => <span key={p} className="absolute top-1/2 h-0.5 w-px -translate-y-1/2 bg-border-subtle" style={{ left: `${p}%` }} />)}
            </div>
            {!isFirstRun && !isPaused && (
              <div className="decode-move pointer-events-none absolute inset-0" style={{ transform: `translateX(${(ratio - 1) * 100}%)` }}>
                <span className={`absolute -right-px -top-[3px] h-3 w-0.5 rounded-full ${tone === "stalled" ? "bg-warn" : "decode-breathe bg-focus shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]"}`}>
                  {isDone && <span className="decode-flash absolute inset-0 rounded-full bg-live" />}
                </span>
              </div>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-3 caption text-text-tertiary">
            {isDone || isPaused || phase === "stalled" || isFirstRun ? <span className="min-w-0">{status}</span> : (
              <>
                <span className="hidden min-w-0 tabular-nums sm:inline">{status}</span>
                <span className="min-w-0 tabular-nums sm:hidden">
                  {formatCount(decoded)} / {formatCount(total)}{eta ? ` · ${eta.replace("about ", "~")}` : rate ? ` · ${rate}` : phase === "keeping-pace" ? " · keeping pace" : ""}
                </span>
              </>
            )}
            {!isDone && (
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <span className="hidden sm:inline">Their datasets appear as they&apos;re decoded.</span>
                <InfoTip label="About decoding">{tip}</InfoTip>
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Glyph({ tone, phase }: { tone: string; phase: Phase }) {
  if (tone === "done") return <Check size={14} className="text-live" aria-hidden />;
  if (tone === "stalled") return <Pause size={14} className="text-warn" aria-hidden />;
  if (tone === "paused") return <span className={`size-2 rounded-full ${phase === "offline" ? "bg-danger" : "bg-warn"}`} aria-hidden />;
  return <span className="decode-spin size-3 rounded-full border-2 border-accent border-t-accent/25" aria-hidden />;
}

/** (i) with a short explanation. Opens on hover, focus or tap; Esc closes. A 44 px tap target on phones. */
function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [isOpen]);
  return (
    <span ref={box} className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={isOpen} aria-controls={id}
        onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
        className="-m-3 inline-flex size-11 items-center justify-center rounded-full text-text-tertiary hover:text-text-primary focus-visible:text-text-primary sm:m-0 sm:size-4">
        <Info size={14} aria-hidden />
      </button>
      {isOpen && (
        <span id={id} role="tooltip" className="absolute right-0 top-full z-30 mt-2 w-[min(320px,calc(100vw-32px))] rounded-md border border-border-default bg-overlay p-3 text-[13px] leading-5 text-text-secondary shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          {children}
        </span>
      )}
    </span>
  );
}
