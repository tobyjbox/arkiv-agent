// `pnpm fees [--limit N]`: reads fees from transaction receipts for a sample of recent Arkiv writes into
// the TxFee table, for the cost view. Every write has a receipt, but fetching ~1.6M of them at the
// public rate limit would take days, so it samples: mostly real projects, a tenth load generators, and
// some update-only transactions. Safe to re-run: known transactions are skipped, inserts are idempotent.
// Runs beside `pnpm index --watch` at a low rate (ARKIV_FEE_RPS, default 3) to leave it the budget.
import { createArkivClient } from "@arkiv-agent/core";
import { openSqlite } from "@arkiv-agent/db";
import type { Hex } from "viem";
import { rateLimited } from "./enrich.ts";

const arg = (name: string) => process.argv[process.argv.indexOf(name) + 1];
const LIMIT = Number(process.argv.includes("--limit") ? arg("--limit") : 1_500);
const RPS = Number(process.env.ARKIV_FEE_RPS) || 3;
/** Sample from the last 7 days of writes. */
const WINDOW_BLOCKS = 7 * 43_200;
const LOAD_SHARE = 0.1;
const UPDATE_SHARE = 0.1;
const I64_MAX = 2n ** 63n - 1n;

const db = openSqlite();
db.pragma("busy_timeout = 10000");
const client = createArkivClient();
const indexed = Number(db.prepare(`SELECT indexedBlock FROM "SyncState" WHERE id = 1`).pluck().get() ?? 0);
const since = indexed - WINDOW_BLOCKS;
const busy = db.prepare(`SELECT owner FROM "Entity" WHERE createdAtBlock >= ? GROUP BY owner HAVING COUNT(*) > 5000`).pluck().all(since) as string[];

type Candidate = { tx: Hex; block: number; sender: string; creates: number; updates: number; payload: number; lifetime: number | null };
const createTxs = (load: boolean, n: number) => db.prepare(`
  SELECT createdTx AS tx, MIN(createdAtBlock) AS block, MIN(creator) AS sender, COUNT(*) AS creates, 0 AS updates,
    SUM(COALESCE(payloadBytes, 0)) AS payload,
    AVG(CASE WHEN expiresAt < ${I64_MAX} THEN expiresAt - createdAtBlock END) AS lifetime
  FROM "Entity" WHERE createdAtBlock >= ? AND owner ${load ? "" : "NOT"} IN (SELECT value FROM json_each(?))
    AND createdTx NOT IN (SELECT tx FROM "TxFee")
  GROUP BY createdTx ORDER BY random() LIMIT ?`).all(since, JSON.stringify(busy), n) as Candidate[];
const updateTxs = (n: number) => db.prepare(`
  SELECT p.tx AS tx, MIN(p.block) AS block, MIN(e.owner) AS sender, 0 AS creates, COUNT(*) AS updates, 0 AS payload, NULL AS lifetime
  FROM "Patch" p JOIN "Entity" e ON e.key = p.entityKey
  WHERE p.block >= ? AND p.tx NOT IN (SELECT tx FROM "TxFee") AND p.tx NOT IN (SELECT createdTx FROM "Entity" WHERE createdAtBlock >= ?)
  GROUP BY p.tx ORDER BY random() LIMIT ?`).all(since, since, n) as Candidate[];

const picked = [
  ...createTxs(false, Math.round(LIMIT * (1 - LOAD_SHARE - UPDATE_SHARE))),
  ...createTxs(true, Math.round(LIMIT * LOAD_SHARE)),
  ...updateTxs(Math.round(LIMIT * UPDATE_SHARE)),
];
console.log(`fees: sampling ${picked.length} transactions from blocks ${since}..${indexed} at ${RPS} req/s (${busy.length} load-generator wallets)`);

const fetchTx = rateLimited((hash: Hex) => client.getTransaction({ hash }), RPS);
const fetchReceipt = rateLimited((hash: Hex) => client.getTransactionReceipt({ hash }), RPS);
const insert = db.prepare(`INSERT OR IGNORE INTO "TxFee" (tx, block, sender, creates, updates, calldataBytes, payloadBytes, lifetimeBlocks, gasUsed, gasPriceWei, feeWei, fetchedAtMs)
  VALUES (@tx, @block, @sender, @creates, @updates, @calldataBytes, @payloadBytes, @lifetimeBlocks, @gasUsed, @gasPriceWei, @feeWei, @fetchedAtMs)`);

let done = 0;
let failed = 0;
for (const c of picked) {
  try {
    const [tx, receipt] = await Promise.all([fetchTx(c.tx), fetchReceipt(c.tx)]);
    insert.run({
      tx: c.tx, block: c.block, sender: c.sender.toLowerCase(), creates: c.creates, updates: c.updates,
      calldataBytes: (tx.input.length - 2) / 2, payloadBytes: c.payload,
      lifetimeBlocks: c.lifetime === null ? null : Math.round(c.lifetime),
      gasUsed: receipt.gasUsed, gasPriceWei: receipt.effectiveGasPrice.toString(),
      feeWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(), fetchedAtMs: Date.now(),
    });
    done++;
  } catch (error) {
    failed++;
    if (failed <= 5) console.error(`  ${c.tx.slice(0, 12)}…`, error instanceof Error ? error.message.split("\n")[0] : error);
  }
  if ((done + failed) % 100 === 0) console.log(`  ${done + failed} / ${picked.length} (${failed} failed)`);
}
const total = db.prepare(`SELECT COUNT(*) FROM "TxFee"`).pluck().get();
console.log(`fees: stored ${done}, failed ${failed}; TxFee now holds ${total} transactions`);
