import { dayOf } from "./entities.ts";
import { readDb } from "./read.ts";
import type { Sqlite } from "./sqlite.ts";

/** Updates (patches) per UTC day and the record owner's wallet (lowercased); see dailyCreates. */
export function dailyUpdates(blockZeroMs: number, db: Sqlite = readDb()): { day: number; wallet: string; writes: number }[] {
  return db.prepare(`SELECT ${dayOf("p.block")} AS day, lower(e.owner) AS wallet, COUNT(*) AS writes FROM "Patch" p JOIN "Entity" e ON e.key = p.entityKey GROUP BY day, wallet`).all(blockZeroMs) as
    { day: number; wallet: string; writes: number }[];
}

/** Updates per record owner's wallet (lowercased) since `sinceBlock`. */
export function updatesByWallet(sinceBlock: number, db: Sqlite = readDb()): { w: string; n: number }[] {
  return db.prepare(`SELECT lower(e.owner) AS w, COUNT(*) AS n FROM "Patch" p JOIN "Entity" e ON e.key = p.entityKey WHERE p.block >= ? GROUP BY w`).all(sinceBlock) as { w: string; n: number }[];
}
