// Spike check 3 (no wallet): do fees depend on lifetime? Fit observed receipts of create-only
// transactions: gas fee (gasUsed x price) and the node's separate `rentFee`, against lifetime
// (expiresAt - block) and calldata size. Read-only, and eth_* only: `arkiv_query` has its own
// small anonymous budget, so this check leaves it alone.
import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk";
import { ARKIV_ADDRESS, createArkivClient } from "@arkiv-agent/core";
import type { Hex } from "viem";
import { writeReport } from "./report.ts";

const client = createArkivClient();
const head = await client.getBlockNumber();
const WINDOWS = [head - 600n, head - 50_000n, head - 200_000n, head - 500_000n].filter((b) => b > 0n);
const MAX_TX_PER_WINDOW = 60;

type Row = { tx: Hex; block: bigint; from: Hex; creates: number; lifetime: bigint; calldata: number;
  gasUsed: bigint; gasPrice: bigint; gasFee: bigint; rentFee: bigint | null };
const rows: Row[] = [];

for (const from of WINDOWS) {
  const logs = await client.getLogs({ address: ARKIV_ADDRESS, events: ENTITY_EVENTS_ABI, fromBlock: from, toBlock: from + 600n });
  const byTx = Map.groupBy(logs, (l) => l.transactionHash);
  // Create-only transactions, spread across senders' txs rather than the first N.
  const createOnly = [...byTx].filter(([, ls]) => ls.every((l) => l.eventName === "EntityCreated"));
  const step = Math.max(1, Math.floor(createOnly.length / MAX_TX_PER_WINDOW));
  const picked = createOnly.filter((_, i) => i % step === 0).slice(0, MAX_TX_PER_WINDOW);
  console.log(`window ${from}: ${logs.length} logs, ${byTx.size} txs, ${createOnly.length} create-only, sampling ${picked.length}`);
  for (let i = 0; i < picked.length; i += 8) {
    rows.push(...(await Promise.all(picked.slice(i, i + 8).map(async ([hash, ls]) => {
      const [tx, receipt] = await Promise.all([client.getTransaction({ hash }), client.getTransactionReceipt({ hash })]);
      const raw = receipt as unknown as Record<string, unknown>;
      const created = ls.flatMap((l) => (l.eventName === "EntityCreated" ? [l.args] : []));
      const lifetime = created.reduce((s, a) => s + (a.expiresAt ?? 0n) - receipt.blockNumber, 0n) / BigInt(created.length);
      return {
        tx: hash, block: receipt.blockNumber, from: tx.from, creates: created.length, lifetime,
        calldata: (tx.input.length - 2) / 2,
        gasUsed: receipt.gasUsed, gasPrice: receipt.effectiveGasPrice,
        gasFee: receipt.gasUsed * receipt.effectiveGasPrice,
        rentFee: raw.rentFee === undefined || raw.rentFee === null ? null : BigInt(raw.rentFee as string | bigint),
      };
    }))));
  }
}

const withRent = rows.filter((r) => r.rentFee !== null);
const corr = (xs: number[], ys: number[]) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0);
  const sx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0)), sy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return sx && sy ? Math.round((cov / (sx * sy)) * 1000) / 1000 : null;
};
const num = (b: bigint) => Number(b);
const summary = {
  head, windows: WINDOWS, sampled: rows.length, withRentFee: withRent.length,
  distinctSenders: new Set(rows.map((r) => r.from)).size,
  distinctLifetimes: new Set(rows.map((r) => r.lifetime)).size,
  lifetimeBlocks: { min: rows.reduce((m, r) => (r.lifetime < m ? r.lifetime : m), rows[0]?.lifetime ?? 0n), max: rows.reduce((m, r) => (r.lifetime > m ? r.lifetime : m), 0n) },
  gasUsed: { min: rows.reduce((m, r) => (r.gasUsed < m ? r.gasUsed : m), rows[0]?.gasUsed ?? 0n), max: rows.reduce((m, r) => (r.gasUsed > m ? r.gasUsed : m), 0n) },
  gasPrices: [...new Set(rows.map((r) => r.gasPrice))].slice(0, 10),
  corr: {
    gasFeeVsLifetime: corr(rows.map((r) => num(r.lifetime)), rows.map((r) => num(r.gasFee))),
    gasFeeVsCalldata: corr(rows.map((r) => r.calldata), rows.map((r) => num(r.gasFee))),
    gasUsedVsLifetime: corr(rows.map((r) => num(r.lifetime)), rows.map((r) => num(r.gasUsed))),
    gasUsedVsCalldata: corr(rows.map((r) => r.calldata), rows.map((r) => num(r.gasUsed))),
    rentVsLifetime: withRent.length > 2 ? corr(withRent.map((r) => num(r.lifetime)), withRent.map((r) => num(r.rentFee!))) : null,
    rentVsBytesTimesLifetime: withRent.length > 2 ? corr(withRent.map((r) => r.calldata * num(r.lifetime)), withRent.map((r) => num(r.rentFee!))) : null,
  },
};
console.log(JSON.stringify(summary, (_, v) => (typeof v === "bigint" ? v.toString() : v), 1));
console.log("wrote", await writeReport("fees", { summary, rows }));
