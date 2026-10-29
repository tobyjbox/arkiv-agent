import { catalogueDb, loadCatalogue, loadGeneratorOwners } from "@arkiv-agent/catalogue";
import { type ActivityRow, aggregatePulse, type EventCohort, type Period, type PulseData } from "./aggregate.ts";
import eventCohorts from "./event-cohorts.json" with { type: "json" };

const DAY_MS = 86_400_000;
const BLOCK_MS = 2_000;
/** The daily rows scan all of history (~0.5 s); the pulse moves by the day, so 30 s is fresh enough. */
const ROWS_TTL_MS = 30_000;

type Rows = { at: number; rows: ActivityRow[]; blockZeroMs: number; indexedBlock: number; syncedAt: string | null };
let cache: Rows | null = null;

/** Writes per UTC day and wallet: creates by creator, updates (patches) by the record's owner. */
function readRows(): Rows {
  if (cache && Date.now() - cache.at < ROWS_TTL_MS) return cache;
  const d = catalogueDb();
  const s = d.prepare(`SELECT indexedBlock, syncedAtMs FROM "SyncState" WHERE id = 1`).get() as { indexedBlock: number; syncedAtMs: number } | undefined;
  const indexedBlock = s?.indexedBlock ?? 0;
  // 2 s blocks: block 0's time from the last sync (block N was indexed at syncedAtMs).
  const blockZeroMs = (s?.syncedAtMs ?? Date.now()) - indexedBlock * BLOCK_MS;
  const day = (col: string) => `CAST((? + ${col} * ${BLOCK_MS}) / ${DAY_MS} AS INTEGER)`;
  const creates = d.prepare(`SELECT ${day("createdAtBlock")} AS day, lower(creator) AS wallet, COUNT(*) AS writes FROM "Entity" GROUP BY day, wallet`).all(blockZeroMs) as ActivityRow[];
  const updates = d.prepare(`SELECT ${day("p.block")} AS day, lower(e.owner) AS wallet, COUNT(*) AS writes FROM "Patch" p JOIN "Entity" e ON e.key = p.entityKey GROUP BY day, wallet`).all(blockZeroMs) as ActivityRow[];
  const merged = new Map<string, ActivityRow>();
  for (const r of [...creates, ...updates]) {
    const k = `${r.day}:${r.wallet}`;
    const m = merged.get(k);
    if (m) m.writes += r.writes; else merged.set(k, { ...r });
  }
  cache = { at: Date.now(), rows: [...merged.values()], blockZeroMs, indexedBlock, syncedAt: s ? new Date(s.syncedAtMs).toISOString() : null };
  return cache;
}

/** Each wallet's project: the label on most of its decoded records. */
function projectsByWallet(): Map<string, string> {
  const { datasets, membersById } = loadCatalogue();
  const counts = new Map<string, Map<string, number>>();
  for (const ds of datasets) {
    if (ds.project.method !== "label") continue;
    for (const m of membersById.get(ds.id) ?? []) {
      const w = m.owner.toLowerCase();
      const c = counts.get(w) ?? counts.set(w, new Map()).get(w)!;
      c.set(ds.project.label, (c.get(ds.project.label) ?? 0) + 1);
    }
  }
  return new Map([...counts].map(([w, c]) => [w, [...c].sort((a, b) => b[1] - a[1])[0]![0]]));
}

export type Pulse = PulseData & { syncedAt: string | null; loadWallets: number; datasetsByProject: Record<string, number> };

export function getPulse({ period, includeLoad }: { period: Period; includeLoad: boolean }): Pulse {
  const r = readRows();
  const loadWallets = new Set([...loadGeneratorOwners()].map((w) => w.toLowerCase()));
  const data = aggregatePulse({
    rows: r.rows, projectOf: projectsByWallet(), loadWallets, includeLoad, period,
    today: Math.floor((r.blockZeroMs + r.indexedBlock * BLOCK_MS) / DAY_MS),
    firstDay: Math.floor(r.blockZeroMs / DAY_MS),
    events: eventCohorts as EventCohort[],
  });
  const datasetsByProject: Record<string, number> = {};
  for (const ds of loadCatalogue().datasets) if (!ds.isLoadGenerator) datasetsByProject[ds.project.label] = (datasetsByProject[ds.project.label] ?? 0) + 1;
  return { ...data, syncedAt: r.syncedAt, loadWallets: loadWallets.size, datasetsByProject };
}
