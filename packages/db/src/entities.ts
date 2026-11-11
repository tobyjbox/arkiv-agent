import { readDb } from "./read.ts";
import type { Sqlite } from "./sqlite.ts";

/** An entity row as the catalogue reads it; block numbers and sizes as SQLite's 64-bit integers. */
export type EntityRow = {
  key: string; owner: string; status: "live" | "expired" | "deleted";
  createdAtBlock: bigint; updatedAtBlock: bigint; expiresAt: bigint; contentType: string | null; payloadBytes: bigint | null;
};

/** The catalogue's scope: decoded entities that are live, or were created at or after `sinceBlock`. */
export const catalogueScope = (sinceBlock: number) => `e.decodedBlock > 0 AND (e.status = 'live' OR e.createdAtBlock >= ${Math.floor(sinceBlock)})`;

/** Entities in the catalogue's scope. */
export function catalogueEntities(sinceBlock: number, db: Sqlite = readDb()): EntityRow[] {
  return db.prepare(`SELECT key, owner, status, createdAtBlock, updatedAtBlock, expiresAt, contentType, payloadBytes FROM "Entity" e WHERE ${catalogueScope(sinceBlock)}`)
    .safeIntegers().all() as EntityRow[];
}

/** Owners with more than `minCreates` creates since `sinceBlock` (Arkiv's load generators). */
export function busyOwners(sinceBlock: number | bigint, minCreates: number, db: Sqlite = readDb()): string[] {
  return db.prepare(`SELECT owner FROM "Entity" WHERE createdAtBlock >= ? GROUP BY owner HAVING COUNT(*) > ?`).pluck().all(sinceBlock, minCreates) as string[];
}

/** Owners above this many creates in the decode window are load generators (the indexer's enrich.ts). */
export const BUSY_OWNER_CREATES = 5_000;

/**
 * Live records the decoder will get to, as its own queue sees them (decode-store.ts): load
 * generators' records count only for the 1 in 16 it samples (keys ending in 0), since it skips the rest.
 */
export const decodeWaitingScope = (busyOwners: Iterable<string>) => {
  const list = [...busyOwners].map((o) => `'${o.replace(/[^0-9a-fA-Fx]/g, "")}'`).join(",");
  return list ? `(e.key LIKE '%0' OR e.owner NOT IN (${list}))` : "1";
};

/** Live records, and how many of them the decoder still has to decode. */
export function liveCounts(busyOwners: Iterable<string> = [], db: Sqlite = readDb()): { live: number; undecoded: number } {
  const c = db.prepare(`SELECT COUNT(*) AS live, SUM(e.decodedBlock IS NULL AND ${decodeWaitingScope(busyOwners)}) AS undecoded
    FROM "Entity" e WHERE e.status = 'live'`).get() as { live: number; undecoded: number | null };
  return { live: c.live, undecoded: c.undecoded ?? 0 };
}

/** Live records (the indexer's status line). */
export function countLive(db: Sqlite = readDb()): number {
  return db.prepare(`SELECT COUNT(*) FROM "Entity" WHERE status = 'live'`).pluck().get() as number;
}

/** Records alive at `block`, for comparing with the chain's own count. */
export function countAliveAt(block: bigint, db: Sqlite = readDb()): number {
  return Number((db.prepare(`SELECT COUNT(*) AS n FROM "Entity" WHERE status != 'deleted' AND createdAtBlock <= ? AND expiresAt > ?`).get(block, block) as { n: number }).n);
}

/** `n` random decoded live entities, for spot checks. */
export function sampleDecodedKeys(n: number, db: Sqlite = readDb()): string[] {
  return db.prepare(`SELECT key FROM "Entity" WHERE status = 'live' AND decodedBlock > 0 ORDER BY random() LIMIT ?`).pluck().all(n) as string[];
}

/** Creation blocks after `afterBlock`, leaving out `excludeOwners`. */
export function createBlocksSince(afterBlock: number, excludeOwners: Iterable<string>, db: Sqlite = readDb()): number[] {
  return db.prepare(`SELECT createdAtBlock FROM "Entity" WHERE createdAtBlock > ? AND owner NOT IN (SELECT value FROM json_each(?))`)
    .pluck().all(afterBlock, JSON.stringify([...excludeOwners])) as number[];
}

/** Reads entities' stored payload previews, one key at a time. */
export function payloadPreviews(db: Sqlite = readDb()): (key: string) => string | null {
  const statement = db.prepare(`SELECT payloadPreview FROM "Entity" WHERE key = ?`).pluck();
  return (key) => (statement.get(key) as string | null | undefined) ?? null;
}

/** Writes per UTC day and creating wallet (lowercased); block times from `blockZeroMs` at 2 s a block. */
export function dailyCreates(blockZeroMs: number, db: Sqlite = readDb()): { day: number; wallet: string; writes: number }[] {
  return db.prepare(`SELECT ${dayOf("createdAtBlock")} AS day, lower(creator) AS wallet, COUNT(*) AS writes FROM "Entity" GROUP BY day, wallet`).all(blockZeroMs) as
    { day: number; wallet: string; writes: number }[];
}

/** Creates per creating wallet (lowercased) since `sinceBlock`, with their total payload bytes. */
export function createsByWallet(sinceBlock: number, db: Sqlite = readDb()): { w: string; n: number; bytes: number }[] {
  return db.prepare(`SELECT lower(creator) AS w, COUNT(*) AS n, SUM(COALESCE(payloadBytes, 0)) AS bytes FROM "Entity" WHERE createdAtBlock >= ? GROUP BY w`).all(sinceBlock) as
    { w: string; n: number; bytes: number }[];
}

const BLOCK_MS = 2_000;
const DAY_MS = 86_400_000;
/** The UTC day of a block column, given block 0's time as the first parameter. */
export const dayOf = (col: string) => `CAST((? + ${col} * ${BLOCK_MS}) / ${DAY_MS} AS INTEGER)`;

/** Owner and status of the given entity keys (any case), for those the index holds. */
export function entityStatuses(keys: readonly string[], db: Sqlite = readDb()): { key: string; owner: string; status: "live" | "expired" | "deleted" }[] {
  const statement = db.prepare(`SELECT key, owner, status FROM "Entity" WHERE key IN (SELECT value FROM json_each(?))`);
  const out: { key: string; owner: string; status: "live" | "expired" | "deleted" }[] = [];
  for (let i = 0; i < keys.length; i += 5_000) out.push(...(statement.all(JSON.stringify(keys.slice(i, i + 5_000))) as typeof out));
  return out;
}

export type RecordDetail = {
  key: string; owner: string; creator: string; status: "live" | "expired" | "deleted";
  createdAtBlock: number; createdTx: string; createdOp: number; updatedAtBlock: number; expiresAt: number; deletedAtBlock: number | null;
  contentType: string | null; payloadBytes: number | null; payloadPreview: string | null;
  attributes: { name: string; type: string; value: string }[];
  /** Later transactions that changed the record, oldest first. */
  patches: { block: number; tx: string; op: number }[];
  /** The create transaction's receipt, when the fee sampler has fetched it. */
  createFee: { sender: string; creates: number; updates: number; calldataBytes: number; gasUsed: number; gasPriceWei: string; feeWei: string } | null;
};

/** Everything the index holds about one record and the transaction that created it; null when it has no such record. */
export function recordDetail(key: string, db: Sqlite = readDb()): RecordDetail | null {
  const entity = db.prepare(`SELECT key, owner, creator, status, createdAtBlock, createdTx, createdOp, updatedAtBlock, expiresAt, deletedAtBlock, contentType, payloadBytes, payloadPreview FROM "Entity" WHERE key = ?`).get(key.toLowerCase()) as Omit<RecordDetail, "attributes" | "patches" | "createFee"> | undefined;
  if (!entity) return null;
  const attributes = db.prepare(`SELECT name, type, value FROM "Attribute" WHERE entityKey = ? ORDER BY name`).all(entity.key) as RecordDetail["attributes"];
  const patches = db.prepare(`SELECT block, tx, op FROM "Patch" WHERE entityKey = ? ORDER BY block, logIndex`).all(entity.key) as RecordDetail["patches"];
  const createFee = (db.prepare(`SELECT sender, creates, updates, calldataBytes, gasUsed, gasPriceWei, feeWei FROM "TxFee" WHERE tx = ?`).get(entity.createdTx) as RecordDetail["createFee"] | undefined) ?? null;
  return { ...entity, attributes, patches, createFee };
}
