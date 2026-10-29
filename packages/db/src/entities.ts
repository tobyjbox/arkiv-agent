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

/** Live records, and how many of them aren't decoded yet. */
export function liveCounts(db: Sqlite = readDb()): { live: number; undecoded: number } {
  const c = db.prepare(`SELECT COUNT(*) AS live, SUM(decodedBlock IS NULL) AS undecoded FROM "Entity" WHERE status = 'live'`).get() as { live: number; undecoded: number | null };
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
