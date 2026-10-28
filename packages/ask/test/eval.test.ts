import type { Dataset } from "@arkiv-agent/catalogue";
import { describe, expect, it } from "vitest";
import { compile } from "../src/compile.ts";
import { interpret } from "../src/interpret.ts";
import { AskPlanSchema, canonical } from "../src/query.ts";
import { evalContext, evalSet } from "./eval-set.ts";
import fixture from "./fixtures/catalogue.json" with { type: "json" };

const datasets = fixture.datasets as unknown as Dataset[];
const ctx = { datasets, ...evalContext };
const PASS_RATE = 0.8;

describe("Ask Arkiv eval (no-key path)", () => {
  const results = evalSet.map((c) => {
    const r = interpret(c.q, ctx);
    const got = r.ok ? { datasetId: r.value.datasetId, where: canonical(r.value.where) } : null;
    const want = c.expect && { datasetId: c.expect.datasetId, where: canonical(c.expect.where) };
    return { q: c.q, pass: JSON.stringify(got) === JSON.stringify(want), got, want, plan: r.ok ? r.value : null };
  });

  it(`gets at least ${PASS_RATE * 100}% of the ${evalSet.length} questions right`, () => {
    const passed = results.filter((r) => r.pass).length;
    for (const r of results.filter((x) => !x.pass)) console.log(`MISS ${r.q}\n  got  ${JSON.stringify(r.got)}\n  want ${JSON.stringify(r.want)}`);
    console.log(`Ask Arkiv eval: ${passed}/${results.length} (${Math.round((passed / results.length) * 100)}%)`);
    expect(passed / results.length).toBeGreaterThanOrEqual(PASS_RATE);
  });

  it("only produces plans that validate and compile", () => {
    for (const r of results) {
      if (!r.plan) continue;
      expect(AskPlanSchema.safeParse(r.plan).success).toBe(true);
      const d = datasets.find((x) => x.id === r.plan!.datasetId) ?? null;
      const c = compile(r.plan, d);
      expect(c.ok, `${r.q}: ${c.ok ? "" : c.error}`).toBe(true);
    }
  });
});
