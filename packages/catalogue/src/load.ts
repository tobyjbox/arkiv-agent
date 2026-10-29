import { busyOwners as readBusyOwners, catalogueAttributes, catalogueEntities, createBlocksSince, liveCounts, readCursor } from "@arkiv-agent/db";
import { buildDatasets, hourlySeries, type Member } from "./build.ts";
import type { Attr } from "./infer.ts";
import type { Catalogue } from "./types.ts";

/** History window that carries attributes in the index (T03 decodes 7 days). */
export const HISTORY_BLOCKS = 7 * 43_200;
/** High-volume owners, as in the indexer (packages/indexer/src/enrich.ts). */
const BUSY_OWNER_CREATES = 5_000;
const I64_MAX = 2n ** 63n - 1n;
/** Rebuild at most this often; the UI polls every 5 s and shows the index block it is from. */
const MIN_REBUILD_MS = 10_000;
/** High-volume owners change slowly and the query scans a week of creates (~1.7 s): cache it. */
const BUSY_TTL_MS = 5 * 60_000;

export type Loaded = Catalogue & { membersById: Map<string, Member[]> };
let cache: { at: number; value: Loaded } | null = null;
let isRebuilding = false;
let busy: { at: number; since: number; owners: Set<string> } | null = null;

/**
 * The whole catalogue. The first call builds it; later calls return the last build at once and,
 * when it is over 10 s old, rebuild after the response (stale-while-revalidate).
 */
export function loadCatalogue(): Loaded {
  if (!cache) cache = { at: Date.now(), value: build() };
  else if (Date.now() - cache.at > MIN_REBUILD_MS && !isRebuilding) {
    isRebuilding = true;
    setImmediate(() => {
      try {
        cache = { at: Date.now(), value: build() };
      } finally {
        isRebuilding = false;
      }
    });
  }
  return cache.value;
}

/** Wallets with over 5,000 creates in the last 7 days (Arkiv's load generators), as the last build saw them. */
export function loadGeneratorOwners(): ReadonlySet<string> {
  loadCatalogue();
  return busy?.owners ?? new Set();
}

function busyOwners(since: number): Set<string> {
  if (!busy || Date.now() - busy.at > BUSY_TTL_MS) busy = { at: Date.now(), since, owners: new Set(readBusyOwners(since, BUSY_OWNER_CREATES)) };
  return busy.owners;
}

function build(): Loaded {
  const state = readCursor();
  const indexed = state?.indexedBlock ?? 0;
  const since = Math.max(0, indexed - HISTORY_BLOCKS);
  const rows = catalogueEntities(since);
  const attrs = new Map<string, Map<string, Attr>>();
  for (const a of catalogueAttributes(since)) {
    (attrs.get(a.k) ?? attrs.set(a.k, new Map()).get(a.k)!).set(a.n, { type: a.t as Attr["type"], value: a.v });
  }
  const members: Member[] = rows.map((r) => ({
    key: r.key, owner: r.owner, status: r.status, createdAtBlock: Number(r.createdAtBlock), updatedAtBlock: Number(r.updatedAtBlock),
    expiresAt: r.expiresAt >= I64_MAX ? null : Number(r.expiresAt), contentType: r.contentType,
    payloadBytes: r.payloadBytes === null ? null : Number(r.payloadBytes), attrs: attrs.get(r.key) ?? new Map(),
  }));
  const busyOwnerSet = busyOwners(since);
  const { datasets, membersById } = buildDatasets(members, { indexedBlock: indexed, busyOwners: busyOwnerSet });

  const counts = liveCounts();
  const recent = createBlocksSince(indexed - 24 * 1_800, busyOwnerSet);
  const hourlyWrites24h = hourlySeries(recent, indexed, 24);
  const value: Loaded = {
    summary: {
      indexedBlock: indexed, chainHead: state?.chainHead ?? 0,
      syncedAt: state ? new Date(state.syncedAtMs).toISOString() : null,
      datasets: datasets.filter((x) => !x.isLoadGenerator).length,
      projects: new Set(datasets.filter((x) => !x.isLoadGenerator).map((x) => x.project.label)).size,
      liveRecords: counts.live, undecodedLive: counts.undecoded,
      writes24h: hourlyWrites24h.reduce((a, b) => a + b, 0), hourlyWrites24h,
    },
    datasets, membersById,
  };
  return value;
}
