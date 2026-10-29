// Where the mainnet GLM/USD price comes from. Each price API sits behind PriceSource, so the spot
// price and the chart history try the same sources the same way, and tests can stand in for them.
import type { Candle, Interval } from "@arkiv-agent/db";

export type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export interface PriceSource {
  /** Shown with the price: "CoinGecko", "Binance GLM/USDT". */
  readonly name: string;
  /** The spot price in USD, or null when the API says no. */
  spot(fetcher: Fetch, signal: AbortSignal): Promise<number | null>;
  /** Up to the last `count` candles of `interval`, oldest first, or null when the API says no. */
  candles(interval: Interval, count: number, fetcher: Fetch, signal: AbortSignal): Promise<Candle[] | null>;
}

export const INTERVAL_MS: Record<Interval, number> = { "4h": 4 * 3_600_000, "1d": 86_400_000 };

/** The reply's JSON, or null for a non-OK status. */
async function getJson(fetcher: Fetch, url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetcher(url, { signal });
  return res.ok ? res.json() : null;
}

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

export const coinGecko: PriceSource = {
  name: "CoinGecko",
  async spot(fetcher, signal) {
    const body = await getJson(fetcher, "https://api.coingecko.com/api/v3/simple/price?ids=golem&vs_currencies=usd", signal);
    return body === null ? null : Number((body as { golem?: { usd?: unknown } })?.golem?.usd);
  },
  async candles(interval, count, fetcher, signal) {
    const days = Math.min(90, Math.ceil((count * INTERVAL_MS[interval]) / 86_400_000));
    const body = await getJson(fetcher, `https://api.coingecko.com/api/v3/coins/golem/market_chart?vs_currency=usd&days=${days}`, signal);
    return body === null ? null : readMarketChart(body, interval);
  },
};

export const binance: PriceSource = {
  name: "Binance GLM/USDT",
  async spot(fetcher, signal) {
    const body = await getJson(fetcher, "https://api.binance.com/api/v3/ticker/price?symbol=GLMUSDT", signal);
    return body === null ? null : Number((body as { price?: unknown })?.price);
  },
  async candles(interval, count, fetcher, signal) {
    const body = await getJson(fetcher, `https://api.binance.com/api/v3/klines?symbol=GLMUSDT&interval=${interval}&limit=${count}`, signal);
    return body === null ? null : readKlines(body);
  },
};

/** Spot: CoinGecko first. History: Binance first (real 4-hour candles); CoinGecko's are resampled hourly points. */
export const SPOT_SOURCES: readonly PriceSource[] = [coinGecko, binance];
export const HISTORY_SOURCES: readonly PriceSource[] = [binance, coinGecko];
