// `pnpm fees [--limit N]`: reads fees from transaction receipts for a sample of recent Arkiv writes into
// the TxFee table, for the cost view. Every write has a receipt, but fetching ~1.6M of them at the
// public rate limit would take days, so it samples: mostly real projects, a tenth load generators, and
// some update-only transactions. Safe to re-run: known transactions are skipped, inserts are idempotent.
// Runs beside `pnpm index --watch` at a low rate (ARKIV_FEE_RPS, default 3) to leave it the budget.
import { createArkivClient } from "@arkiv-agent/core";
import { busyOwners, countTxFees, createFeeCandidates, type FeeCandidate, openSqlite, readCursor, txFeeWriter, updateFeeCandidates } from "@arkiv-agent/db";
import type { Hex } from "viem";
import { rateLimited } from "./enrich.ts";

const arg = (name: string) => process.argv[process.argv.indexOf(name) + 1];
const LIMIT = Number(process.argv.includes("--limit") ? arg("--limit") : 1_500);
const RPS = Number(process.env.ARKIV_FEE_RPS) || 3;
/** Sample from the last 7 days of writes. */
const WINDOW_BLOCKS = 7 * 43_200;
const LOAD_SHARE = 0.1;
const UPDATE_SHARE = 0.1;

const db = openSqlite();
db.pragma("busy_timeout = 10000");
const client = createArkivClient();
const indexed = readCursor(db)?.indexedBlock ?? 0;
const since = indexed - WINDOW_BLOCKS;
const busy = busyOwners(since, 5_000, db);

type Candidate = FeeCandidate & { tx: Hex };
const createTxs = (load: boolean, n: number) => createFeeCandidates(since, busy, load, n, db) as Candidate[];
const updateTxs = (n: number) => updateFeeCandidates(since, n, db) as Candidate[];

const picked = [
  ...createTxs(false, Math.round(LIMIT * (1 - LOAD_SHARE - UPDATE_SHARE))),
  ...createTxs(true, Math.round(LIMIT * LOAD_SHARE)),
  ...updateTxs(Math.round(LIMIT * UPDATE_SHARE)),
];
console.log(`fees: sampling ${picked.length} transactions from blocks ${since}..${indexed} at ${RPS} req/s (${busy.length} load-generator wallets)`);

const fetchTx = rateLimited((hash: Hex) => client.getTransaction({ hash }), RPS);
const fetchReceipt = rateLimited((hash: Hex) => client.getTransactionReceipt({ hash }), RPS);
const store = txFeeWriter(db);

let done = 0;
let failed = 0;
for (const c of picked) {
  try {
    const [tx, receipt] = await Promise.all([fetchTx(c.tx), fetchReceipt(c.tx)]);
    store({
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
const total = countTxFees(db);
console.log(`fees: stored ${done}, failed ${failed}; TxFee now holds ${total} transactions`);
