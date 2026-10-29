// `pnpm index:verify`: does the index match the chain? Read-only, so it runs beside `pnpm index
// --watch`. Compares the live count with arkiv_getEntityCount, and with `--attrs N` spot-checks the
// names, types and values of N decoded live entities against getEntity (this spends the anonymous
// `arkiv_query` budget). Values are normalized as the indexer stores them (addresses lowercased).
import { attempt, createArkivClient } from "@arkiv-agent/core";
import { countAliveAt, createIndexStore, entityAttributes, openSqlite, sampleDecodedKeys } from "@arkiv-agent/db";
import type { Hex } from "viem";
import { attributeDiff } from "./attributes.ts";

const client = createArkivClient();
const db = openSqlite();
const indexed = createIndexStore(db).readState()?.indexedBlock ?? 0n;
const [chainCount, head] = await Promise.all([client.getEntityCount(), client.getBlockNumber()]);
const indexLive = countAliveAt(indexed, db);
const diff = indexLive - chainCount;
console.log(`chain arkiv_getEntityCount ${chainCount} at head ${head}; index live ${indexLive} at block ${indexed} (${head - indexed} behind)`);
console.log(`difference ${diff} (${((Math.abs(diff) / chainCount) * 100).toFixed(3)}%); expected within the ~${(head - indexed) * 3n} writes/expiries of the lag`);
if (head - indexed > 30n) console.log("the index is behind: run `pnpm index` (or keep `pnpm index --watch` running) and verify again");

const sample = Number(process.argv[process.argv.indexOf("--attrs") + 1] ?? 0);
if (process.argv.includes("--attrs") && sample > 0) {
  const keys = sampleDecodedKeys(sample, db) as Hex[];
  let matched = 0;
  for (const key of keys) {
    const r = await attempt(() => client.getEntity(key));
    if (!r.ok) { console.log(`  ${key.slice(0, 12)}… getEntity failed: ${r.error.message.slice(0, 100)}`); continue; }
    const { chainOnly, indexOnly } = attributeDiff(r.value as Parameters<typeof attributeDiff>[0], entityAttributes(key, db));
    const isSame = chainOnly.length === 0 && indexOnly.length === 0;
    matched += isSame ? 1 : 0;
    console.log(`  ${key.slice(0, 12)}… ${isSame ? "match" : `MISMATCH chain only [${chainOnly}] index only [${indexOnly}]`}`);
  }
  console.log(`attributes: ${matched}/${keys.length} entities match the chain's attribute names, types and values`);
}
