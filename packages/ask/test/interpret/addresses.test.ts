import { describe, expect, it } from "vitest";
import { addresses } from "../../src/interpret/conditions/addresses.ts";
import { startParse } from "../../src/interpret/parse.ts";
import { context } from "./helpers.ts";

const A = "0x00000000000000000000000000000000000000aa";

describe("addresses", () => {
  it("reads 'owned by 0x…' as $owner and uses up the words before it", () => {
    const p = startParse(`notes owned by ${A}`, context([]));
    addresses(p);
    expect(p.conds).toEqual([{ attr: "$owner", q: { op: "eq", attr: "$owner", type: "addr", value: A }, tokens: [3] }]);
    expect([...p.consumed].sort()).toEqual([1, 2, 3]);
  });

  it("reads 'created by 0x…' as $creator", () => {
    const p = startParse(`created by ${A}`, context([]));
    addresses(p);
    expect(p.conds[0]!.attr).toBe("$creator");
  });

  it("ignores hex that isn't a full address", () => {
    const p = startParse("owned by 0xabc", context([]));
    addresses(p);
    expect(p.conds).toEqual([]);
  });
});
