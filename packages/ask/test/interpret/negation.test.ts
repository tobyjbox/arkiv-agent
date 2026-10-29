import { describe, expect, it } from "vitest";
import { bind, negationsBefore } from "../../src/interpret/conditions/negation.ts";
import { dataset, field, parseFor } from "./helpers.ts";

const city = field("city", "str", ["noida"]);
const parse = (q: string) => parseFor(q, dataset([city]));

describe("negationsBefore", () => {
  it("finds free negation words among the two tokens before", () => {
    const p = parse("except not noida");
    expect(negationsBefore(p, 2)).toEqual([1, 0]);
    p.consumed.add(1);
    expect(negationsBefore(p, 2)).toEqual([0]);
  });

  it("counts a lone 'un' only when asked", () => {
    const p = parse("un verified");
    expect(negationsBefore(p, 1)).toEqual([]);
    expect(negationsBefore(p, 1, true)).toEqual([0]);
  });
});

describe("bind", () => {
  it("adds field = value and uses up its words", () => {
    const p = parse("readings in noida");
    bind(p, city, "noida", [2]);
    expect(p.conds).toEqual([{ attr: "city", q: { op: "eq", attr: "city", type: "str", value: "noida" }, tokens: [2] }]);
    expect([...p.consumed]).toEqual([2]);
  });

  it("negates after 'not', and uses up the field's own name before it", () => {
    const p = parse("city is not noida");
    bind(p, city, "noida", [3]);
    expect(p.conds[0]!.q).toEqual({ op: "not", term: { op: "eq", attr: "city", type: "str", value: "noida" } });
    expect([...p.consumed].sort()).toEqual([0, 2, 3]);
  });
});
