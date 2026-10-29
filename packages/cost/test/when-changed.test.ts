import { describe, expect, it } from "vitest";
import { whenChanged } from "../src/cost.ts";

describe("whenChanged (refit the fee model only when receipts were added)", () => {
  it("computes once while the count stays the same, and again when it changes", () => {
    let count = 10;
    let fits = 0;
    const current = whenChanged(() => count, () => ++fits);
    expect([current(), current()]).toEqual([1, 1]);
    count = 12;
    expect([current(), current()]).toEqual([2, 2]);
    expect(fits).toBe(2);
  });
});
