import { loadGeneratorOwners } from "@arkiv-agent/catalogue";
import { createsByWallet, readCursor, readTxFees, type TxFeeRow, updatesByWallet } from "@arkiv-agent/db";
import { projectsByWallet } from "@arkiv-agent/pulse";
import { type FeeModel, type FeeRow, fitFeeModel, GLM_PER_WEI } from "./model.ts";

const TTL_MS = 60_000;
const BLOCKS_PER_DAY = 43_200;
let cache: { at: number; rows: FeeRow[]; model: FeeModel | null; fittedAt: string } | null = null;

/** Sampled receipts (TxFee) and the model fitted on them; refitted at most every minute. */
export function feeModel(): { rows: FeeRow[]; model: FeeModel | null; fittedAt: string } {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
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
  cache = { at: Date.now(), rows, model: fitFeeModel(rows), fittedAt: new Date().toISOString() };
  return cache;
}

export type ProjectSpend = { project: string; isLabel: boolean; writes: number; glm: number; perWrite: number };
export type Spend = { days: number; writes: number; glm: number; low: number; high: number; projects: ProjectSpend[]; receipts: number };

/**
 * Estimated GLM spent per project over the last `days`: each create priced by the model from its
 * payload size, each update at the median observed fee per update. An estimate, so it carries the
 * model's range.
 */
export function estimatedSpend(days: number, includeLoad: boolean): Spend | null {
  const { rows, model } = feeModel();
  if (!model) return null;
  const indexed = readCursor()?.indexedBlock ?? 0;
  const since = indexed - days * BLOCKS_PER_DAY;
  const creates = createsByWallet(since);
  const updates = updatesByWallet(since);
  const perUpdate = median(rows.filter((r) => r.creates === 0 && r.updates > 0).map((r) => r.fee / r.updates)) ?? perCreateBase(model);
  const load = new Set([...loadGeneratorOwners()].map((w) => w.toLowerCase()));
  const projectOf = projectsByWallet();

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

const perCreateBase = (m: FeeModel) => (m.gas.intercept + m.gas.slope * m.calldata.intercept) * m.gasPrice;
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
