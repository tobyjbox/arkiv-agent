import Database from "better-sqlite3";
import { databasePath } from "@arkiv-agent/db";
import { type Description, type DescribeClient, describeDataset, hasApiKey, SAMPLE_COUNT, schemaHash } from "./describe.ts";
import { getDataset, recentRecords } from "./detail.ts";
import { catalogueDb } from "./load.ts";

type Row = Omit<Description, "createdAtMs"> & { createdAtMs: number | bigint };

/** Cached descriptions whose schema still matches, by dataset id. Read on the shared read-only connection. */
export function readDescriptions(): Map<string, Description> {
  let rows: Row[];
  try {
    rows = catalogueDb().prepare(`SELECT * FROM "DatasetDescription"`).all() as Row[];
  } catch {
    return new Map(); // table not migrated yet: `pnpm index` applies migrations
  }
  return new Map(rows.map((r) => [r.datasetId, { ...r, createdAtMs: Number(r.createdAtMs) }]));
}

let writer: Database.Database | null = null;
const write = (d: Description) => {
  writer ??= new Database(databasePath(), { fileMustExist: true });
  writer.pragma("busy_timeout = 5000");
  writer.prepare(`INSERT INTO "DatasetDescription" (datasetId, schemaHash, summary, likelyUse, suggestedName, model, inputs, createdAtMs)
    VALUES (@datasetId, @schemaHash, @summary, @likelyUse, @suggestedName, @model, @inputs, @createdAtMs)
    ON CONFLICT(datasetId) DO UPDATE SET schemaHash = excluded.schemaHash, summary = excluded.summary, likelyUse = excluded.likelyUse,
      suggestedName = excluded.suggestedName, model = excluded.model, inputs = excluded.inputs, createdAtMs = excluded.createdAtMs`).run(d);
};

export type DescriptionState =
  | { status: "ready"; description: Description }
  | { status: "no-key" | "not-found" | "failed" };

const inFlight = new Map<string, Promise<DescriptionState>>();

/** The cached description, or a fresh one when the schema changed (one request per dataset at a time). */
export function getOrCreateDescription(id: string, client?: DescribeClient): Promise<DescriptionState> {
  const detail = getDataset(id);
  if (!detail) return Promise.resolve({ status: "not-found" });
  const cached = readDescriptions().get(id);
  if (cached && cached.schemaHash === schemaHash(detail.dataset)) return Promise.resolve({ status: "ready", description: cached });
  if (!hasApiKey()) return Promise.resolve(cached ? { status: "ready", description: cached } : { status: "no-key" });

  const pending = inFlight.get(id) ?? (async (): Promise<DescriptionState> => {
    try {
      const description = await describeDataset(detail.dataset, recentRecords(id, SAMPLE_COUNT), client);
      if (!description) return { status: "failed" };
      write(description);
      return { status: "ready", description };
    } catch (error) {
      console.error(`describe ${id} failed:`, error instanceof Error ? error.message : error);
      return { status: "failed" };
    } finally {
      inFlight.delete(id);
    }
  })();
  inFlight.set(id, pending);
  return pending;
}
