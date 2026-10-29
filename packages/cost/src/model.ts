// The fee model behind the calculator: fitted from sampled receipts, with its error measured on
// receipts it wasn't fitted on. Pure functions; amounts in GLM (wei / 1e18).

export type FeeRow = { creates: number; updates: number; calldataBytes: number; payloadBytes: number; lifetimeBlocks: number | null; gasUsed: number; gasPrice: number; fee: number };
export type Line = { intercept: number; slope: number; r2: number; n: number };

export type FeeModel = {
  /** gas = intercept + slope × calldata bytes, over every sampled transaction. */
  gas: Line;
  /** calldata bytes per write = intercept + slope × payload bytes, over single-record creates. */
  calldata: Line;
  /** Median effective gas price, GLM per gas. */
  gasPrice: number;
  /** Observed ÷ predicted fee for single-record creates held out of the fit: 5th and 95th percentiles. */
  band: { low: number; high: number };
  /** Share of held-out single-record creates whose fee fell inside the band (the claim the range makes). */
  coverage: { inside: number; of: number };
  /** Does lifetime explain fees once calldata is known? Slope of relative residual per day of lifetime. */
  lifetime: { perDay: number; r2: number; n: number; spanDays: [number, number] };
  /** Ranges seen, to warn when the calculator is asked about something bigger. */
  observed: { payloadBytes: [number, number]; calldataBytes: [number, number] };
  samples: number;
};

export const GLM_PER_WEI = 1e-18;
const BLOCKS_PER_DAY = 43_200;

export function fitLine(xs: number[], ys: number[]): Line {
  const n = xs.length;
  if (n < 2) return { intercept: ys[0] ?? 0, slope: 0, r2: 0, n };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; syy += (ys[i]! - my) ** 2; }
  const slope = sxx ? sxy / sxx : 0;
  return { intercept: my - slope * mx, slope, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0, n };
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 1;
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo]! + (s[hi]! - s[lo]!) * (i - lo);
};

/** GLM for one write with this payload, by the model's two lines and median price. */
export function feePerWrite(m: Pick<FeeModel, "gas" | "calldata" | "gasPrice">, payloadBytes: number): number {
  const calldata = m.calldata.intercept + m.calldata.slope * payloadBytes;
  return (m.gas.intercept + m.gas.slope * calldata) * m.gasPrice;
}

/** Deterministic hold-out: every fifth single-record create is kept out of the fit. */
export function fitFeeModel(rows: FeeRow[]): FeeModel | null {
  const single = rows.filter((r) => r.creates === 1 && r.updates === 0);
  const held = single.filter((_, i) => i % 5 === 4);
  const heldSet = new Set(held);
  const train = rows.filter((r) => !heldSet.has(r));
  const trainSingle = single.filter((r) => !heldSet.has(r));
  if (train.length < 20 || trainSingle.length < 10) return null;

  const gas = fitLine(train.map((r) => r.calldataBytes), train.map((r) => r.gasUsed));
  const calldata = fitLine(trainSingle.map((r) => r.payloadBytes), trainSingle.map((r) => r.calldataBytes));
  const gasPrice = quantile(train.map((r) => r.gasPrice), 0.5);
  const base = { gas, calldata, gasPrice };
  const ratios = (rs: FeeRow[]) => rs.map((r) => r.fee / feePerWrite(base, r.payloadBytes)).filter(Number.isFinite);
  // The band comes from training rows; held-out rows test it.
  const trainRatios = ratios(trainSingle);
  const band = { low: quantile(trainRatios, 0.05), high: quantile(trainRatios, 0.95) };
  const heldRatios = ratios(held);
  const coverage = { inside: heldRatios.filter((x) => x >= band.low && x <= band.high).length, of: heldRatios.length };

  const withLife = trainSingle.filter((r) => r.lifetimeBlocks !== null && r.lifetimeBlocks > 0);
  const days = withLife.map((r) => r.lifetimeBlocks! / BLOCKS_PER_DAY);
  const resid = withLife.map((r) => r.fee / feePerWrite(base, r.payloadBytes) - 1);
  const life = fitLine(days, resid);
  return {
    ...base, band, coverage,
    lifetime: { perDay: life.slope, r2: life.r2, n: life.n, spanDays: [Math.min(...days, 0), Math.max(...days, 0)] },
    observed: {
      payloadBytes: [Math.min(...single.map((r) => r.payloadBytes)), Math.max(...single.map((r) => r.payloadBytes))],
      calldataBytes: [Math.min(...rows.map((r) => r.calldataBytes)), Math.max(...rows.map((r) => r.calldataBytes))],
    },
    samples: rows.length,
  };
}

export type Estimate = { glm: number; low: number; high: number; perWrite: number; breakdown: { base: number; encoding: number; payload: number }; outside: boolean; widenedBy: number };

/** GLM for `writesPerDay` writes of `payloadBytes` each over `days`. Lifetime doesn't enter: see FeeModel.lifetime. */
export function estimate(m: FeeModel, writesPerDay: number, payloadBytes: number, days = 30): Estimate {
  const perWrite = feePerWrite(m, payloadBytes);
  const writes = writesPerDay * days;
  const glm = perWrite * writes;
  const base = m.gas.intercept * m.gasPrice;
  const encoding = m.gas.slope * m.calldata.intercept * m.gasPrice;
  const payload = m.gas.slope * m.calldata.slope * payloadBytes * m.gasPrice;
  const total = base + encoding + payload || 1;
  // Outside the payloads seen, the fit is an extrapolation: widen the band by half for every tenfold
  // step beyond the data (so 10× the largest payload seen gives ×1.5 on each side).
  const [minSeen, maxSeen] = m.observed.payloadBytes;
  const beyond = payloadBytes > maxSeen ? payloadBytes / Math.max(1, maxSeen) : payloadBytes < minSeen ? Math.max(1, minSeen) / Math.max(1, payloadBytes) : 1;
  const widenedBy = 1 + 0.5 * Math.log10(beyond);
  return {
    glm, low: (glm * m.band.low) / widenedBy, high: glm * m.band.high * widenedBy, perWrite, widenedBy,
    breakdown: { base: base / total, encoding: encoding / total, payload: payload / total },
    outside: payloadBytes > m.observed.payloadBytes[1] || payloadBytes < m.observed.payloadBytes[0],
  };
}
