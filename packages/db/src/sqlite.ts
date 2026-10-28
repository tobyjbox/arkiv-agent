import Database from "better-sqlite3";
import { databasePath } from "./path.ts";

/** Raw connection for the indexer's bulk writes. WAL lets the app read while the indexer writes. */
export function openSqlite(path = databasePath()) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  return db;
}

export type Sqlite = ReturnType<typeof openSqlite>;
