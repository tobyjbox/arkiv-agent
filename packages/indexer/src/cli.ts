// `pnpm index` syncs once and exits; `pnpm index --watch` keeps following the chain head.
// Both are safe to stop at any point (Ctrl-C) and resume.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createArkivClient } from "@arkiv-agent/core";
import { countLive, createIndexStore, databasePath, openSqlite } from "@arkiv-agent/db";
import type { Hex } from "viem";
import { stateFromSdk } from "./attributes.ts";
import { createEnricher, rateLimited } from "./enrich.ts";
import { acquireIndexerLock, migrate } from "./lock.ts";
import { feedFloor, openChain, syncEvents } from "./sync.ts";

const isWatch = process.argv.includes("--watch");
const TICK_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;
/** Recent history that gets attributes (activity charts): 7 days of 2 s blocks. */
const HISTORY_BLOCKS = 7n * 43_200n;
/** Public RPC allows 600 requests/min; leave headroom for sync. Raise with an access key. */
const RPS = Number(process.env.ARKIV_RPS) || (process.env.ARKIV_API_KEY ? 25 : 8);

mkdirSync(dirname(databasePath()), { recursive: true });
acquireIndexerLock(databasePath());
migrate();
const client = createArkivClient();
const db = openSqlite();
const store = createIndexStore(db);
const enricher = createEnricher(db, rateLimited(async (hash: Hex) => (await client.getTransaction({ hash })).input, RPS), {
  current: rateLimited(async (key: Hex) => {
    const entity = await client.getEntity(key).catch(() => null);
    return entity ? stateFromSdk(entity as Parameters<typeof stateFromSdk>[0]) : null;
  }, RPS),
});
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
  if (r.to >= r.from && !isQuiet) console.log(`synced ${r.from}..${r.to}: ${r.events} events in ${secondsSince(started)}s`);
  return r;
}

/** Decodes attributes in batches; returns how many entities it handled. */
async function enrich(maxBatches: number, batchSize: number): Promise<number> {
  const indexed = store.readState()?.indexedBlock ?? 0n;
  const since = indexed > HISTORY_BLOCKS ? indexed - HISTORY_BLOCKS : 0n;
  const total = maxBatches > 1 ? enricher.pendingCount(since) : batchSize;
  if (total === 0) return 0;
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
  return done;
}

if (!isWatch) {
  // Decoding can take a while on the public RPC; a second pass catches up the blocks it took.
  for (const isQuiet of [false, true]) {
    await syncTick(isQuiet);
    await enrich(Number.POSITIVE_INFINITY, 200);
  }
  console.log("done");
} else {
  // Two loops: sync keeps the feed within a tick of the head; decoding drains its queue alongside.
  const loop = async (name: string, step: () => Promise<boolean>) => {
    let backoff = TICK_MS;
    for (;;) {
      try {
        const isBusy = await step();
        backoff = TICK_MS;
        if (isBusy) continue;
      } catch (error) {
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        console.error(`${name} failed, retrying in ${backoff / 1000}s:`, error instanceof Error ? error.message : error);
      }
      await new Promise((r) => setTimeout(r, backoff));
    }
  };
  const STATUS_MS = 30_000;
  const status = () => {
    const s = store.readState();
    const indexed = s?.indexedBlock ?? 0n;
    const live = countLive(db);
    const queue = enricher.pendingCount(indexed > HISTORY_BLOCKS ? indexed - HISTORY_BLOCKS : 0n);
    console.log(`${new Date().toISOString()} head ${s?.chainHead} · indexed ${indexed} · ${live} live · ${queue} to decode`);
  };
  status();
  setInterval(status, STATUS_MS);
  let decodedSinceStatus = 0;
  /** A decode batch should take seconds; past this it is treated as hung, logged and retried. */
  const BATCH_LIMIT_MS = 60_000;
  const decodeStep = async () => {
    let timer: NodeJS.Timeout | undefined;
    const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`decode batch took over ${BATCH_LIMIT_MS / 1000}s`)), BATCH_LIMIT_MS); });
    try {
      const n = await Promise.race([enrich(1, 50), limit]);
      decodedSinceStatus += n;
      return n > 0;
    } finally {
      clearTimeout(timer);
    }
  };
  setInterval(() => {
    console.log(`  decoded ${decodedSinceStatus} in the last ${STATUS_MS / 1000}s`);
    decodedSinceStatus = 0;
  }, STATUS_MS);
  await Promise.all([
    loop("sync", async () => (await syncTick(true), false)),
    loop("decode", decodeStep),
  ]);
}
