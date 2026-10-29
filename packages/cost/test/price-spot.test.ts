import { describe, expect, it } from "vitest";
import { fetchGlmPrice, priceCache } from "../src/price/spot.ts";

const reply = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });
const at = () => new Date("2026-10-29T10:00:00Z");

describe("fetchGlmPrice", () => {
  it("uses CoinGecko when it answers", async () => {
    const p = await fetchGlmPrice((url) => (url.includes("coingecko") ? reply({ golem: { usd: 0.107 } }) : reply({ price: "9" })), at);
    expect(p).toEqual({ usd: 0.107, source: "CoinGecko", at: "2026-10-29T10:00:00.000Z" });
  });
  it("falls back to Binance when CoinGecko fails", async () => {
    const p = await fetchGlmPrice((url) => (url.includes("coingecko") ? Promise.reject(new Error("down")) : reply({ price: "0.1069" })), at);
    expect(p?.source).toBe("Binance GLM/USDT");
    expect(p?.usd).toBe(0.1069);
  });
  it("skips non-OK and nonsense answers, returning null when nothing is usable", async () => {
    expect(await fetchGlmPrice((url) => (url.includes("coingecko") ? reply({}, false) : reply({ price: "0" })), at)).toBeNull();
  });
});

describe("priceCache (T21 M3)", () => {
  const price = { golem: { usd: 0.107 } };
  it("never waits: the first read has no price and starts a lookup, later reads get it", async () => {
    let t = 0;
    let calls = 0;
    type Reply = { ok: boolean; json(): Promise<unknown> };
    let answer: (v: Reply) => void = () => {};
    const cache = priceCache(() => { calls++; return new Promise<Reply>((r) => { answer = r; }); }, () => t, () => false);
    expect(cache.read()).toEqual({ price: null, status: "loading" });
    expect(cache.read().status).toBe("loading");
    expect(calls).toBe(1);
    answer({ ok: true, json: () => Promise.resolve(price) });
    await cache.settled();
    expect(cache.read()).toMatchObject({ price: { usd: 0.107, source: "CoinGecko" }, status: "ok" });
    t = 11 * 60_000; // stale: still shown while one new lookup runs
    expect(cache.read().status).toBe("ok");
    expect(calls).toBe(2);
  });

  it("says when both sources failed, and retries after a minute", async () => {
    let t = 0;
    let calls = 0;
    const cache = priceCache(() => { calls++; return Promise.reject(new Error("down")); }, () => t, () => false);
    cache.read();
    await cache.settled();
    expect(cache.read()).toEqual({ price: null, status: "failed" });
    expect(calls).toBe(2); // CoinGecko, then Binance
    t = 61_000;
    expect(cache.read().status).toBe("loading");
    await cache.settled();
    expect(calls).toBe(4);
  });

  it("makes no requests when GLM_PRICE=off", () => {
    let calls = 0;
    const cache = priceCache(() => { calls++; return Promise.reject(new Error("x")); }, () => 0, () => true);
    expect(cache.read()).toEqual({ price: null, status: "off" });
    expect(calls).toBe(0);
  });
});
