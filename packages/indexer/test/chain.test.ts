import { describe, expect, it } from "vitest";
import { suggestedEnd, toEvents } from "../src/chain.ts";
import { fixture } from "./helpers.ts";

describe("toEvents", () => {
  it("orders by block and log, numbering operations within each transaction", () => {
    const events = toEvents([...fixture().logs].reverse());
    for (let i = 1; i < events.length; i++) {
      const [a, b] = [events[i - 1]!, events[i]!];
      expect(a.block < b.block || (a.block === b.block && a.logIndex < b.logIndex)).toBe(true);
    }
    const perTx = Map.groupBy(events, (e) => e.tx);
    for (const list of perTx.values()) expect(list.map((e) => e.op)).toEqual(list.map((_, i) => i));
  });
});

describe("suggestedEnd", () => {
  const err = (msg: string) => Object.assign(new Error("RPC Request failed."), { cause: { message: msg } });
  it("follows the node's retry hint, else halves, else gives up", () => {
    expect(suggestedEnd(err("query exceeds max results 20000, retry with the range 725001-729209"), 725_001n, 730_000n)).toBe(729_209n);
    expect(suggestedEnd(err("query exceeds max results 20000"), 0n, 100n)).toBe(50n);
    expect(suggestedEnd(err("rate limited"), 0n, 100n)).toBeNull();
  });
});
