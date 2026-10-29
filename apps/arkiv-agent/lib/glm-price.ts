/** Mainnet GLM price in USD, for showing testnet fees in dollars. Server-side only; cached so pages never wait on it. GLM_PRICE=off turns it off. */
/** `source` names where it came from: a spot price API, or the chart history's newest close. */
export type GlmPrice = { usd: number; source: string; at: string };

type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 3_000;

const SOURCES: { source: string; url: string; read: (body: any) => number }[] = [
  { source: "CoinGecko", url: "https://api.coingecko.com/api/v3/simple/price?ids=golem&vs_currencies=usd", read: (b) => Number(b?.golem?.usd) },
  { source: "Binance GLM/USDT", url: "https://api.binance.com/api/v3/ticker/price?symbol=GLMUSDT", read: (b) => Number(b?.price) },
];

/** First source that answers with a positive number, or null when none do. */
export async function fetchGlmPrice(fetcher: Fetch = fetch as unknown as Fetch, now = () => new Date()): Promise<GlmPrice | null> {
  for (const s of SOURCES) {
    try {
      const res = await fetcher(s.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      const usd = s.read(await res.json());
      if (Number.isFinite(usd) && usd > 0) return { usd, source: s.source, at: now().toISOString() };
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

const shared = priceCache();
/** The mainnet GLM price as cached now; never waits for the price APIs. */
export const glmPrice = () => shared.read();

/** USD amounts: cents for normal values, up to 3 significant digits below a cent. */
export const usd = (x: number) =>
  x === 0 ? "$0" : x >= 0.01 ? `$${x.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${x.toLocaleString("en", { maximumSignificantDigits: 3 })}`;
