import { describe, expect, it } from "vitest";
import { yesNo } from "../../src/interpret/conditions/yes-no.ts";
import { dataset, field, parseFor } from "./helpers.ts";

const schema = [field("exceeds", "bool", ["true"]), field("exp_ok", "bool", ["true"]), field("historical", "bool", ["false"]), field("verified", "bool", ["true"]), field("expiry_known", "bool", ["true"])];
const run = (q: string) => {
  const p = parseFor(q, dataset(schema));
  yesNo(p);
  return p.conds.map((c) => [c.attr, c.q.op === "eq" ? c.q.value : c.q.op, c.tokens]);
};

describe("yesNo", () => {
  it("a field's word alone means true", () => expect(run("arsenic exceeds the limit")).toEqual([["exceeds", "true", [1]]]));
  it("reads 'is false' after the field", () => expect(run("exp_ok is false")).toEqual([["exp_ok", "false", [0, 1, 2]]]));
  it("a negation before the field flips it", () => expect(run("that are not historical")).toEqual([["historical", "false", [3, 2]]]));
  it("reads 'un' and 'non' prefixes", () => expect(run("unverified readings")).toEqual([["verified", "false", [0]]]));
  it("joins a two-word field across 'is not'", () => expect(run("expiry is not known")).toEqual([["expiry_known", "false", [0, 1, 2, 3]]]));
});
