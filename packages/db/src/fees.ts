import { readDb } from "./read.ts";
import type { Sqlite } from "./sqlite.ts";

/** A sampled receipt as stored (TxFee). Wei amounts are decimal strings. */
export type TxFeeRow = {
  creates: number; updates: number; calldataBytes: number; payloadBytes: number; lifetimeBlocks: number | null;
  gasUsed: number; gasPriceWei: string; feeWei: string; sender: string;
};

/** All sampled receipts, in a fixed order (block, tx), so a hold-out of every fifth row is reproducible. */
export function readTxFees(db: Sqlite = readDb()): TxFeeRow[] {
  return db.prepare(`SELECT creates, updates, calldataBytes, payloadBytes, lifetimeBlocks, gasUsed, gasPriceWei, feeWei, sender FROM "TxFee" ORDER BY block, tx`).all() as TxFeeRow[];
}

export function countTxFees(db: Sqlite = readDb()): number {
  return db.prepare(`SELECT COUNT(*) FROM "TxFee"`).pluck().get() as number;
}

/** A transaction to sample: what the index knows about it before its receipt is read. */
export type FeeCandidate = { tx: string; block: number; sender: string; creates: number; updates: number; payload: number; lifetime: number | null };

const I64_MAX = 2n ** 63n - 1n;

/**
 * Up to `n` random create transactions since `sinceBlock` not sampled yet, from `owners` (`load`) or
 * from everyone else, with their creates, payload bytes and mean planned lifetime.
 */
export function createFeeCandidates(sinceBlock: number, owners: readonly string[], load: boolean, n: number, db: Sqlite): FeeCandidate[] {
  return db.prepare(`
  SELECT createdTx AS tx, MIN(createdAtBlock) AS block, MIN(creator) AS sender, COUNT(*) AS creates, 0 AS updates,
    SUM(COALESCE(payloadBytes, 0)) AS payload,
    AVG(CASE WHEN expiresAt < ${I64_MAX} THEN expiresAt - createdAtBlock END) AS lifetime
  FROM "Entity" WHERE createdAtBlock >= ? AND owner ${load ? "" : "NOT"} IN (SELECT value FROM json_each(?))
    AND createdTx NOT IN (SELECT tx FROM "TxFee")
  GROUP BY createdTx ORDER BY random() LIMIT ?`).all(sinceBlock, JSON.stringify(owners), n) as FeeCandidate[];
}

/** Up to `n` random update-only transactions since `sinceBlock` not sampled yet. */
export function updateFeeCandidates(sinceBlock: number, n: number, db: Sqlite): FeeCandidate[] {
  return db.prepare(`
  SELECT p.tx AS tx, MIN(p.block) AS block, MIN(e.owner) AS sender, 0 AS creates, COUNT(*) AS updates, 0 AS payload, NULL AS lifetime
  FROM "Patch" p JOIN "Entity" e ON e.key = p.entityKey
  WHERE p.block >= ? AND p.tx NOT IN (SELECT tx FROM "TxFee") AND p.tx NOT IN (SELECT createdTx FROM "Entity" WHERE createdAtBlock >= ?)
  GROUP BY p.tx ORDER BY random() LIMIT ?`).all(sinceBlock, sinceBlock, n) as FeeCandidate[];
}

export type TxFeeInsert = {
  tx: string; block: number; sender: string; creates: number; updates: number; calldataBytes: number; payloadBytes: number;
  lifetimeBlocks: number | null; gasUsed: bigint; gasPriceWei: string; feeWei: string; fetchedAtMs: number;
};

/** Stores sampled receipts; a transaction already stored is left as is. */
export function txFeeWriter(db: Sqlite): (row: TxFeeInsert) => void {
  const insert = db.prepare(`INSERT OR IGNORE INTO "TxFee" (tx, block, sender, creates, updates, calldataBytes, payloadBytes, lifetimeBlocks, gasUsed, gasPriceWei, feeWei, fetchedAtMs)
  VALUES (@tx, @block, @sender, @creates, @updates, @calldataBytes, @payloadBytes, @lifetimeBlocks, @gasUsed, @gasPriceWei, @feeWei, @fetchedAtMs)`);
  return (row) => { insert.run(row); };
}
