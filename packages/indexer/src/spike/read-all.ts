// Spike check 1: can we page through every live entity, and how long does it take?
// `--full` also pulls attributes and payloads (what the indexer needs), else a light projection.
import { allLive, attempt, createArkivClient, PAGE_SIZE } from "@arkiv-agent/core";
import { seconds, tally, top, writeReport } from "./report.ts";

const isFull = process.argv.includes("--full");
const client = createArkivClient();

const [entityCount, head, timing] = await Promise.all([
  client.getEntityCount(),
  client.getBlockNumber(),
  client.getBlockTiming(),
]);
console.log(`head ${head}, arkiv_getEntityCount ${entityCount}, block time ${timing.blockDuration}s`);

const light = {
  owner: true, creator: true, createdAt: true, expiresAt: true, contentType: true, attributeSchema: true,
} as const;
const query = isFull
  ? client.select({ ...light, attributes: true, payload: true })
  : client.select(light);

const owners = new Map<string, number>();
const creators = new Map<string, number>();
const contentTypes = new Map<string, number>();
const signatures = new Map<string, number>();
const pageMs: number[] = [];
let seen = 0, payloadBytes = 0, remainingBlocks = 0n, readBlock = 0n, stoppedBy: string | null = null;
const started = performance.now();

// Pin the block: SDK 0.8.1 drops atBlock on next(), and the node rejects an unpinned cursor.
let page = await query.where(allLive(head)).atBlock(head).limit(PAGE_SIZE).fetch();
for (;;) {
  readBlock = page.blockNumber;
  for (const e of page.entities) {
    seen++;
    tally(owners, e.owner);
    tally(creators, e.creator);
    tally(contentTypes, e.contentType);
    tally(signatures, Object.entries(e.attributeSchema).map(([n, t]) => `${n}:${t}`).sort().join(","));
    if ("payload" in e && e.payload instanceof Uint8Array) payloadBytes += e.payload.length;
    remainingBlocks += e.expiresAt - readBlock;
  }
  if (seen % 5000 < PAGE_SIZE) console.log(`  ${seen} entities, ${seconds(started)}s`);
  if (!page.hasNextPage()) break;
  const t = performance.now();
  // The anonymous `arkiv_query` budget (HTTP 429 ANON_COST_LIMITED) can end a walk: record, stop.
  const next = await attempt(() => page.next());
  if (!next.ok) { stoppedBy = next.error.message.slice(0, 200); break; }
  page = next.value;
  pageMs.push(performance.now() - t);
}

const sorted = [...pageMs].sort((a, b) => a - b);
const result = {
  mode: isFull ? "full" : "light", head, readBlock, entityCount, seen, complete: stoppedBy === null, stoppedBy,
  pages: pageMs.length + 1, totalSeconds: seconds(started),
  pageMs: { p50: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * 0.95)] },
  owners: owners.size, creators: creators.size, signatures: signatures.size,
  payloadBytes, meanRemainingBlocks: seen ? Number(remainingBlocks / BigInt(seen)) : 0,
  topCreators: top(creators), topContentTypes: top(contentTypes), topSignatures: top(signatures, 15),
};
console.log(JSON.stringify({ ...result, topCreators: undefined, topSignatures: undefined }, null, 1));
console.log("wrote", await writeReport(`read-all-${result.mode}`, result));
