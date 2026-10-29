import Database from "better-sqlite3";
import { databasePath } from "./path.ts";
import type { Sqlite } from "./sqlite.ts";

let connection: Sqlite | null = null;

/** The app's one read-only connection, per process; the indexer writes through its own (openSqlite). */
export function readDb(): Sqlite {
  if (!connection) {
    connection = new Database(databasePath(), { readonly: true, fileMustExist: true });
    connection.pragma("busy_timeout = 5000");
  }
  return connection;
}
