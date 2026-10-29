import { describe, expect, it } from "vitest";
import { timeWindows } from "../../src/interpret/conditions/time.ts";
import { dataset, field, HEAD, NOW, parseFor } from "./helpers.ts";

const DAY = 86_400;
const run = (q: string, schema = [field("created_at", "u64", [String(NOW)])]) => {
  const p = parseFor(q, dataset(schema));
  timeWindows(p);
  return p;
};

describe("timeWindows", () => {
  it("'last 7 days' filters a millisecond time field", () => {
    const p = run("readings from the last 7 days");
    expect(p.conds).toEqual([{ attr: "created_at", q: { op: "gte", attr: "created_at", type: "u64", value: String(NOW - 7 * DAY * 1000) }, tokens: [3, 4, 5] }]);
    expect(p.explain).toEqual([`“last 7 days” read as created_at ≥ ${NOW - 7 * DAY * 1000} (milliseconds).`]);
  });

  it("reads a seconds field and 'today'", () => {
    const p = run("readings today", [field("ts", "u64", [String(NOW / 1000)])]);
    expect(p.conds[0]!.q).toEqual({ op: "gte", attr: "ts", type: "u64", value: String(NOW / 1000 - DAY) });
  });

  it("reads a block-number field in 2 s blocks", () => {
    const p = run("readings in the past hour", [field("at_block", "u64", ["900000"])]);
    expect(p.conds[0]!.q).toEqual({ op: "gte", attr: "at_block", type: "u64", value: String(HEAD - 1800) });
  });

  it("'next 24 hours' is an expiry window on $expiresAt", () => {
    const p = run("readings expiring in the next 24 hours");
    expect(p.conds[0]!.q).toEqual({ op: "lte", attr: "$expiresAt", type: "u64", value: String(HEAD + 43_200) });
  });

  it("without a time field the window is reported, not applied", () => {
    const p = run("readings last week", [field("value", "i32", ["3"])]);
    expect(p.conds).toEqual([]);
    expect(p.explain[0]).toMatch(/no time attribute, so “last week” was not applied/);
  });
});
