import { countTxFees, createsByWallet, readAggregate, readCursor, readTxFees, type TxFeeRow, updatesByWallet } from "@arkiv-agent/db";
import { loadGeneratorOwners, projectsByWallet } from "@arkiv-agent/projects";
import { type FeeModel, type FeeRow, fitFeeModel, GLM_PER_WEI } from "./model.ts";

const BLOCKS_PER_DAY = 43_200;
/** Spend periods the pages show: Insights' 7, 30 and 90 days (Financials shows 30). */
export const SPEND_DAYS = [7, 30, 90] as const;
/** The Financials scatter draws at most this many receipts, evenly picked. */
const MAX_POINTS = 2_000;

type Fit = { rows: FeeRow[]; model: FeeModel | null; fittedAt: string };

/** Sampled receipts (TxFee) and the model fitted on them. */
function fit(): Fit {
  let raw: TxFeeRow[] = [];
  try {
    raw = readTxFees(); // fixed order: the hold-out takes every fifth row
  } catch {
    // Table not migrated yet: `pnpm index` applies migrations.
  }
  const rows = raw.map((r) => ({
    creates: r.creates, updates: r.updates, calldataBytes: r.calldataBytes, payloadBytes: r.payloadBytes,
    lifetimeBlocks: r.lifetimeBlocks, gasUsed: Number(r.gasUsed), gasPrice: Number(r.gasPriceWei) * GLM_PER_WEI, fee: Number(r.feeWei) * GLM_PER_WEI,
  }));
  return { rows, model: fitFeeModel(rows), fittedAt: new Date().toISOString() };
}

/** `compute()`'s last result while `count()` stays the same; computed again when it changes. */
export function whenChanged<T>(count: () => number, compute: () => T): () => T {
  let last: { n: number; value: T } | null = null;
  return () => {
    const n = count();
    if (!last || last.n !== n) last = { n, value: compute() };
    return last.value;
  };
}

const countReceipts = () => {
  try {
    return countTxFees();
  } catch {
    return 0; // table not migrated yet
  }
};
/** The fee model, refitted only when `pnpm fees` has added receipts. */
const currentFit = whenChanged(countReceipts, fit);

/** What the Financials page shows about the fee model: the model, and up to 2,000 receipts for its scatter. */
export type FeeSummary = {
  model: FeeModel | null; fittedAt: string; receipts: number;
  points: { calldataBytes: number; gasUsed: number }[]; maxCalldataBytes: number; maxGasUsed: number;
};

function summarize({ rows, model, fittedAt }: Fit): FeeSummary {
  const step = Math.max(1, Math.ceil(rows.length / MAX_POINTS));
  return {
    model, fittedAt, receipts: rows.length,
    points: rows.filter((_, i) => i % step === 0).map((r) => ({ calldataBytes: r.calldataBytes, gasUsed: r.gasUsed })),
    maxCalldataBytes: Math.max(1, ...rows.map((r) => r.calldataBytes)), maxGasUsed: Math.max(1, ...rows.map((r) => r.gasUsed)),
  };
}

export type ProjectSpend = { project: string; isLabel: boolean; writes: number; glm: number; perWrite: number };
export type Spend = { days: number; writes: number; glm: number; low: number; high: number; projects: ProjectSpend[]; receipts: number };

type Activity = { creates: { w: string; n: number; bytes: number }[]; updates: { w: string; n: number }[]; load: ReadonlySet<string>; projectOf: Map<string, string> };

/**
 * Estimated GLM spent per project over `days`: each create priced by the model from its payload size,
 * each update at the median observed fee per update. An estimate, so it carries the model's range.
 */
function estimate({ rows, model }: Fit, days: number, includeLoad: boolean, { creates, updates, load, projectOf }: Activity): Spend | null {
  if (!model) return null;
  const perUpdate = median(rows.filter((r) => r.creates === 0 && r.updates > 0).map((r) => r.fee / r.updates)) ?? perCreateBase(model);
  const byProject = new Map<string, ProjectSpend>();
  const add = (w: string, writes: number, glm: number) => {
    if (!includeLoad && load.has(w)) return;
    const p = projectOf.get(w) ?? w;
    const s = byProject.get(p) ?? { project: p, isLabel: projectOf.has(w), writes: 0, glm: 0, perWrite: 0 };
    s.writes += writes;
    s.glm += glm;
    byProject.set(p, s);
  };
  const { gas, calldata, gasPrice } = model;
  for (const c of creates) add(c.w, c.n, (c.n * (gas.intercept + gas.slope * calldata.intercept) + gas.slope * calldata.slope * c.bytes) * gasPrice);
  for (const u of updates) add(u.w, u.n, u.n * perUpdate);
  const projects = [...byProject.values()].map((s) => ({ ...s, perWrite: s.writes ? s.glm / s.writes : 0 })).sort((a, b) => b.glm - a.glm);
  const glm = projects.reduce((a, s) => a + s.glm, 0);
  return { days, writes: projects.reduce((a, s) => a + s.writes, 0), glm, low: glm * model.band.low, high: glm * model.band.high, projects: projects.slice(0, 15), receipts: rows.length };
}

const spendKey = (days: number, includeLoad: boolean) => `spend:${days}:${includeLoad ? "all" : "apps"}`;

/**
 * The fee model summary and the estimated spend for every period, with and without load generators,
 * as `[key, value]` pairs for the indexer to store.
 */
export function costAggregates(): [string, FeeSummary | Spend | null][] {
  const f = currentFit();
  const indexed = readCursor()?.indexedBlock ?? 0;
  const load = loadGeneratorOwners();
  const projectOf = projectsByWallet();
  const out: [string, FeeSummary | Spend | null][] = [["fees", summarize(f)]];
  for (const days of SPEND_DAYS) {
    const since = indexed - days * BLOCKS_PER_DAY;
    const activity = f.model ? { creates: createsByWallet(since), updates: updatesByWallet(since), load, projectOf } : { creates: [], updates: [], load, projectOf };
    for (const includeLoad of [false, true]) out.push([spendKey(days, includeLoad), estimate(f, days, includeLoad, activity)]);
  }
  return out;
}

/** The fee model summary as the indexer last stored it; null until it has. */
export const feeSummary = (): FeeSummary | null => readAggregate<FeeSummary>("fees")?.value ?? null;

/** Estimated spend over `days` (7, 30 or 90) as the indexer last stored it; null until it has, or without a fee model. */
export const estimatedSpend = (days: number, includeLoad: boolean): Spend | null => readAggregate<Spend | null>(spendKey(days, includeLoad))?.value ?? null;

const perCreateBase = (m: FeeModel) => (m.gas.intercept + m.gas.slope * m.calldata.intercept) * m.gasPrice;
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
