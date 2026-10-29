import { describe, expect, it } from "vitest";
import { ranges } from "../../src/interpret/conditions/between.ts";
import { dataset, field, parseFor } from "./helpers.ts";

const run = (q: string) => {
  const p = parseFor(q, dataset([field("events", "u64", ["40"]), field("city", "str", ["noida"])]));
  ranges(p);
  return p;
};
const c = (op: string, value: string) => ({ op, attr: "events", type: "u64", value });

describe("ranges", () => {
  it("'between A and B' gives both bounds, in order", () => {
    const p = run("between 20 and 10 events");
    expect(p.conds.map((x) => x.q)).toEqual([c("gte", "10"), c("lte", "20")]);
    expect([...p.consumed].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("'not between' is below or above", () => {
    const p = run("events not between 10 and 20");
    expect(p.conds).toEqual([{ attr: "events", q: { op: "or", terms: [c("lt", "10"), c("gt", "20")] }, tokens: [2, 1] }]);
  });

  it("'N or more' and 'N or less' are one inclusive bound", () => {
    expect(run("5 or more events").conds[0]!.q).toEqual(c("gte", "5"));
    expect(run("events 3 or fewer").conds[0]!.q).toEqual(c("lte", "3"));
  });

  it("needs a numeric field nearby", () => {
    expect(run("city between 1 and 2").conds).toEqual([]);
  });
});
