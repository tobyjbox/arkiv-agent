import { describe, expect, it } from "vitest";
import { estimate, type FeeRow, fitFeeModel, fitLine } from "../src/model.ts";

/** Synthetic receipts: gas = 66,110 + 21 × calldata, calldata = 600 + 1.1 × payload, ±3% noise, lifetime irrelevant. */
function rows(n: number): FeeRow[] {
  let seed = 3;
  const rand = () => (seed = (seed * 16_807) % 2_147_483_647) / 2_147_483_647;
  return Array.from({ length: n }, (_, i) => {
    const payload = Math.round(50 + rand() * 2_000);
    const calldata = Math.round(600 + 1.1 * payload);
    const gasUsed = Math.round((66_110 + 21 * calldata) * (0.97 + rand() * 0.06));
    const gasPrice = 1e-9;
    return { creates: i % 7 === 0 ? 3 : 1, updates: 0, calldataBytes: calldata, payloadBytes: payload, lifetimeBlocks: Math.round(rand() * 43_200 * 30), gasUsed, gasPrice, fee: gasUsed * gasPrice };
  });
}

describe("fee model", () => {
  it("recovers the line", () => {
    const l = fitLine([0, 1, 2, 3], [1, 3, 5, 7]);
    expect(l).toMatchObject({ intercept: 1, slope: 2, n: 4 });
    expect(l.r2).toBeCloseTo(1);
  });

  it("fits gas and calldata, and its band covers held-out fees about as often as it claims", () => {
    const m = fitFeeModel(rows(600))!;
    expect(m.gas.slope).toBeGreaterThan(19);
    expect(m.gas.slope).toBeLessThan(23);
    expect(m.calldata.slope).toBeCloseTo(1.1, 1);
    expect(m.coverage.inside / m.coverage.of).toBeGreaterThan(0.8);
    expect(Math.abs(m.lifetime.perDay)).toBeLessThan(0.002);
  });

  it("estimates with a range, a breakdown, and a warning outside observed payloads", () => {
    const m = fitFeeModel(rows(600))!;
    const e = estimate(m, 1_000, 200);
    expect(e.low).toBeLessThan(e.glm);
    expect(e.high).toBeGreaterThan(e.glm);
    expect(e.breakdown.base + e.breakdown.encoding + e.breakdown.payload).toBeCloseTo(1);
    expect(e.outside).toBe(false);
    expect(estimate(m, 1_000, 1_000_000).outside).toBe(true);
  });

  it("refuses to fit on too little data", () => {
    expect(fitFeeModel(rows(10))).toBeNull();
  });
});

describe("estimate outside the observed payloads (T12 S3)", () => {
  it("widens the range with the distance beyond the data", () => {
    const m = fitFeeModel(rows(600))!;
    const inside = estimate(m, 1_000, 200);
    const far = estimate(m, 1_000, m.observed.payloadBytes[1] * 10);
    expect(inside.widenedBy).toBe(1);
    expect(far.widenedBy).toBeCloseTo(1.5, 5);
    expect(far.high / far.glm).toBeCloseTo((inside.high / inside.glm) * 1.5, 5);
  });
});
