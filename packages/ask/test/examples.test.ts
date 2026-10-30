import type { Dataset, Member } from "@arkiv-agent/catalogue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { interpretQuestion } from "../src/ask.ts";
import { exampleQuestions, matches } from "../src/examples.ts";
import { timeField } from "../src/interpret/fields.ts";
import { leaves } from "../src/query.ts";
import { evalContext } from "./eval-set.ts";
import fixture from "./fixtures/catalogue.json" with { type: "json" };
import { fixtureLookup } from "./lookup.ts";

const datasets = fixture.datasets as unknown as Dataset[];
const ctx = { datasets, ...evalContext, lookup: fixtureLookup };
const WALLET = "0x00000000000000000000000000000000000000aa";

const member = (attrs: [string, string, string][], over: Partial<Member> = {}): Member => ({
  key: `0x${"0".repeat(64)}`, owner: WALLET, status: "live", createdAtBlock: 1, updatedAtBlock: 1, expiresAt: null,
  contentType: null, payloadBytes: null, attrs: new Map(attrs.map(([name, type, value]) => [name, { type: type as never, value }])), ...over,
});

/** Live records made from each dataset's recorded examples, plus one written an hour ago. */
function recordsOf(d: Dataset): Member[] {
  const owner = d.soleOwner ?? WALLET;
  const rows = [0, 1, 2].map((i) => member(d.schema.filter((f) => f.examples.length).map((f) => [f.name, f.type, f.examples[i % f.examples.length]!]), { owner }));
  const time = timeField(d);
  if (time) {
    const recent = time.unit === "ms" ? ctx.now - 3_600_000 : time.unit === "s" ? Math.floor(ctx.now / 1000) - 3_600 : ctx.head - 1_800;
    rows.push(member([[time.field.name, time.field.type, String(recent)]], { owner }));
  }
  return rows;
}
const byId = new Map(datasets.map((d) => [d.id, recordsOf(d)]));
const records = (id: string) => byId.get(id) ?? [];

/** What kind of question a plan is, by its one condition. */
function kindOf(where: Parameters<typeof leaves>[0]): string {
  const [leaf, ...rest] = leaves(where);
  if (rest.length) return "several";
  if (!leaf) return "dataset";
  if (leaf.attr === "$owner") return "owner";
  return leaf.op === "eq" ? "text" : leaf.op;
}

describe("exampleQuestions", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("asks each kind of question once, from a different project each time", () => {
    const qs = exampleQuestions(ctx, records);
    expect(qs.length).toBeGreaterThanOrEqual(4);
    expect(qs.length).toBeLessThanOrEqual(6);
    const projects = qs.map((q) => datasets.find((d) => q.startsWith(`${d.project.label.replace(/[-_.]?\*$/, "")} `))?.project.label);
    expect(new Set(projects).size).toBe(qs.length);
  });

  it("every example is read by the rules, without an API key, as its own kind, using every word, and finds a record", async () => {
    const qs = exampleQuestions(ctx, records);
    const kinds = new Set<string>();
    for (const q of qs) {
      const r = await interpretQuestion(q, ctx);
      if (!r.ok) throw new Error(`${q}: ${r.message}`);
      expect(r.engine, q).toBe("rules");
      expect(r.plan.ignored, q).toEqual([]);
      expect(r.plan.datasetId, q).not.toBeNull();
      expect(records(r.plan.datasetId!).some((m) => !r.plan.where || matches(r.plan.where, m)), q).toBe(true);
      kinds.add(kindOf(r.plan.where));
    }
    // Text value, whole dataset, number, time window, owner: one each.
    expect([...kinds].sort()).toEqual(["dataset", "gt", "gte", "owner", "text"]);
    expect(kinds.size).toBe(qs.length);
  });

  it("skips a kind with no record to show for it", () => {
    expect(exampleQuestions(ctx, () => [])).toEqual([]);
    const expired = (id: string) => records(id).map((m) => ({ ...m, expiresAt: ctx.head - 1 }));
    expect(exampleQuestions(ctx, expired)).toEqual([]);
    const otherOwners = (id: string) => records(id).map((m) => ({ ...m, owner: WALLET }));
    expect(exampleQuestions(ctx, otherOwners).some((q) => / owned by 0x/.test(q))).toBe(false);
  });

  it("keeps the first n", () => {
    expect(exampleQuestions(ctx, records, 2)).toEqual(exampleQuestions(ctx, records).slice(0, 2));
  });
});

describe("matches", () => {
  const m = member([["city", "str", "Pune"], ["ctc", "i32", "1500000"], ["mgl", "dec", "0.05"], ["block", "u64", "18446744073709551615"]], { expiresAt: 900 });

  it("compares typed values the way Arkiv does", () => {
    expect(matches({ op: "eq", attr: "city", type: "str", value: "Pune" }, m)).toBe(true);
    expect(matches({ op: "eq", attr: "city", type: "str", value: "pune" }, m)).toBe(false);
    expect(matches({ op: "eq", attr: "ctc", type: "str", value: "1500000" }, m)).toBe(false);
    expect(matches({ op: "gt", attr: "ctc", type: "i32", value: "999999" }, m)).toBe(true);
    expect(matches({ op: "gte", attr: "block", type: "u64", value: "18446744073709551614" }, m)).toBe(true);
    expect(matches({ op: "lt", attr: "mgl", type: "dec", value: "0.1" }, m)).toBe(true);
    expect(matches({ op: "startsWith", attr: "city", value: "Pu" }, m)).toBe(true);
  });

  it("reads system attributes, missing attributes and groups", () => {
    expect(matches({ op: "eq", attr: "$owner", type: "addr", value: WALLET.toUpperCase().replace("0X", "0x") }, m)).toBe(true);
    expect(matches({ op: "lte", attr: "$expiresAt", type: "u64", value: "900" }, m)).toBe(true);
    expect(matches({ op: "exists", attr: "district" }, m)).toBe(false);
    expect(matches({ op: "ne", attr: "district", type: "str", value: "x" }, m)).toBe(false);
    expect(matches({ op: "not", term: { op: "exists", attr: "district" } }, m)).toBe(true);
    expect(matches({ op: "or", terms: [{ op: "exists", attr: "district" }, { op: "eq", attr: "city", type: "str", value: "Pune" }] }, m)).toBe(true);
    expect(matches({ op: "and", terms: [{ op: "exists", attr: "district" }, { op: "eq", attr: "city", type: "str", value: "Pune" }] }, m)).toBe(false);
  });
});
