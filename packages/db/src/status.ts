import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { databasePath } from "./path.ts";

/** Tables the app reads. The indexer creates them (prisma migrate) when it starts. */
const TABLES = ["Entity", "Attribute", "Patch", "Change", "SyncState", "TxFee"];

/** `missing`: no file yet. `incomplete`: the file exists, but the first `pnpm index` hasn't set it up. */
export type IndexStatus = "ready" | "missing" | "incomplete";

const ready = new Set<string>();

/**
 * Whether the index exists and has every table, checked without creating the file: opening a missing
 * path read-write leaves an empty database behind. Once ready, a path stays ready for the process.
 */
export function indexStatus(path = databasePath()): IndexStatus {
  if (ready.has(path)) return "ready";
  if (path !== ":memory:" && !existsSync(path)) return "missing";
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const found = db.prepare(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (${TABLES.map(() => "?").join(", ")})`).pluck().get(...TABLES);
    if (found !== TABLES.length) return "incomplete";
    ready.add(path);
    return "ready";
  } finally {
    db.close();
  }
}
