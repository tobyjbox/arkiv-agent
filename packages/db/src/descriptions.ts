import Database from "better-sqlite3";
import { databasePath } from "./path.ts";
import { readDb } from "./read.ts";
import type { Sqlite } from "./sqlite.ts";

/** A cached AI dataset description (DatasetDescription). */
export type DescriptionRow = {
  datasetId: string; schemaHash: string; summary: string; likelyUse: string; suggestedName: string | null;
  model: string; inputs: string; createdAtMs: number;
};

/** Every cached description. Throws when the table isn't migrated yet (`pnpm index` applies migrations). */
export function readDescriptionRows(db: Sqlite = readDb()): DescriptionRow[] {
  const rows = db.prepare(`SELECT * FROM "DatasetDescription"`).all() as (Omit<DescriptionRow, "createdAtMs"> & { createdAtMs: number | bigint })[];
  return rows.map((r) => ({ ...r, createdAtMs: Number(r.createdAtMs) }));
}

let writer: Sqlite | null = null;

/** Stores a description, replacing the dataset's previous one. The app's only write to the index. */
export function writeDescription(d: DescriptionRow): void {
  writer ??= new Database(databasePath(), { fileMustExist: true });
  writer.pragma("busy_timeout = 5000");
  writer.prepare(`INSERT INTO "DatasetDescription" (datasetId, schemaHash, summary, likelyUse, suggestedName, model, inputs, createdAtMs)
    VALUES (@datasetId, @schemaHash, @summary, @likelyUse, @suggestedName, @model, @inputs, @createdAtMs)
    ON CONFLICT(datasetId) DO UPDATE SET schemaHash = excluded.schemaHash, summary = excluded.summary, likelyUse = excluded.likelyUse,
      suggestedName = excluded.suggestedName, model = excluded.model, inputs = excluded.inputs, createdAtMs = excluded.createdAtMs`).run(d);
}
