import type { Dataset } from "@arkiv-agent/catalogue";
import { describe, expect, it } from "vitest";
import { compile } from "../src/compile.ts";
import { interpret } from "../src/interpret.ts";
import { AskPlanSchema } from "../src/query.ts";
import { evalContext } from "./eval-set.ts";
import fixture from "./fixtures/catalogue.json" with { type: "json" };
import { fixtureLookup } from "./lookup.ts";

const datasets = fixture.datasets as unknown as Dataset[];
const ctx = { datasets, ...evalContext, lookup: fixtureLookup };

/** Deterministic pseudo-random words: dataset names, field names, values, connectors, numbers. */
function* questions(n: number): Generator<string> {
  const vocab = [
    ...new Set(datasets.flatMap((d) => [d.project.label, d.name, ...d.schema.flatMap((f) => [f.name, ...f.examples])])),
    "in", "not", "is", "false", "true", "over", "between", "and", "or", "more", "after", "before", "last", "next", "7", "days",
    "0x0000000000000000000000000000000000000001", "\"quoted value\"", "", "?", "≥", "-5", "1.5k", "how", "many",
  ];
  let seed = 7;
  const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  for (let i = 0; i < n; i++) yield Array.from({ length: 1 + Math.floor(rand() * 9) }, () => vocab[Math.floor(rand() * vocab.length)]).join(" ");
}

describe("interpret never throws, and every plan validates and compiles or is refused", () => {
  const odd = ["", "   ", "?", "5", "between", "between 1 and", "5 or", "x over", "not", "is false", "\"", "''", "0x", "a".repeat(600), "🙂 salaries"];
  it.each([...odd, ...questions(400)])("%s", (q) => {
    const r = interpret(q, ctx);
    if (!r.ok) return;
    expect(AskPlanSchema.safeParse(r.value).success).toBe(true);
    const d = datasets.find((x) => x.id === r.value.datasetId) ?? null;
    compile(r.value, d); // may refuse with a message; must not throw
  });
});
