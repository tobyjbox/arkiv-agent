/** Mainnet GLM price in USD, for showing testnet fees in dollars. Server-side only; cached so pages never wait on it. */
export type GlmPrice = { usd: number; source: "CoinGecko" | "Binance GLM/USDT"; at: string };

type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 3_000;

const SOURCES: { source: GlmPrice["source"]; url: string; read: (body: any) => number }[] = [
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

let cached: { price: GlmPrice | null; until: number } | null = null;

/** Cached price; a failed lookup is cached for a minute so a dead API doesn't slow every request. */
export async function glmPrice(): Promise<GlmPrice | null> {
  if (cached && Date.now() < cached.until) return cached.price;
  const price = await fetchGlmPrice();
  cached = { price, until: Date.now() + (price ? TTL_MS : 60_000) };
  return price;
}

/** USD amounts: cents for normal values, up to 3 significant digits below a cent. */
export const usd = (x: number) =>
  x === 0 ? "$0" : x >= 0.01 ? `$${x.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${x.toLocaleString("en", { maximumSignificantDigits: 3 })}`;
