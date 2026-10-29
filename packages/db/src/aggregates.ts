import { readDb } from "./read.ts";
import type { Sqlite } from "./sqlite.ts";

/** A result the indexer stored for the pages, with the index block and time it was computed at. */
export type Stored<T> = { value: T; indexedBlock: number; computedAtMs: number };

/** A stored result, or null until the indexer has computed it (or added the table: it migrates when it starts). */
export function readAggregate<T>(key: string, db: Sqlite = readDb()): Stored<T> | null {
  let row: { value: string; indexedBlock: number; computedAtMs: number } | undefined;
  try {
    row = db.prepare(`SELECT value, indexedBlock, computedAtMs FROM "Aggregate" WHERE key = ?`).get(key) as typeof row;
  } catch (error) {
    if (error instanceof Error && /no such table/.test(error.message)) return null;
    throw error;
  }
  return row ? { value: JSON.parse(row.value) as T, indexedBlock: Number(row.indexedBlock), computedAtMs: Number(row.computedAtMs) } : null;
}

/** Stores results in one transaction, so a page never reads half of a refresh. */
export function writeAggregates(entries: Iterable<readonly [key: string, value: unknown]>, indexedBlock: number, db: Sqlite): void {
  const put = db.prepare(`INSERT INTO "Aggregate" (key, value, indexedBlock, computedAtMs) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, indexedBlock = excluded.indexedBlock, computedAtMs = excluded.computedAtMs`);
  const now = Date.now();
  db.transaction(() => {
    for (const [key, value] of entries) put.run(key, JSON.stringify(value), indexedBlock, now);
  })();
}
