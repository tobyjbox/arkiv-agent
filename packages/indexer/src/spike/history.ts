// Spike check 2: how far back can we read? Block headers, receipts, entity logs, and
// `arkiv_query` at a past block (state history) are separate questions with separate answers.
import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk";
import { ARKIV_ADDRESS, attempt, createArkivClient } from "@arkiv-agent/core";
import { eq } from "@arkiv-network/sdk/query";
import { addr } from "@arkiv-network/sdk/attr";
import { writeReport } from "./report.ts";

const client = createArkivClient();
const head = await client.getBlockNumber();
const [genesis, first] = await Promise.all([client.getBlock({ blockNumber: 0n }), client.getBlock({ blockNumber: 1n })]);
const ageDays = (Number((await client.getBlock({ blockNumber: head })).timestamp) - Number(first.timestamp)) / 86_400;
console.log(`head ${head}; block 1 at ${new Date(Number(first.timestamp) * 1000).toISOString()} (${ageDays.toFixed(1)} days)`);

// State history: binary-search the oldest block `arkiv_query` will read at. A cheap, empty query.
const probe = (block: bigint) =>
  attempt(() => client.select({ key: true }).where(eq("$owner", addr("0x0000000000000000000000000000000000000001"))).atBlock(block).limit(1).fetch());
let lo = 1n, hi = head, firstError = "";
const atOne = await probe(1n);
if (!atOne.ok) {
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n;
    const r = await probe(mid);
    if (r.ok) hi = mid; else { lo = mid; firstError = r.error.message.slice(0, 160); }
  }
}
const oldestQueryBlock = atOne.ok ? 1n : hi;
console.log(`arkiv_query atBlock: oldest readable ${oldestQueryBlock} (${head - oldestQueryBlock} blocks back)`, firstError);

// Logs and receipts at several depths.
const depths = [1n, head / 4n, head / 2n, (head * 3n) / 4n, head - 2_000n];
const samples = [];
for (const from of depths) {
  const logs = await attempt(() => client.getLogs({ address: ARKIV_ADDRESS, events: ENTITY_EVENTS_ABI, fromBlock: from, toBlock: from + 999n }));
  const firstLog = logs.ok ? logs.value[0] : undefined;
  const receipt = firstLog ? await attempt(() => client.getTransactionReceipt({ hash: firstLog.transactionHash })) : undefined;
  const raw = receipt?.ok ? (receipt.value as unknown as Record<string, unknown>) : null;
  samples.push({
    fromBlock: from, logs: logs.ok ? logs.value.length : logs.error.message.slice(0, 120),
    events: logs.ok ? [...new Set(logs.value.map((l) => l.eventName))] : [],
    receipt: raw ? { ok: true, rentFee: raw.rentFee ?? null, gasUsed: raw.gasUsed, fields: Object.keys(raw) } : receipt?.ok === false ? receipt.error.message.slice(0, 120) : null,
  });
  console.log(samples.at(-1));
}

// Widest getLogs range the node accepts, for backfill batch sizing.
let maxRange = 0n;
for (const span of [1_000n, 5_000n, 10_000n, 50_000n, 100_000n]) {
  const r = await attempt(() => client.getLogs({ address: ARKIV_ADDRESS, fromBlock: head - span, toBlock: head }));
  console.log(`getLogs span ${span}: ${r.ok ? `${r.value.length} logs` : r.error.message.slice(0, 120)}`);
  if (!r.ok) break;
  maxRange = span;
}

console.log("wrote", await writeReport("history", {
  head, genesisHash: genesis.hash, block1Time: first.timestamp, ageDays, oldestQueryBlock, firstError, samples, maxGetLogsSpanTried: maxRange,
}));
