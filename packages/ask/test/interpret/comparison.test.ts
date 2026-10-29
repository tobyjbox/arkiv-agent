import { describe, expect, it } from "vitest";
import { comparisons } from "../../src/interpret/conditions/comparison.ts";
import { dataset, field, parseFor } from "./helpers.ts";

const schema = [field("ctc", "i32", ["1200000"]), field("events", "u64", ["40"]), field("duration_min", "u64", ["90"]), field("temp_c_x100", "i32", ["2650"]), field("city", "str", ["noida"])];
const run = (q: string) => {
  const p = parseFor(q, dataset(schema));
  comparisons(p);
  return p;
};

describe("comparisons", () => {
  it("takes the field right before the comparator", () => {
    const p = run("salaries with ctc over 1500000");
    expect(p.conds).toEqual([{ attr: "ctc", q: { op: "gt", attr: "ctc", type: "i32", value: "1500000" }, tokens: [3, 4, 2] }]);
  });

  it("takes the field right after the number, and reads number words", () => {
    expect(run("more than ten events").conds[0]!.q).toEqual({ op: "gt", attr: "events", type: "u64", value: "10" });
  });

  it("converts a duration to the field's unit", () => {
    const p = run("trips longer than 3 hours");
    expect(p.conds[0]!.q).toEqual({ op: "gt", attr: "duration_min", type: "u64", value: "180" });
    expect(p.explain).toEqual(["3 hours = 180 minutes (duration_min)."]);
  });

  it("scales a value for a field stored ×100", () => {
    const p = run("temp at least 30");
    expect(p.conds[0]!.q).toEqual({ op: "gte", attr: "temp_c_x100", type: "i32", value: "3000" });
    expect(p.explain).toEqual(["30 stored as 3000 (temp_c_x100 stores values ×100)."]);
  });

  it("leaves a comparison with no numeric field alone", () => {
    expect(run("city over 5").conds).toEqual([]);
  });

  it("doesn't reach back across 'and'", () => {
    const p = run("ctc and over 5");
    expect(p.conds).toEqual([]);
  });
});
