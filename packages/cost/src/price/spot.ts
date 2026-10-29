// Mainnet GLM price in USD, for showing testnet fees in dollars. Server-side only; cached so pages
// never wait on it. GLM_PRICE=off turns it off.
import { type Fetch, type PriceSource, SPOT_SOURCES } from "./sources.ts";

/** `source` names where it came from: a spot price API, or the chart history's newest close. */
export type GlmPrice = { usd: number; source: string; at: string };

const TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 3_000;

/** First source that answers with a positive number, or null when none do. */
export async function fetchGlmPrice(fetcher: Fetch = fetch as unknown as Fetch, now = () => new Date(), sources: readonly PriceSource[] = SPOT_SOURCES): Promise<GlmPrice | null> {
  for (const s of sources) {
    try {
      const usd = await s.spot(fetcher, AbortSignal.timeout(TIMEOUT_MS));
      if (usd !== null && Number.isFinite(usd) && usd > 0) return { usd, source: s.name, at: now().toISOString() };
    } catch {
      // try the next source
    }
  }
  return null;
}

const RETRY_MS = 60_000;
/** A price older than this is no longer shown while a newer one is fetched. */
const MAX_AGE_MS = 60 * 60_000;

/** `loading`: no price yet, a lookup is running. `off`: GLM_PRICE=off. */
export type PriceState = { price: GlmPrice | null; status: "ok" | "loading" | "failed" | "off" };

/**
 * A price cache that never makes a page wait (T21 M3). Each read returns what's cached and, when that
 * is missing or over 10 minutes old, starts one lookup in the background for later reads. A stale
 * price is still shown for up to an hour; a failed lookup is retried after a minute.
 */
export function priceCache(fetcher: Fetch = fetch as unknown as Fetch, now = () => Date.now(), isOff = () => process.env.GLM_PRICE === "off") {
  let last: { price: GlmPrice; fetchedAt: number } | null = null;
  let nextLookup = 0;
  let lookup: Promise<void> | null = null;
  let hasFailed = false;
  return {
    read(): PriceState {
      if (isOff()) return { price: null, status: "off" };
      if (!lookup && now() >= nextLookup) {
        lookup = fetchGlmPrice(fetcher, () => new Date(now())).then((price) => {
          if (price) last = { price, fetchedAt: now() };
          hasFailed = !price;
          nextLookup = now() + (price ? TTL_MS : RETRY_MS);
          lookup = null;
        });
      }
      const price = last && now() - last.fetchedAt < MAX_AGE_MS ? last.price : null;
      return { price, status: price ? "ok" : hasFailed && !lookup ? "failed" : "loading" };
    },
    /** Settles when the running lookup does (tests). */
    settled: () => lookup ?? Promise.resolve(),
  };
}

let shared: ReturnType<typeof priceCache> | null = null;
/** The mainnet GLM price as cached now; never waits for the price APIs. */
export const glmPrice = () => (shared ??= priceCache()).read();
