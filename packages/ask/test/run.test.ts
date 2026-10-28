import { eq } from "@arkiv-network/sdk/query";
import type { ArkivClient } from "@arkiv-agent/core";
import { describe, expect, it } from "vitest";
import { runAsk } from "../src/run.ts";

/** A client whose query never answers until its signal aborts it. */
function hangingClient(signal: AbortSignal) {
  const never = () => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  const builder = { where: () => builder, atBlock: () => builder, limit: () => builder, cursor: () => builder, fetch: never };
  return { getBlockNumber: async () => 1n, select: () => builder } as unknown as ArkivClient;
}

describe("runAsk", () => {
  it("aborts the chain read when it times out", async () => {
    let seen: AbortSignal | undefined;
    const r = await runAsk((signal) => { seen = signal; return hangingClient(signal); }, eq("a", "b"), { timeoutMs: 20 });
    expect(r).toMatchObject({ ok: false, error: { kind: "timeout" } });
    expect(seen?.aborted).toBe(true);
  });
});
