import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { json } from "./json.ts";

const request = (encoding?: string) => new Request("http://localhost/api/x", encoding ? { headers: { "Accept-Encoding": encoding } } : {});
const big = { rows: Array.from({ length: 500 }, (_, i) => ({ id: i, name: "dataset" })) };

describe("json", () => {
  it("gzips a large body for a caller that accepts gzip", async () => {
    const r = json(request("gzip, deflate, br"), big, { headers: { "Cache-Control": "no-store" } });
    expect(r.headers.get("Content-Encoding")).toBe("gzip");
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    const bytes = Buffer.from(await r.arrayBuffer());
    expect(bytes.length).toBeLessThan(JSON.stringify(big).length / 4);
    expect(JSON.parse(gunzipSync(bytes).toString())).toEqual(big);
  });
  it("sends plain JSON to a caller that doesn't, and for small bodies", async () => {
    expect(json(request(), big).headers.get("Content-Encoding")).toBeNull();
    const small = json(request("gzip"), { error: "not found" }, { status: 404 });
    expect(small.headers.get("Content-Encoding")).toBeNull();
    expect(small.status).toBe(404);
    expect(await small.json()).toEqual({ error: "not found" });
  });
});
