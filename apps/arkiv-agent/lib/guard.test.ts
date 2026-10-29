import { describe, expect, it } from "vitest";
import { createRateLimit, isAllowedHost, isCrossSiteEmbed, refuseCrossSite } from "./guard";

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

describe("isCrossSiteEmbed", () => {
  const h = (headers: Record<string, string>) => new Headers({ host: "localhost:3101", ...headers });
  const html = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  it("follows Fetch Metadata when the browser sends it", () => {
    expect(isCrossSiteEmbed(h({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "no-cors", "sec-fetch-dest": "image", referer: "https://evil.example/" }))).toBe(true);
    expect(isCrossSiteEmbed(h({ "sec-fetch-site": "same-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" }))).toBe(true);
    expect(isCrossSiteEmbed(h({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", accept: html }))).toBe(false);
    expect(isCrossSiteEmbed(h({ "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", referer: "http://localhost:3101/pulse" }))).toBe(false);
  });
  it("without Fetch Metadata, refuses non-HTML loads from another origin or referrer (T22 L2)", () => {
    expect(isCrossSiteEmbed(h({ referer: "https://evil.example/page", accept: "image/webp,*/*" }))).toBe(true);
    expect(isCrossSiteEmbed(h({ origin: "https://evil.example", accept: "*/*" }))).toBe(true);
    expect(isCrossSiteEmbed(h({ origin: "null", accept: "*/*" }))).toBe(true);
    expect(isCrossSiteEmbed(h({ referer: "http://127.0.0.1:3101/", accept: "*/*" }))).toBe(true);
  });
  it("without Fetch Metadata, lets links, same-origin requests and direct visits through", () => {
    expect(isCrossSiteEmbed(h({ referer: "https://news.example/post", accept: html }))).toBe(false);
    expect(isCrossSiteEmbed(h({ referer: "http://localhost:3101/catalogue", accept: "*/*" }))).toBe(false);
    expect(isCrossSiteEmbed(h({ accept: "*/*" }))).toBe(false);
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

describe("middleware: heavy pages (T19 L1)", async () => {
  const { middleware } = await import("../middleware");
  const { NextRequest } = await import("next/server");
  const req = (path: string, h: Record<string, string>) => new NextRequest(`http://localhost:3101${path}`, { headers: { host: "localhost:3101", ...h } });
  it("refuses cross-site embeds and fetches of /pulse and /cost, allows following a link", () => {
    expect(middleware(req("/pulse", { "sec-fetch-site": "cross-site", "sec-fetch-mode": "no-cors", "sec-fetch-dest": "image" })).status).toBe(403);
    expect(middleware(req("/cost", { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "iframe" })).status).toBe(403);
    expect(middleware(req("/cost", { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" })).status).toBe(200);
    expect(middleware(req("/pulse", { "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" })).status).toBe(200);
    expect(middleware(req("/pulse", { referer: "https://evil.example/", accept: "image/*" })).status).toBe(403);
    expect(middleware(req("/cost", { referer: "https://news.example/", accept: "text/html" })).status).toBe(200);
  });
  it("forbids framing any page", () => {
    expect(middleware(req("/catalogue", {})).headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
  });
});
