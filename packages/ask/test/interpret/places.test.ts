import { describe, expect, it } from "vitest";
import { places } from "../../src/interpret/conditions/places.ts";
import { dataset, field, lookupOf, parseFor } from "./helpers.ts";

const run = (q: string, schema = [field("city", "str", ["Pune", "Nashik"])], values: Record<string, string[]> = {}) => {
  const p = parseFor(q, dataset(schema), { lookup: lookupOf(values) });
  places(p);
  return p;
};

describe("places", () => {
  it("'in X' fills the place field X is a stored value of", () => {
    const p = run("readings in nashik", undefined, { city: ["Nashik"] });
    expect(p.conds.map((c) => c.q)).toEqual([{ op: "eq", attr: "city", type: "str", value: "Nashik" }]);
    expect(p.explain).toEqual(["“nashik” read as city = “Nashik”."]);
  });

  it("takes an unseen capitalised word when there is one place field", () => {
    const p = run("readings in Satara");
    expect(p.conds.map((c) => c.q)).toEqual([{ op: "eq", attr: "city", type: "str", value: "Satara" }]);
    expect(p.explain[0]).toMatch(/hasn't seen that value/);
  });

  it("leaves lowercase words, and guesses nothing with two place fields", () => {
    expect(run("readings in satara").conds).toEqual([]);
    expect(run("readings in Satara", [field("city", "str", ["Pune"]), field("state", "str", ["MH"])]).conds).toEqual([]);
  });
});
