import { existsSync, renameSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import Database from "better-sqlite3";

/** The pnpm workspace root, found by walking up from the current directory. */
export function repoRoot(from = process.cwd()): string {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    if (dirname(dir) === dir) throw new Error(`No pnpm-workspace.yaml above ${from}`);
  }
}

const DEFAULT_FILE = "arkiv-agent.db";
/** The index's name before the project was renamed. Kept only to move an existing index once. */
const LEGACY_FILE = "arkiv-agent.db";
const LEGACY_URL = `file:./data/${LEGACY_FILE}`;

const warned = new Set<string>();
const warnOnce = (message: string) => {
  if (!warned.has(message)) console.warn(message);
  warned.add(message);
};

/**
 * Absolute SQLite path: DATABASE_URL (`file:` path, relative to the repo root) or data/arkiv-agent.db.
 * A DATABASE_URL naming the old default (data/arkiv-agent.db, from an older .env) counts as the default.
 */
export function databasePath(): string {
  const root = repoRoot();
  try {
    process.loadEnvFile(join(root, ".env"));
  } catch {
    // no .env: defaults apply
  }
  const url = process.env.DATABASE_URL;
  if (url === LEGACY_URL) warnOnce(`DATABASE_URL in .env names the old ${LEGACY_URL}; using the default, file:./data/${DEFAULT_FILE}. Update or remove that line.`);
  if (!url || url === LEGACY_URL) return defaultDatabase(join(root, "data"));
  const raw = url.replace(/^file:/, "");
  return raw === ":memory:" || isAbsolute(raw) ? raw : join(root, raw);
}

export const databaseUrl = () => `file:${databasePath()}`;

const resolved = new Map<string, string>();
/** Connections that keep an old index from being moved while this process uses it. */
const pins: Database.Database[] = [];

/**
 * `dir`/arkiv-agent.db. An index from before the rename (`dir`/arkiv-agent.db) is moved there once, by the
 * first process that finds nothing else using it. Moving a database another process has open breaks
 * that process's writes (SQLITE_READONLY_DBMOVED), so the check is SQLite's own: leaving WAL mode
 * fails with SQLITE_BUSY while any other connection is open, and on success folds the -wal file into
 * the database, leaving one file to move. While it's in use, the old file is used where it is, and
 * the move happens on a later start; meanwhile this process holds a connection on it, so nobody moves it
 * from under us. The answer is fixed per process, so a process never switches files.
 */
export function defaultDatabase(dir: string): string {
  const cached = resolved.get(dir);
  if (cached) return cached;
  const current = join(dir, DEFAULT_FILE);
  const legacy = join(dir, LEGACY_FILE);
  let path = current;
  if (!existsSync(current) && existsSync(legacy)) {
    let isFree = false;
    try {
      const db = new Database(legacy, { fileMustExist: true });
      try {
        isFree = db.pragma("journal_mode = DELETE", { simple: true }) === "delete";
      } finally {
        db.close();
      }
    } catch {
      // SQLITE_BUSY: another process has it open
    }
    if (isFree) {
      try {
        renameSync(legacy, current);
        // Back to WAL while nothing else has it open, as the indexer left it.
        const db = new Database(current, { fileMustExist: true });
        db.pragma("journal_mode = WAL");
        db.close();
        console.warn(`Moved the index from ${legacy} to ${current} (a one-time rename).`);
      } catch {
        // another process moved it first
      }
    }
    if (existsSync(legacy) && !existsSync(current)) {
      path = legacy;
      const pin = new Database(legacy, { readonly: true, fileMustExist: true });
      pin.prepare("SELECT count(*) FROM sqlite_master").get();
      pins.push(pin);
      warnOnce(`The index is still at ${legacy} because another process has it open. Stop the indexer and the app, then start them again: the first to start moves it to ${current}.`);
    }
  }
  resolved.set(dir, path);
  return path;
}
