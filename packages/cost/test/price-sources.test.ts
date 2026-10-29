import { describe, expect, it } from "vitest";
import { fetchCandles } from "../src/price/history.ts";
import { binance, coinGecko, type PriceSource } from "../src/price/sources.ts";
import { fetchGlmPrice } from "../src/price/spot.ts";

const reply = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });
const signal = new AbortController().signal;
const at = () => new Date("2026-10-29T10:00:00Z");

describe("PriceSource: CoinGecko and Binance", () => {
  it("read their own spot replies, and say no on a non-OK status", async () => {
    expect(await coinGecko.spot(() => reply({ golem: { usd: 0.11 } }), signal)).toBe(0.11);
    expect(await binance.spot(() => reply({ price: "0.12" }), signal)).toBe(0.12);
    expect(await binance.spot(() => reply({ price: "0.12" }, false), signal)).toBeNull();
  });

  it("ask for the candles a range needs", async () => {
    const urls: string[] = [];
    const log = (body: unknown) => (url: string) => { urls.push(url); return reply(body); };
    expect(await binance.candles("1d", 2, log([[0, "0", "0", "0", "0.1"]]), signal)).toEqual([{ t: 0, close: 0.1 }]);
    expect(await coinGecko.candles("4h", 42, log({ prices: [] }), signal)).toEqual([]);
    expect(urls).toEqual([
      "https://api.binance.com/api/v3/klines?symbol=GLMUSDT&interval=1d&limit=2",
      "https://api.coingecko.com/api/v3/coins/golem/market_chart?vs_currency=usd&days=7",
    ]);
  });
});

describe("any PriceSource can stand in", () => {
  const fixed = (name: string, usd: number | null): PriceSource => ({ name, spot: async () => usd, candles: async () => (usd ? [{ t: 0, close: usd }] : null) });
  const failing: PriceSource = { name: "down", spot: () => Promise.reject(new Error("down")), candles: () => Promise.reject(new Error("down")) };

  it("the first source with an answer wins, in the order given", async () => {
    expect(await fetchGlmPrice(undefined, at, [failing, fixed("A", null), fixed("B", 0.2)])).toEqual({ usd: 0.2, source: "B", at: "2026-10-29T10:00:00.000Z" });
    expect(await fetchCandles("1d", 30, undefined, [failing, fixed("A", null), fixed("B", 0.2)])).toEqual({ candles: [{ t: 0, close: 0.2 }], source: "B" });
    expect(await fetchGlmPrice(undefined, at, [fixed("A", 0)])).toBeNull();
  });
});
