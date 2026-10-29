// GLM/USD price history for the chart on /financials (T27). Server-side only. Candles come from the
// price APIs, not from collecting prices over time, so a fresh start shows the full range at once.
// They are kept in a small SQLite file next to the index, so restarts and offline periods still have
// history, and afterwards only the latest candle is refreshed. GLM_PRICE=off turns it off.

import { type Candle, type CandleStore, type Interval, openCandleStore } from "@arkiv-agent/db";
import type { GlmPrice } from "./glm-price";

export type { Candle, Interval };
export type RangeDays = 7 | 30 | 90;
export type History = { days: RangeDays; interval: Interval; candles: Candle[]; source: string; at: string };

/** 7 d in 4 h candles, 30 and 90 d in daily ones. */
export const RANGES: Record<RangeDays, { interval: Interval; count: number }> = { 7: { interval: "4h", count: 42 }, 30: { interval: "1d", count: 30 }, 90: { interval: "1d", count: 90 } };
const INTERVAL_MS: Record<Interval, number> = { "4h": 4 * 3_600_000, "1d": 86_400_000 };
/** The latest candle is refreshed at most this often; older candles never change. */
const LATEST_TTL_MS = 10 * 60_000;
const RETRY_MS = 60_000;
const TIMEOUT_MS = 3_000;

type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Same shape as the spot price sources in glm-price.ts: a name, a URL, and a reader for the reply. */
type HistorySource = { source: string; url: (interval: Interval, count: number) => string; read: (body: unknown, interval: Interval) => Candle[] };

/** Binance klines: [openTime, open, high, low, close, …]. */
export function readKlines(body: unknown): Candle[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((k) => {
    const t = Number(Array.isArray(k) ? k[0] : NaN), close = Number(Array.isArray(k) ? k[4] : NaN);
    return Number.isFinite(t) && Number.isFinite(close) && close > 0 ? [{ t, close }] : [];
  });
}

/** CoinGecko market_chart: hourly [ms, price] points up to 90 days, resampled to the last price per interval. */
export function readMarketChart(body: unknown, interval: Interval): Candle[] {
  const prices = (body as { prices?: unknown })?.prices;
  if (!Array.isArray(prices)) return [];
  const step = INTERVAL_MS[interval];
  const last = new Map<number, { ms: number; close: number }>();
  for (const p of prices) {
    const ms = Number(Array.isArray(p) ? p[0] : NaN), close = Number(Array.isArray(p) ? p[1] : NaN);
    if (!Number.isFinite(ms) || !Number.isFinite(close) || close <= 0) continue;
    const t = Math.floor(ms / step) * step;
    if (ms >= (last.get(t)?.ms ?? -Infinity)) last.set(t, { ms, close });
  }
  return [...last].map(([t, { close }]) => ({ t, close })).sort((a, b) => a.t - b.t);
}

const SOURCES: HistorySource[] = [
  { source: "Binance GLM/USDT", url: (interval, count) => `https://api.binance.com/api/v3/klines?symbol=GLMUSDT&interval=${interval}&limit=${count}`, read: (b) => readKlines(b) },
  {
    source: "CoinGecko",
    url: (interval, count) => `https://api.coingecko.com/api/v3/coins/golem/market_chart?vs_currency=usd&days=${Math.min(90, Math.ceil((count * INTERVAL_MS[interval]) / 86_400_000))}`,
    read: (b, interval) => readMarketChart(b, interval),
  },
];

/** The last `count` candles from the first source that answers with any, or null. */
export async function fetchCandles(interval: Interval, count: number, fetcher: Fetch = fetch as unknown as Fetch): Promise<{ candles: Candle[]; source: string } | null> {
  for (const s of SOURCES) {
    try {
      const res = await fetcher(s.url(interval, count), { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      const candles = s.read(await res.json(), interval).slice(-count);
      if (candles.length) return { candles, source: s.source };
    } catch {
      // try the next source
    }
  }
  return null;
}

/**
 * History per range. A range the store doesn't fully cover is fetched whole, and the request waits for
 * it; one it covers is served at once while its latest candle is refreshed for later requests, at most
 * every 10 minutes. A failed fetch serves what's stored and is retried after a minute. Concurrent
 * requests share one fetch per interval.
 */
export function historyCache(store: CandleStore = openCandleStore(), fetcher: Fetch = fetch as unknown as Fetch, now = () => Date.now(), isOff = () => process.env.GLM_PRICE === "off") {
  type State = { source: string; refreshedAt: number; retryAt: number; pending: Promise<void> | null; fetched: Candle[] };
  const state = new Map<Interval, State>();
  return async (days: RangeDays): Promise<History | null> => {
    if (isOff()) return null;
    const { interval, count } = RANGES[days];
    const step = INTERVAL_MS[interval];
    const since = Math.floor(now() / step) * step - (count - 1) * step;
    const s = state.get(interval) ?? state.set(interval, { source: "", refreshedAt: 0, retryAt: 0, pending: null, fetched: [] }).get(interval)!;
    // The store, or what this process fetched when the file can't be read or written.
    const stored = () => {
      const fetched = s.fetched.filter((c) => c.t >= since);
      try {
        const saved = store.read(interval, since);
        return saved.length >= fetched.length ? saved : fetched;
      } catch {
        return fetched;
      }
    };
    const isCovered = (c: Candle[]) => c.length >= count - 1 && c[0]!.t <= since + step;
    if (!s.pending && now() >= s.retryAt && (!isCovered(stored()) || now() - s.refreshedAt >= LATEST_TTL_MS)) {
      // A whole range when it isn't covered (daily: 90 candles, enough for both the 30 and 90 d views), else the latest two.
      const fetchCount = isCovered(stored()) ? 2 : interval === "1d" ? RANGES[90].count : count;
      s.pending = fetchCandles(interval, fetchCount, fetcher).then((got) => {
        if (got) {
          const merged = new Map([...s.fetched, ...got.candles].map((c) => [c.t, c]));
          s.fetched = [...merged.values()].sort((a, b) => a.t - b.t);
          try { store.write(interval, got.candles, { source: got.source, at: now() }); } catch { /* stored() falls back to s.fetched */ }
          Object.assign(s, { source: got.source, refreshedAt: now(), retryAt: 0 });
        } else s.retryAt = now() + RETRY_MS;
      }).finally(() => { s.pending = null; });
    }
    if (s.pending && !isCovered(stored())) await s.pending;
    const candles = stored();
    if (!candles.length) return null;
    return { days, interval, candles, source: s.source || "saved history", at: new Date(s.refreshedAt || now()).toISOString() };
  };
}

let sharedStore: CandleStore | null = null;
let shared: ReturnType<typeof historyCache> | null = null;
const store = () => (sharedStore ??= openCandleStore());
/** The process-wide history cache, created on first use. */
export const glmHistory = (days: RangeDays) => (shared ??= historyCache(store()))(days);

/** The newest stored close as a price, labelled with its source and fetch time. Never fetches. */
export function latestHistoryPrice(from: () => CandleStore = store, isOff = () => process.env.GLM_PRICE === "off"): GlmPrice | null {
  if (isOff()) return null;
  try {
    const l = from().latest();
    return l ? { usd: l.close, source: `${l.source}, latest ${l.interval === "4h" ? "4-hour" : "daily"} close`, at: new Date(l.at).toISOString() } : null;
  } catch {
    return null;
  }
}
