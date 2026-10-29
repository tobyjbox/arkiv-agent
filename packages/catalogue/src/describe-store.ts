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
  | { status: "no-key" | "not-found" | "failed" | "skipped" };

const HOUR_MS = 3_600_000;

/**
 * Failed descriptions back off per dataset and schema: 1 h, doubling up to a day. Without it a
 * dataset crafted to make the model refuse would cost a call on every page view. In memory: a
 * restart allows one more try.
 */
export function createFailureBackoff(now = () => Date.now(), baseMs = HOUR_MS, maxMs = 24 * HOUR_MS) {
  const failures = new Map<string, { hash: string; count: number; until: number }>();
  return {
    isWaiting: (id: string, hash: string) => {
      const f = failures.get(id);
      return f !== undefined && f.hash === hash && now() < f.until;
    },
    failed: (id: string, hash: string) => {
      const prev = failures.get(id);
      const count = prev?.hash === hash ? prev.count + 1 : 1;
      failures.set(id, { hash, count, until: now() + Math.min(maxMs, baseMs * 2 ** (count - 1)) });
    },
    succeeded: (id: string) => failures.delete(id),
  };
}

const backoff = createFailureBackoff();
const inFlight = new Map<string, Promise<DescriptionState>>();

/**
 * The cached description, or a fresh one when the schema changed (one request per dataset at a
 * time). `allowNew: false` returns only what is cached: pages loaded from another site pass it,
 * so a link or embed elsewhere can't spend the key.
 */
export function getOrCreateDescription(id: string, client?: DescribeClient, { allowNew = true }: { allowNew?: boolean } = {}): Promise<DescriptionState> {
  const detail = getDataset(id);
  if (!detail) return Promise.resolve({ status: "not-found" });
  const cached = readDescriptions().get(id);
  const hash = schemaHash(detail.dataset);
  if (cached && cached.schemaHash === hash) return Promise.resolve({ status: "ready", description: cached });
  if (!hasApiKey()) return Promise.resolve(cached ? { status: "ready", description: cached } : { status: "no-key" });
  if (!allowNew) return Promise.resolve(cached ? { status: "ready", description: cached } : { status: "skipped" });
  if (backoff.isWaiting(id, hash)) return Promise.resolve(cached ? { status: "ready", description: cached } : { status: "failed" });

  const pending = inFlight.get(id) ?? (async (): Promise<DescriptionState> => {
    try {
      const description = await describeDataset(detail.dataset, recentRecords(id, SAMPLE_COUNT), client);
      if (!description) {
        backoff.failed(id, hash);
        return { status: "failed" };
      }
      write(description);
      backoff.succeeded(id);
      return { status: "ready", description };
    } catch (error) {
      console.error(`describe ${id} failed:`, error instanceof Error ? error.message : error);
      backoff.failed(id, hash);
      return { status: "failed" };
    } finally {
      inFlight.delete(id);
    }
  })();
  inFlight.set(id, pending);
  return pending;
}
