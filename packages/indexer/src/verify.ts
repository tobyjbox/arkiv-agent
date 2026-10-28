// `pnpm index:verify`: does the index match the chain? Compares the live count with
// arkiv_getEntityCount at (nearly) the same block, and with `--attrs N` spot-checks N decoded
// live entities against getEntity (this spends the anonymous `arkiv_query` budget).
import { attempt, createArkivClient } from "@arkiv-agent/core";
import { openSqlite } from "@arkiv-agent/db";
import type { Hex } from "viem";
import { createStore } from "./store.ts";
import { openChain, syncEvents } from "./sync.ts";

const client = createArkivClient();
const db = openSqlite();
const store = createStore(db);
await syncEvents(client, store, await openChain(client, store));
const indexed = store.readState()!.indexedBlock;
const [chainCount, head] = await Promise.all([client.getEntityCount(), client.getBlockNumber()]);
const liveAt = (block: bigint) =>
  Number((db.prepare(`SELECT COUNT(*) AS n FROM "Entity" WHERE status != 'deleted' AND createdAtBlock <= ? AND expiresAt > ?`).get(block, block) as { n: number }).n);
const indexLive = liveAt(indexed);
const diff = indexLive - chainCount;
console.log(`chain arkiv_getEntityCount ${chainCount} at head ${head}; index live ${indexLive} at block ${indexed} (${head - indexed} behind)`);
console.log(`difference ${diff} (${((Math.abs(diff) / chainCount) * 100).toFixed(3)}%); expected within the ~${(head - indexed) * 3n} writes/expiries of the lag`);

const sample = Number(process.argv[process.argv.indexOf("--attrs") + 1] ?? 0);
if (process.argv.includes("--attrs") && sample > 0) {
  const keys = db.prepare(`SELECT key FROM "Entity" WHERE status = 'live' AND decodedBlock > 0 ORDER BY random() LIMIT ?`).pluck().all(sample) as Hex[];
  const attrs = db.prepare(`SELECT name, type, value FROM "Attribute" WHERE entityKey = ? ORDER BY name`);
  let matched = 0;
  for (const key of keys) {
    const r = await attempt(() => client.getEntity(key));
    if (!r.ok) { console.log(`  ${key.slice(0, 12)}… getEntity failed: ${r.error.message.slice(0, 100)}`); continue; }
    const chain = Object.entries(r.value.attributes ?? {}).map(([name, v]) => `${name}:${(v as { type: string }).type}`).sort();
    const ours = (attrs.all(key) as { name: string; type: string }[]).map((a) => `${a.name}:${a.type}`);
    const isSame = chain.join() === ours.join();
    matched += isSame ? 1 : 0;
    console.log(`  ${key.slice(0, 12)}… ${isSame ? "match" : `MISMATCH chain [${chain}] index [${ours}]`}`);
  }
  console.log(`attributes: ${matched}/${keys.length} entities match the chain's attribute names and types`);
}
