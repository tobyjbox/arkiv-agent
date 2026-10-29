import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { databasePath } from "./path.ts";

/** One close per interval, `t` = the interval's start (UTC ms). */
export type Candle = { t: number; close: number };
export type Interval = "4h" | "1d";

/** Where GLM/USD candles are kept between restarts, with which source answered each interval's last fetch, and when. */
export type CandleStore = {
  read(interval: Interval, since: number): Candle[];
  write(interval: Interval, candles: Candle[], fetched: { source: string; at: number }): void;
  /** The newest candle of the most recently fetched interval: its close was the price at that fetch. */
  latest(): { close: number; interval: Interval; source: string; at: number } | null;
};

/** A small SQLite file next to the index (the index itself stays the indexer's). */
export function openCandleStore(path = join(dirname(databasePath()), "glm-prices.db")): CandleStore {
  let db: Database.Database | null = null;
  const open = () => {
    if (db) return db;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.exec(`CREATE TABLE IF NOT EXISTS "GlmCandle" (interval TEXT NOT NULL, t INTEGER NOT NULL, close REAL NOT NULL, PRIMARY KEY (interval, t))`);
    db.exec(`CREATE TABLE IF NOT EXISTS "GlmFetch" (interval TEXT PRIMARY KEY, source TEXT NOT NULL, at INTEGER NOT NULL)`);
    return db;
  };
  return {
    read: (interval, since) => open().prepare(`SELECT t, close FROM "GlmCandle" WHERE interval = ? AND t >= ? ORDER BY t`).all(interval, since) as Candle[],
    write: (interval, candles, fetched) => {
      const upsert = open().prepare(`INSERT INTO "GlmCandle" (interval, t, close) VALUES (?, ?, ?) ON CONFLICT (interval, t) DO UPDATE SET close = excluded.close`);
      const note = open().prepare(`INSERT INTO "GlmFetch" (interval, source, at) VALUES (?, ?, ?) ON CONFLICT (interval) DO UPDATE SET source = excluded.source, at = excluded.at`);
      open().transaction(() => {
        for (const c of candles) upsert.run(interval, c.t, c.close);
        note.run(interval, fetched.source, fetched.at);
      })();
    },
    latest: () => (open().prepare(`
      SELECT c.close, f.interval, f.source, f.at FROM "GlmFetch" f JOIN "GlmCandle" c ON c.interval = f.interval
      ORDER BY f.at DESC, c.t DESC LIMIT 1`).get() as { close: number; interval: Interval; source: string; at: number } | undefined) ?? null,
  };
}
