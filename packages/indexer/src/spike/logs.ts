// Spike check 1b: can we rebuild every entity's lifecycle from logs instead of `arkiv_query`?
// Times eth_getLogs over 5,000-block spans (the node rejects 10,000) sampled across history.
import { ARKIV_ADDRESS, createArkivClient } from "@arkiv-agent/core";
import { writeReport } from "./report.ts";

const client = createArkivClient();
const head = await client.getBlockNumber();
const SPAN = 5_000n, SAMPLES = 12;
let logs = 0, ms = 0;
for (let i = 0; i < SAMPLES; i++) {
  const from = (head * BigInt(i)) / BigInt(SAMPLES) + 1n;
  const t = performance.now();
  const page = await client.getLogs({ address: ARKIV_ADDRESS, fromBlock: from, toBlock: from + SPAN - 1n });
  const dt = performance.now() - t;
  ms += dt; logs += page.length;
  console.log(`from ${from}: ${page.length} logs in ${(dt / 1000).toFixed(2)}s`);
}
const calls = Number(head / SPAN) + 1;
const result = {
  head, span: SPAN, avgCallSeconds: +(ms / SAMPLES / 1000).toFixed(2), avgLogsPerCall: Math.round(logs / SAMPLES),
  callsForFullBackfill: calls, estBackfillMinutes: +(((ms / SAMPLES) * calls) / 60_000).toFixed(1),
  estTotalLogs: Math.round((logs / SAMPLES) * calls),
};
console.log(result);
console.log("wrote", await writeReport("logs", result));
