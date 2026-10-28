import Database from "better-sqlite3";
import { databasePath } from "@arkiv-agent/db";
import { buildDatasets, hourlySeries, type Member } from "./build.ts";
import type { Attr } from "./infer.ts";
import type { Catalogue } from "./types.ts";

/** History window that carries attributes in the index (T03 decodes 7 days). */
export const HISTORY_BLOCKS = 7 * 43_200;
/** High-volume owners, as in the indexer (packages/indexer/src/enrich.ts). */
const BUSY_OWNER_CREATES = 5_000;
const I64_MAX = 2n ** 63n - 1n;
/** Rebuild at most this often; the UI polls every 5 s. */
const MIN_REBUILD_MS = 4_000;

type Row = { key: string; owner: string; status: Member["status"]; createdAtBlock: bigint; updatedAtBlock: bigint; expiresAt: bigint; contentType: string | null; payloadBytes: bigint | null };

let connection: Database.Database | null = null;
/** One read-only connection per process; the indexer writes through its own. */
export const catalogueDb = () => db();
const db = (): Database.Database => {
  if (!connection) {
    connection = new Database(databasePath(), { readonly: true, fileMustExist: true });
    connection.pragma("busy_timeout = 5000");
  }
  return connection;
};

export type Loaded = Catalogue & { membersById: Map<string, Member[]> };
let cache: { stamp: string; at: number; value: Loaded } | null = null;

/** The whole catalogue, rebuilt when the index moves (and at most every few seconds). */
export function loadCatalogue(): Loaded {
  const d = db();
  const state = d.prepare(`SELECT indexedBlock, chainHead, syncedAtMs FROM "SyncState" WHERE id = 1`).safeIntegers().get() as
    { indexedBlock: bigint; chainHead: bigint; syncedAtMs: bigint } | undefined;
  const decoded = d.prepare(`SELECT MAX(decodedBlock) AS b, COUNT(decodedBlock) AS n FROM "Entity" WHERE decodedBlock > 0`).get() as { b: number | null; n: number };
  const stamp = `${state?.indexedBlock}:${decoded.n}:${decoded.b}`;
  if (cache && (cache.stamp === stamp || Date.now() - cache.at < MIN_REBUILD_MS)) return cache.value;

  const indexed = Number(state?.indexedBlock ?? 0n);
  const since = Math.max(0, indexed - HISTORY_BLOCKS);
  const scope = `e.decodedBlock > 0 AND (e.status = 'live' OR e.createdAtBlock >= ${since})`;
  const rows = d.prepare(`SELECT key, owner, status, createdAtBlock, updatedAtBlock, expiresAt, contentType, payloadBytes FROM "Entity" e WHERE ${scope}`).safeIntegers().all() as Row[];
  const attrs = new Map<string, Map<string, Attr>>();
  for (const a of d.prepare(`SELECT a.entityKey AS k, a.name AS n, a.type AS t, a.value AS v FROM "Attribute" a JOIN "Entity" e ON e.key = a.entityKey WHERE ${scope}`).iterate() as Iterable<{ k: string; n: string; t: Attr["type"]; v: string }>) {
    (attrs.get(a.k) ?? attrs.set(a.k, new Map()).get(a.k)!).set(a.n, { type: a.t, value: a.v });
  }
  const members: Member[] = rows.map((r) => ({
    key: r.key, owner: r.owner, status: r.status, createdAtBlock: Number(r.createdAtBlock), updatedAtBlock: Number(r.updatedAtBlock),
    expiresAt: r.expiresAt >= I64_MAX ? null : Number(r.expiresAt), contentType: r.contentType,
    payloadBytes: r.payloadBytes === null ? null : Number(r.payloadBytes), attrs: attrs.get(r.key) ?? new Map(),
  }));
  const busyOwners = new Set(d.prepare(`SELECT owner FROM "Entity" WHERE createdAtBlock >= ? GROUP BY owner HAVING COUNT(*) > ?`).pluck().all(since, BUSY_OWNER_CREATES) as string[]);
  const { datasets, membersById } = buildDatasets(members, { indexedBlock: indexed, busyOwners });

  const counts = d.prepare(`SELECT COUNT(*) AS live, SUM(decodedBlock IS NULL) AS undecoded FROM "Entity" WHERE status = 'live'`).get() as { live: number; undecoded: number | null };
  const recent = d.prepare(`SELECT createdAtBlock FROM "Entity" WHERE createdAtBlock > ? AND owner NOT IN (SELECT value FROM json_each(?))`).pluck().all(indexed - 24 * 1_800, JSON.stringify([...busyOwners])) as number[];
  const hourlyWrites24h = hourlySeries(recent, indexed, 24);
  const value: Loaded = {
    summary: {
      indexedBlock: indexed, chainHead: Number(state?.chainHead ?? 0n),
      syncedAt: state ? new Date(Number(state.syncedAtMs)).toISOString() : null,
      datasets: datasets.filter((x) => !x.isLoadGenerator).length,
      projects: new Set(datasets.filter((x) => !x.isLoadGenerator).map((x) => x.project.label)).size,
      liveRecords: counts.live, undecodedLive: counts.undecoded ?? 0,
      writes24h: hourlyWrites24h.reduce((a, b) => a + b, 0), hourlyWrites24h,
    },
    datasets, membersById,
  };
  cache = { stamp, at: Date.now(), value };
  return value;
}
