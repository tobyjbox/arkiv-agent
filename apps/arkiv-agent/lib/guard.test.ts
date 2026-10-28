import { describe, expect, it } from "vitest";
import { createRateLimit, isAllowedHost, refuseCrossSite } from "./guard";

const post = (headers: Record<string, string>) => new Request("http://localhost:3101/api/ask", { method: "POST", headers, body: '{"question":"x"}' });
const json = { "content-type": "application/json", host: "localhost:3101" };

describe("refuseCrossSite", () => {
  it("refuses a text/plain cross-origin POST (the CORS simple request a web page can send)", () => {
    const r = refuseCrossSite(post({ "content-type": "text/plain;charset=UTF-8", host: "localhost:3101", origin: "https://evil.example", "sec-fetch-site": "cross-site" }));
    expect(r?.status).toBe(415);
  });

  it("refuses JSON from another origin or site, and the opaque 'null' origin", () => {
    expect(refuseCrossSite(post({ ...json, origin: "https://evil.example" }))?.status).toBe(403);
    expect(refuseCrossSite(post({ ...json, origin: "http://localhost:3102" }))?.status).toBe(403);
    expect(refuseCrossSite(post({ ...json, "sec-fetch-site": "same-site" }))?.status).toBe(403);
    expect(refuseCrossSite(post({ ...json, origin: "null" }))?.status).toBe(403);
  });

  it("refuses a DNS-rebinding page, whose Origin matches its own Host", () => {
    expect(refuseCrossSite(post({ ...json, host: "evil.example:3101", origin: "http://evil.example:3101" }))?.status).toBe(421);
  });

  it("lets ArkivAgent's own page and local tools through", () => {
    expect(refuseCrossSite(post({ ...json, origin: "http://localhost:3101", "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(refuseCrossSite(post({ ...json, host: "127.0.0.1:3101", origin: "http://127.0.0.1:3101" }))).toBeNull();
    expect(refuseCrossSite(post(json))).toBeNull();
  });
});

describe("isAllowedHost", () => {
  it("allows local names and listed extras only", () => {
    expect(isAllowedHost("localhost:3101", "")).toBe(true);
    expect(isAllowedHost("[::1]:3101", "")).toBe(true);
    expect(isAllowedHost("192.168.2.187:3101", "")).toBe(false);
    expect(isAllowedHost("my-laptop.local:3101", "my-laptop.local, other")).toBe(true);
    expect(isAllowedHost(null, "")).toBe(false);
  });
});

describe("createRateLimit", () => {
  it("allows N calls per rolling minute", () => {
    let t = 0;
    const take = createRateLimit(2, () => t);
    expect([take(), take(), take()]).toEqual([true, true, false]);
    t = 60_000;
    expect(take()).toBe(true);
  });
});
