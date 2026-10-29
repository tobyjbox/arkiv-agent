import type { Dataset } from "@arkiv-agent/catalogue";
import { describe, expect, it } from "vitest";
import { interpret } from "../src/interpret.ts";
import { canonical } from "../src/query.ts";
import { evalContext } from "./eval-set.ts";
import fixture from "./fixtures/catalogue.json" with { type: "json" };
import { holdoutSet } from "./holdout-set.ts";

const ctx = { datasets: fixture.datasets as unknown as Dataset[], ...evalContext };

describe("Ask Arkiv held-out questions (no-key path)", () => {
  it("reports its score (tracked, not gated)", () => {
    let passed = 0;
    for (const c of holdoutSet) {
      const r = interpret(c.q, ctx);
      const got = r.ok ? { datasetId: r.value.datasetId, where: canonical(r.value.where) } : null;
      const want = c.expect && { datasetId: c.expect.datasetId, where: canonical(c.expect.where) };
      if (JSON.stringify(got) === JSON.stringify(want)) passed++;
      else console.log(`MISS ${c.q}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
    }
    console.log(`Held-out: ${passed}/${holdoutSet.length}`);
    expect(passed).toBeGreaterThanOrEqual(0);
  });
});
