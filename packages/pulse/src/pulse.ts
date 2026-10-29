import { dailyCreates, dailyUpdates, readCursor } from "@arkiv-agent/db";
import { datasetsByProject, loadGeneratorOwners, projectsByWallet } from "@arkiv-agent/projects";
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
  const s = readCursor();
  const indexedBlock = s?.indexedBlock ?? 0;
  // 2 s blocks: block 0's time from the last sync (block N was indexed at syncedAtMs).
  const blockZeroMs = (s?.syncedAtMs ?? Date.now()) - indexedBlock * BLOCK_MS;
  const creates: ActivityRow[] = dailyCreates(blockZeroMs);
  const updates: ActivityRow[] = dailyUpdates(blockZeroMs);
  const merged = new Map<string, ActivityRow>();
  for (const r of [...creates, ...updates]) {
    const k = `${r.day}:${r.wallet}`;
    const m = merged.get(k);
    if (m) m.writes += r.writes; else merged.set(k, { ...r });
  }
  cache = { at: Date.now(), rows: [...merged.values()], blockZeroMs, indexedBlock, syncedAt: s ? new Date(s.syncedAtMs).toISOString() : null };
  return cache;
}

export type Pulse = PulseData & { syncedAt: string | null; loadWallets: number; datasetsByProject: Record<string, number> };

export function getPulse({ period, includeLoad }: { period: Period; includeLoad: boolean }): Pulse {
  const r = readRows();
  const loadWallets = loadGeneratorOwners();
  const data = aggregatePulse({
    rows: r.rows, projectOf: projectsByWallet(), loadWallets, includeLoad, period,
    today: Math.floor((r.blockZeroMs + r.indexedBlock * BLOCK_MS) / DAY_MS),
    firstDay: Math.floor(r.blockZeroMs / DAY_MS),
    events: eventCohorts as EventCohort[],
  });
  return { ...data, syncedAt: r.syncedAt, loadWallets: loadWallets.size, datasetsByProject: datasetsByProject() };
}
