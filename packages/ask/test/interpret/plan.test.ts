import { describe, expect, it } from "vitest";
import { interpret } from "../../src/interpret.ts";
import { context, dataset, field } from "./helpers.ts";

const d = dataset([field("x", "i32", ["1"]), field("y", "i32", ["2"]), field("city", "str", ["noida", "pune"])]);
const plan = (q: string, extra = {}) => {
  const r = interpret(q, context([d], extra));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe("buildPlan", () => {
  it("joins clauses split by 'or' into one OR group", () => {
    expect(plan("sensornet readings with x over 20 or y under 5").where).toEqual({ op: "or", terms: [
      { op: "gt", attr: "x", type: "i32", value: "20" }, { op: "lt", attr: "y", type: "i32", value: "5" }] });
  });

  it("several values of one field are any of them; different fields are all required", () => {
    expect(plan("sensornet readings in noida or pune with x over 3").where).toEqual({ op: "and", terms: [
      { op: "or", terms: [{ op: "eq", attr: "city", type: "str", value: "noida" }, { op: "eq", attr: "city", type: "str", value: "pune" }] },
      { op: "gt", attr: "x", type: "i32", value: "3" }] });
  });

  it("reports words nothing used", () => {
    expect(plan("sensornet readings with bananas").ignored).toEqual(["bananas"]);
  });

  it("a follow-up on the same dataset keeps the previous conditions", () => {
    const previous = plan("sensornet readings in noida");
    expect(plan("with x over 3", { previous }).where).toEqual({ op: "and", terms: [
      { op: "eq", attr: "city", type: "str", value: "noida" }, { op: "gt", attr: "x", type: "i32", value: "3" }] });
  });

  it("says Arkiv has no count", () => {
    expect(plan("how many sensornet readings").explain).toContain("Arkiv has no count for a query: results come a page at a time (Load more).");
  });
});
