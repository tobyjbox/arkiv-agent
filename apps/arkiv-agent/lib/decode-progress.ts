// Decode progress bar (design/07-decode-progress.md): its state, rate and ETA, derived on the client from
// the waiting count the change feed reports every 5 s. Pure functions, so the rules are unit-tested.

import type { SyncState } from "./sync-state";

/** The waiting (undecoded) count as one poll saw it. */
export type Sample = { at: number; waiting: number };

/** Samples, plus what has to be remembered between them. */
export type Tracker = {
  samples: Sample[];
  /** When the waiting count last changed (stall detection). */
  changedAt: number;
  /** Since when the rate has been positive without a break; the ETA waits 60 s for it. */
  positiveSince: number | null;
  /** Smoothed ETA in minutes, or null when not shown. */
  eta: number | null;
};

export type Phase = "first-run" | "decoding" | "keeping-pace" | "nearly-done" | "stalled" | "offline" | "stale";

/** Unchanged for this long while syncs succeed: stalled. */
export const STALL_MS = 120_000;
const RATE_WINDOW_MS = 30_000;
const RATE_MIN_SAMPLES = 3;
const PACE_WINDOW_MS = 60_000;
const ETA_AFTER_MS = 60_000;
/** Polls are 5 s apart; keep a little over the 60 s pace window. */
const KEEP_MS = 75_000;

/** Adds a poll's sample and updates the stall clock, the positive-rate clock and the smoothed ETA. */
export function track(t: Tracker | null, s: Sample): Tracker {
  if (!t) return { samples: [s], changedAt: s.at, positiveSince: null, eta: null };
  const last = t.samples.at(-1)!;
  if (s.at <= last.at) return t;
  const samples = [...t.samples.filter((x) => s.at - x.at <= KEEP_MS), s];
  const changedAt = s.waiting === last.waiting ? t.changedAt : s.at;
  const r = rate(samples);
  const positiveSince = r !== null && r > 0 ? (t.positiveSince ?? s.at) : null;
  const next = positiveSince !== null && s.at - positiveSince >= ETA_AFTER_MS ? s.waiting / r! : null;
  return { samples, changedAt, positiveSince, eta: next === null ? null : smoothEta(t.eta, next, s.waiting) };
}

/** Drop in the waiting count per minute over the last 60 s, once that spans 30 s and 3 samples. */
export function rate(samples: readonly Sample[]): number | null {
  const newest = samples.at(-1);
  if (!newest) return null;
  const window = samples.filter((x) => newest.at - x.at <= PACE_WINDOW_MS);
  const oldest = window[0]!;
  const span = newest.at - oldest.at;
  if (window.length < RATE_MIN_SAMPLES || span < RATE_WINDOW_MS) return null;
  return ((oldest.waiting - newest.waiting) / span) * 60_000;
}

/** Never moves more than 50% between samples, except straight down to finished. */
export function smoothEta(prev: number | null, next: number, waiting: number): number {
  if (prev === null || waiting === 0) return next;
  return Math.min(prev * 1.5, Math.max(prev * 0.5, next));
}

/** Waiting count not falling across a full 60 s: new writes arrive as fast as they decode. */
function isKeepingPace(samples: readonly Sample[]): boolean {
  const newest = samples.at(-1)!;
  const oldest = samples.find((x) => newest.at - x.at <= PACE_WINDOW_MS)!;
  return newest.at - oldest.at >= PACE_WINDOW_MS - 5_000 && newest.waiting >= oldest.waiting;
}

/**
 * The state table in design/07, most specific first. `sync` is the top bar's state: offline (the API
 * can't be reached) and stale (the indexer isn't running) pause the bar; delayed changes nothing.
 */
export function phase(t: Tracker, now: number, total: number, sync: SyncState): Phase {
  const waiting = t.samples.at(-1)!.waiting;
  if (sync === "offline") return "offline";
  if (sync === "stale") return "stale";
  if (now - t.changedAt >= STALL_MS) return "stalled";
  if (waiting >= total) return "first-run";
  if (isKeepingPace(t.samples)) return "keeping-pace";
  if (waiting < 50 || waiting / total < 0.005) return "nearly-done";
  return "decoding";
}

/** One decimal; never "100%" while anything is waiting. */
export function formatPercent(decoded: number, total: number): string {
  if (total <= 0) return "0%";
  if (decoded >= total) return "100%";
  return `${Math.min(99.9, Math.floor((decoded / total) * 1000) / 10).toFixed(1)}%`;
}

/** "~140 / min": two significant figures. */
export const formatRate = (perMin: number) => `~${Number(perMin.toPrecision(2)).toLocaleString("en")} / min`;

/** "under a minute", minutes up to 90, then hours. */
export function formatEta(minutes: number): string {
  if (minutes < 1) return "under a minute";
  if (minutes <= 90) return `about ${Math.round(minutes)} min left`;
  return `about ${Math.round(minutes / 60)} h left`;
}

/** Rate and ETA as row 3 shows them, each null until there's something honest to say. */
export function paceParts(p: Phase, t: Tracker): { rate: string | null; eta: string | null } {
  if (p === "keeping-pace") return { rate: null, eta: null };
  const r = rate(t.samples);
  const isFalling = r !== null && r > 0;
  return { rate: isFalling ? formatRate(r) : null, eta: p === "nearly-done" && isFalling ? "under a minute" : t.eta !== null ? formatEta(t.eta) : null };
}

/** Row 3's pace text, or null when there's nothing honest to say yet. */
export function paceText(p: Phase, t: Tracker): string | null {
  if (p === "keeping-pace") return "keeping pace with new writes";
  const { rate: r, eta } = paceParts(p, t);
  return [r, eta].filter(Boolean).join(" · ") || null;
}

/** The 25 / 50 / 75 / 100 boundary at or below `percent` (0 to 100). */
export const quarter = (percent: number) => Math.floor(percent / 25);

export type Spoken = { quarter: number; phase: Phase | "caught-up"; at: number };

/**
 * Live-region cadence (design/07): on first appearance, at each 25% boundary crossed, on Stalled, on
 * Offline and on Caught up. At most one per 30 s, except Caught up, which always speaks.
 */
export function announcement(prev: Spoken | null, cur: Spoken, percentText: string): string | null {
  if (cur.phase === "caught-up") return prev?.phase === "caught-up" ? null : "All records decoded.";
  if (prev && cur.at - prev.at < 30_000) return null;
  if (!prev) return `Decoding records: ${percentText} done.`;
  if (cur.phase === "stalled" && prev.phase !== "stalled") return "Decoding paused: no progress for 2 minutes.";
  if ((cur.phase === "offline" || cur.phase === "stale") && prev.phase !== cur.phase) return "Decoding paused: the index isn't updating.";
  if (cur.quarter > prev.quarter) return `Decoding records: ${percentText} done.`;
  return null;
}
