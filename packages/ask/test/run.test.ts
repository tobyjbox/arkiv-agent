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

describe("runAsk when Arkiv rate-limits", () => {
  it("stops at the first 429 and says so, instead of waiting for the timeout", async () => {
    const started = Date.now();
    const r = await runAsk((signal, onResponse) => {
      setTimeout(() => onResponse(new Response("{}", { status: 429 })), 5);
      return hangingClient(signal);
    }, eq("a", "b"), { timeoutMs: 5_000 });
    expect(r).toMatchObject({ ok: false, error: { kind: "rate-limited" } });
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
