import { describe, expect, it } from "vitest";
import { fetchGlmPrice, usd } from "./glm-price";

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

describe("usd", () => {
  it("shows cents, and significant digits below a cent", () => {
    expect(usd(1234.5)).toBe("$1,234.50");
    expect(usd(0.000123456)).toBe("$0.000123");
    expect(usd(0)).toBe("$0");
  });
});
