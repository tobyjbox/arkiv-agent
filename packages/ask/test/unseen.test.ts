import type { Dataset } from "@arkiv-agent/catalogue";
import { describe, expect, it } from "vitest";
import { interpret } from "../src/interpret.ts";
import { canonical } from "../src/query.ts";
import { evalContext } from "./eval-set.ts";
import fixture from "./fixtures/catalogue.json" with { type: "json" };
import { fixtureLookup } from "./lookup.ts";
import { unseenSet } from "./unseen-set.ts";

const ctx = { datasets: fixture.datasets as unknown as Dataset[], ...evalContext, lookup: fixtureLookup };

describe("Ask Arkiv T14 unseen set (no-key path)", () => {
  it("reports its score (tracked, not gated)", () => {
    let passed = 0;
    for (const c of unseenSet) {
      const r = interpret(c.q, ctx);
      const got = r.ok ? { datasetId: r.value.datasetId, where: canonical(r.value.where) } : null;
      const want = c.expect && { datasetId: c.expect.datasetId, where: canonical(c.expect.where) };
      const ignored = r.ok ? ((r.value as { ignored?: string[] }).ignored ?? []).map((w) => w.toLowerCase()) : [];
      const surfaced = (c.ignored ?? []).every((w) => ignored.includes(w));
      if (JSON.stringify(got) === JSON.stringify(want) && surfaced) passed++;
      else console.log(`MISS ${c.q}\n  got  ${JSON.stringify(got)} ignored=${JSON.stringify(ignored)}\n  want ${JSON.stringify(want)}`);
    }
    console.log(`T14 unseen: ${passed}/${unseenSet.length}`);
    expect(passed).toBeGreaterThanOrEqual(0);
  });
});
