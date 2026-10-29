import { describe, expect, it } from "vitest";
import { exampleValues, indexValues } from "../../src/interpret/conditions/values.ts";
import { dataset, field, lookupOf, parseFor } from "./helpers.ts";

const eq = (attr: string, value: string) => ({ op: "eq", attr, type: "str", value });

describe("exampleValues", () => {
  const d = dataset([field("city", "str", ["noida", "pune"]), field("origin", "str", ["Pune"], 1), field("destination", "str", ["Pune"], 0.5)]);
  const run = (q: string) => {
    const p = parseFor(q, d);
    exampleValues(p);
    return p;
  };

  it("binds a stored example value named in the question", () => {
    expect(run("salaries in noida").conds.map((c) => c.q)).toEqual([eq("city", "noida")]);
  });

  it("notes when the question's case differs from the stored value", () => {
    expect(run("salaries in Noida").explain).toEqual(["“Noida” matched the stored value city = “noida” (values are exact and case-sensitive)."]);
  });

  it("a value of two fields goes to the field the question names", () => {
    expect(run("trips with destination Pune").conds.map((c) => c.q)).toEqual([eq("destination", "Pune")]);
  });

  it("negates after 'not'", () => {
    expect(run("not noida").conds.map((c) => c.q)).toEqual([{ op: "not", term: eq("city", "noida") }]);
  });
});

describe("indexValues", () => {
  it("binds words the index lookup knows, in the stored case", () => {
    const p = parseFor("show millet", dataset([field("category", "str", [])]), { lookup: lookupOf({ category: ["Millet"] }) });
    indexValues(p);
    expect(p.conds.map((c) => c.q)).toEqual([eq("category", "Millet")]);
    expect(p.explain).toEqual(["“millet” matched the stored value category = “Millet”."]);
  });

  it("does nothing without a lookup", () => {
    const p = parseFor("show millet", dataset([field("category", "str", [])]));
    indexValues(p);
    expect(p.conds).toEqual([]);
  });
});
