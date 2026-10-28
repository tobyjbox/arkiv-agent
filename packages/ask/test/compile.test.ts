import type { Dataset } from "@arkiv-agent/catalogue";
import { describe, expect, it } from "vitest";
import { compile } from "../src/compile.ts";
import { interpret } from "../src/interpret.ts";
import { AskPlanSchema } from "../src/query.ts";
import { evalContext } from "./eval-set.ts";
import fixture from "./fixtures/catalogue.json" with { type: "json" };

const datasets = fixture.datasets as unknown as Dataset[];
const salary = datasets.find((d) => d.id === "011e76e5c32f")!;
const ctx = { datasets, ...evalContext };

describe("compile", () => {
  it("ANDs the dataset's own predicates with the question's, as the SDK renders them", () => {
    const c = compile({ where: { op: "eq", attr: "city", type: "str", value: "noida" }, limit: 50 }, salary);
    expect(c.ok && c.value.query).toBe("project = str('tankha') AND type = str('salary') AND city = str('noida')");
  });

  it("writes typed values, groups and negation into the query and the SDK snippet", () => {
    const c = compile({
      where: { op: "and", terms: [
        { op: "gt", attr: "ctc", type: "i32", value: "1500000" },
        { op: "or", terms: [{ op: "eq", attr: "city", type: "str", value: "noida" }, { op: "eq", attr: "city", type: "str", value: "pune" }] },
        { op: "not", term: { op: "eq", attr: "level", type: "str", value: "sde-1" } },
        { op: "lte", attr: "$expiresAt", type: "u64", value: "1230858" },
      ] },
      limit: 10,
    }, salary);
    if (!c.ok) throw new Error(c.error);
    expect(c.value.query).toContain("ctc > i32(1500000)");
    expect(c.value.query).toContain("(city = str('noida') OR city = str('pune'))");
    expect(c.value.query).toContain("NOT level = str('sde-1')");
    expect(c.value.query).toContain("$expiresAt <= u64(1230858)");
    expect(c.value.typescript).toContain('gt("ctc", i32(1500000))');
    expect(c.value.typescript).toContain('lte("$expiresAt", u64(1230858n))');
    expect(c.value.typescript).toMatch(/import \{ and, or, not, eq, gt, lte \} from "@arkiv-network\/sdk\/query"/);
    expect(c.value.typescript).toMatch(/import \{ str, i32, u64 \} from "@arkiv-network\/sdk\/attr"/);
    expect(c.value.typescript).toContain(".limit(10)");
  });

  it("refuses values the type can't hold and names that can't exist, instead of running them", () => {
    const bad = [
      { op: "gt", attr: "ctc", type: "i32", value: "lots" },
      { op: "gt", attr: "ctc", type: "i32", value: "3000000000" },
      { op: "gt", attr: "city", type: "str", value: "noida" },
      { op: "eq", attr: "bad name!", type: "str", value: "x" },
      { op: "eq", attr: "$owner", type: "str", value: "x" },
      { op: "eq", attr: "$createdAt", type: "u64", value: "1" },
    ] as const;
    for (const where of bad) expect(compile({ where, limit: 50 }, salary).ok, JSON.stringify(where)).toBe(false);
  });

  it("only allows owner, creator and key lookups across all datasets", () => {
    const owner = { op: "eq", attr: "$owner", type: "addr", value: "0x1c92087EC55B3B4114c7647ECADe3ab0b494C9b6" } as const;
    expect(compile({ where: owner, limit: 50 }, null).ok).toBe(true);
    expect(compile({ where: { op: "eq", attr: "city", type: "str", value: "noida" }, limit: 50 }, null).ok).toBe(false);
    expect(compile({ where: { op: "lte", attr: "$expiresAt", type: "u64", value: "1" }, limit: 50 }, null).ok).toBe(false);
    expect(compile({ where: { op: "not", term: owner }, limit: 50 }, null).ok).toBe(false);
  });

  it("rejects malformed plans at the schema", () => {
    expect(AskPlanSchema.safeParse({ datasetId: null, where: { op: "eq", attr: "a", type: "float", value: "1" }, limit: 50, explain: [] }).success).toBe(false);
    expect(AskPlanSchema.safeParse({ datasetId: null, where: null, limit: 500, explain: [] }).success).toBe(false);
  });
});

describe("interpret", () => {
  it("says so rather than guessing when nothing in the catalogue matches", () => {
    const r = interpret("asdf qwerty", ctx);
    expect(r.ok).toBe(false);
  });

  it("narrows the previous turn on a follow-up", () => {
    const first = interpret("tankha salaries in noida", ctx);
    if (!first.ok) throw new Error("first turn");
    const next = interpret("only with ctc over 1500000", { ...ctx, previous: first.value });
    expect(next.ok && next.value.datasetId).toBe(salary.id);
    expect(next.ok && JSON.stringify(next.value.where)).toContain('"city"');
    expect(next.ok && JSON.stringify(next.value.where)).toContain('"ctc"');
  });

  it("keeps to the scoped dataset", () => {
    const r = interpret("in noida", { ...ctx, scope: salary.id });
    expect(r.ok && r.value).toMatchObject({ datasetId: salary.id, where: { op: "eq", attr: "city", value: "noida" } });
  });

  it("reads a top-N limit without taking it for a time window", () => {
    const r = interpret("top 10 tankha salaries from the last 7 days", ctx);
    expect(r.ok && r.value.limit).toBe(10);
    expect(r.ok && JSON.stringify(r.value.where)).toContain("created_at");
  });
});
