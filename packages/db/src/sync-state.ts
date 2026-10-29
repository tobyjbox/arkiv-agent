import { readDb } from "./read.ts";
import type { Sqlite } from "./sqlite.ts";

/** The index cursor: the last indexed block, the chain head it saw, and when it last synced (ms). */
export type Cursor = { indexedBlock: number; chainHead: number; syncedAtMs: number };

/** The cursor, or null before the first sync. */
export function readCursor(db: Sqlite = readDb()): Cursor | null {
  const s = db.prepare(`SELECT indexedBlock, chainHead, syncedAtMs FROM "SyncState" WHERE id = 1`).safeIntegers().get() as
    { indexedBlock: bigint; chainHead: bigint; syncedAtMs: bigint } | undefined;
  return s ? { indexedBlock: Number(s.indexedBlock), chainHead: Number(s.chainHead), syncedAtMs: Number(s.syncedAtMs) } : null;
}
