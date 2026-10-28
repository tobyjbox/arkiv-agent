// `pnpm index` syncs once and exits; `pnpm index --watch` keeps following the chain head.
// Both are safe to stop at any point (Ctrl-C) and resume.
import { createArkivClient } from "@arkiv-agent/core";
import { databasePath, openSqlite } from "@arkiv-agent/db";
import type { Hex } from "viem";
import { createEnricher, rateLimited } from "./enrich.ts";
import { createStore, feedFloor } from "./store.ts";
import { openChain, syncEvents } from "./sync.ts";

const isWatch = process.argv.includes("--watch");
const TICK_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;
/** Recent history that gets attributes (activity charts): 7 days of 2 s blocks. */
const HISTORY_BLOCKS = 7n * 43_200n;
/** Public RPC allows 600 requests/min; leave headroom for sync. Raise with an access key. */
const RPS = Number(process.env.ARKIV_RPS ?? (process.env.ARKIV_API_KEY ? 25 : 8));

const client = createArkivClient();
const db = openSqlite();
const store = createStore(db);
const enricher = createEnricher(db, rateLimited(async (hash: Hex) => (await client.getTransaction({ hash })).input, RPS));
const startState = await openChain(client, store);
console.log(`index ${databasePath()} at block ${startState.indexedBlock}, decoding at ${RPS} req/s`);

const secondsSince = (t: number) => ((performance.now() - t) / 1000).toFixed(0);

async function syncTick(isQuiet: boolean) {
  const started = performance.now();
  let lastLog = 0;
  const r = await syncEvents(client, store, store.readState() ?? startState, ({ to, target, events }) => {
    if (isQuiet || performance.now() - lastLog < 2_000) return;
    lastLog = performance.now();
    console.log(`  block ${to} / ${target} · ${events} events · ${secondsSince(started)}s`);
  });
  if (r.to >= r.from && (!isQuiet || r.events > 0)) console.log(`synced ${r.from}..${r.to}: ${r.events} events in ${secondsSince(started)}s`);
  return r;
}

/** Decodes attributes in batches; `maxBatches` bounds a watch tick so the feed stays fresh. */
async function enrich(maxBatches: number, batchSize: number) {
  const indexed = store.readState()?.indexedBlock ?? 0n;
  const since = indexed > HISTORY_BLOCKS ? indexed - HISTORY_BLOCKS : 0n;
  const total = enricher.pendingCount(since);
  if (total === 0) return;
  const started = performance.now();
  let done = 0;
  for (let i = 0; i < maxBatches; i++) {
    const r = await enricher.run(since, batchSize, feedFloor(indexed));
    done += r.written + r.failed;
    if (r.written + r.failed === 0) break;
    if (maxBatches > 1) {
      const rate = done / Math.max(1, (performance.now() - started) / 1000);
      console.log(`  attributes ${done} / ${total} · ${r.failed} undecodable · ~${Math.ceil((total - done) / rate / 60)} min left`);
    }
  }
}

if (!isWatch) {
  await syncTick(false);
  await enrich(Number.POSITIVE_INFINITY, 200);
  console.log("done");
} else {
  let backoff = TICK_MS;
  for (;;) {
    try {
      await syncTick(true);
      await enrich(1, 25);
      backoff = TICK_MS;
    } catch (error) {
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      console.error(`sync failed, retrying in ${backoff / 1000}s:`, error instanceof Error ? error.message : error);
    }
    await new Promise((r) => setTimeout(r, backoff));
  }
}
