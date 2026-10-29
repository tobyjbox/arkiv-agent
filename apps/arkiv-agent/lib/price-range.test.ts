import { describe, expect, it } from "vitest";
import { parseRange, rangeParam } from "./price-range";

describe("price chart range in the URL", () => {
  it("reads 7, 30 or 90, and anything else as the 30-day default", () => {
    expect(["7", "30", "90"].map(parseRange)).toEqual([7, 30, 90]);
    expect([undefined, "", "14", "7d", "07", "constructor"].map(parseRange)).toEqual([30, 30, 30, 30, 30, 30]);
  });

  it("writes no param for the default, so its URL stays clean", () => {
    expect([7, 30, 90].map((d) => rangeParam(d as 7 | 30 | 90))).toEqual(["7", null, "90"]);
  });
});
