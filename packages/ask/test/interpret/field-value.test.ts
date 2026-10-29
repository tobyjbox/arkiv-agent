import { describe, expect, it } from "vitest";
import { fieldValues } from "../../src/interpret/conditions/field-value.ts";
import { dataset, field, lookupOf, parseFor } from "./helpers.ts";

const d = dataset([field("district", "str", ["KATHUA", "DODA"]), field("shift", "i32", ["1"]), field("wallet", "addr", ["0xab"]), field("lender_type", "str", ["NBFC"])]);
const run = (q: string, values: Record<string, string[]> = {}) => {
  const p = parseFor(q, d, { lookup: lookupOf(values) });
  fieldValues(p);
  return p;
};

describe("fieldValues", () => {
  it("takes a stored value after the field's name", () => {
    const p = run("district doda", { district: ["DODA"] });
    expect(p.conds.map((c) => c.q)).toEqual([{ op: "eq", attr: "district", type: "str", value: "DODA" }]);
    expect(p.explain).toEqual(["“doda” matched the stored value district = “DODA”."]);
  });

  it("takes an unseen value as typed, cased like the examples, and says so", () => {
    const p = run("district leh");
    expect(p.conds.map((c) => c.q)).toEqual([{ op: "eq", attr: "district", type: "str", value: "LEH" }]);
    expect(p.explain[0]).toMatch(/district = “LEH” is not among the values/);
  });

  it("reads a field named in two words", () => {
    expect(run("lender type COOP").conds.map((c) => c.q)).toEqual([{ op: "eq", attr: "lender_type", type: "str", value: "COOP" }]);
  });

  it("reads numbers for numeric fields and 0x values for address fields", () => {
    expect(run("shift is 2").conds.map((c) => c.q)).toEqual([{ op: "eq", attr: "shift", type: "i32", value: "2" }]);
    expect(run("wallet 0xabc").conds.map((c) => c.q)).toEqual([{ op: "eq", attr: "wallet", type: "addr", value: "0xabc" }]);
    expect(run("wallet alice").conds).toEqual([]);
  });
});
