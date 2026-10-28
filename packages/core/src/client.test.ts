import { render } from "@arkiv-network/sdk/query";
import { describe, expect, it } from "vitest";
import { allLive } from "./client.ts";
import { attempt } from "./result.ts";

describe("allLive", () => {
  it("renders a predicate on the indexed expiry attribute", () => {
    expect(render(allLive(1_178_998n))).toBe("$expiresAt > u64(1178998)");
  });
});

describe("attempt", () => {
  it("folds a throw into an rpc error", async () => {
    const result = await attempt(() => Promise.reject(new Error("boom")));
    expect(result).toMatchObject({ ok: false, error: { kind: "rpc", message: "boom" } });
  });
});
