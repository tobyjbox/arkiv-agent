import { describe, expect, it, vi } from "vitest";
import { financialsPrice } from "./financials-price";
import { openCandleStore } from "@arkiv-agent/db";
import { fetchCandles, historyCache, latestHistoryPrice, readKlines, readMarketChart } from "./glm-history";

const DAY = 86_400_000;
const reply = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });
/** Binance-style klines for `n` days ending with the day containing `now`. */
const klines = (now: number, n: number, price = (i: number) => 0.1 + i / 1000) =>
  Array.from({ length: n }, (_, i) => { const t = Math.floor(now / DAY) * DAY - (n - 1 - i) * DAY; return [t, "0", "0", "0", String(price(i)), "0", t + DAY - 1]; });

describe("parsing (T27)", () => {
  it("reads Binance klines' close and skips junk", () => {
    expect(readKlines([[1_000, "0.1", "0.2", "0.05", "0.11", "9"], ["x"], [2_000, "0", "0", "0", "0"]])).toEqual([{ t: 1_000, close: 0.11 }]);
    expect(readKlines({ code: -1 })).toEqual([]);
  });

  it("resamples CoinGecko's hourly points to the last price per day or per 4 h", () => {
    const h = 3_600_000;
    const body = { prices: [[0, 0.1], [5 * h, 0.12], [23 * h, 0.13], [DAY + h, 0.2], [DAY + 2 * h, -1]] };
    expect(readMarketChart(body, "1d")).toEqual([{ t: 0, close: 0.13 }, { t: DAY, close: 0.2 }]);
    expect(readMarketChart(body, "4h").map((c) => c.close)).toEqual([0.1, 0.12, 0.13, 0.2]);
    expect(readMarketChart({}, "1d")).toEqual([]);
  });
});

describe("fetchCandles", () => {
  it("uses Binance, falls back to CoinGecko, and gives up when both fail", async () => {
    const now = 100 * DAY;
    const binance = await fetchCandles("1d", 30, (url) => (url.includes("binance") ? reply(klines(now, 30)) : reply({})));
    expect(binance?.source).toBe("Binance GLM/USDT");
    expect(binance?.candles).toHaveLength(30);
    const gecko = await fetchCandles("1d", 30, (url) => (url.includes("binance") ? Promise.reject(new Error("down")) : reply({ prices: [[now, 0.11]] })));
    expect(gecko).toEqual({ source: "CoinGecko", candles: [{ t: now, close: 0.11 }] });
    expect(await fetchCandles("1d", 30, () => reply({}, false))).toBeNull();
  });
});

describe("historyCache", () => {
  it("fetches a whole range on a fresh start, then only the latest candle, and keeps it across restarts", async () => {
    let t = 100 * DAY + 3_600_000;
    const urls: string[] = [];
    const fetcher = (url: string) => { urls.push(url); return url.includes("binance") ? reply(klines(t, Number(/limit=(\d+)/.exec(url)![1]))) : reply({}); };
    const store = openCandleStore(":memory:");
    const history = historyCache(store, fetcher, () => t, () => false);

    const month = await history(30);
    expect(month?.candles).toHaveLength(30);
    expect(urls).toEqual([expect.stringContaining("interval=1d&limit=90")]);
    expect((await history(90))?.candles).toHaveLength(90); // the 90 daily candles are already there
    expect(urls).toHaveLength(1);

    t += 11 * 60_000;
    await history(30);
    expect(urls.at(-1)).toContain("limit=2");

    const restarted = historyCache(store, fetcher, () => t, () => false);
    await restarted(90);
    expect(urls.at(-1)).toContain("limit=2");
  });

  it("serves stored candles when both sources fail, retries after a minute, and does nothing when off", async () => {
    let t = 100 * DAY;
    const store = openCandleStore(":memory:");
    store.write("1d", klines(t, 30).map((k) => ({ t: k[0] as number, close: Number(k[4]) })), { source: "Binance GLM/USDT", at: t });
    let calls = 0;
    const history = historyCache(store, () => { calls++; return reply({}, false); }, () => t, () => false);
    expect((await history(30))?.candles).toHaveLength(30); // served at once; the refresh runs behind it
    await vi.waitFor(() => expect(calls).toBe(2)); // Binance, then CoinGecko
    await new Promise((r) => setTimeout(r, 0)); // let that failed refresh finish
    await history(30);
    expect(calls).toBe(2);
    t += 61_000;
    await history(30);
    await vi.waitFor(() => expect(calls).toBe(4));
    expect(await historyCache(store, () => reply({}), () => t, () => true)(30)).toBeNull();
  });
});

describe("the Financials price seed (T29)", () => {
  const H = 3_600_000;
  it("remembers which source answered and when, and reads back the newest close", () => {
    const store = openCandleStore(":memory:");
    expect(store.latest()).toBeNull();
    store.write("1d", [{ t: 0, close: 0.1 }, { t: DAY, close: 0.11 }], { source: "Binance GLM/USDT", at: DAY + H });
    store.write("4h", [{ t: DAY + 4 * H, close: 0.112 }], { source: "CoinGecko", at: DAY + 5 * H });
    expect(store.latest()).toEqual({ close: 0.112, interval: "4h", source: "CoinGecko", at: DAY + 5 * H });
    expect(latestHistoryPrice(() => store, () => false)).toEqual({ usd: 0.112, source: "CoinGecko, latest 4-hour close", at: new Date(DAY + 5 * H).toISOString() });
    expect(latestHistoryPrice(() => store, () => true)).toBeNull();
  });

  it("uses the live price when cached, else the newest close while the lookup runs, and nothing when off", () => {
    const live = { usd: 0.107, source: "CoinGecko", at: "2026-10-29T12:00:00.000Z" };
    const close = { usd: 0.108, source: "Binance GLM/USDT, latest daily close", at: "2026-10-29T11:55:00.000Z" };
    expect(financialsPrice(() => ({ price: live, status: "ok" }), () => close)).toEqual({ price: live, status: "ok" });
    expect(financialsPrice(() => ({ price: null, status: "loading" }), () => close)).toEqual({ price: close, status: "loading" });
    expect(financialsPrice(() => ({ price: null, status: "failed" }), () => null)).toEqual({ price: null, status: "failed" });
    expect(financialsPrice(() => ({ price: null, status: "off" }), () => close)).toEqual({ price: null, status: "off" });
  });
});
