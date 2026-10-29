import { dailyCreates, dailyUpdates, readAggregate, readCursor } from "@arkiv-agent/db";
import { datasetsByProject, loadGeneratorOwners, projectsByWallet } from "@arkiv-agent/projects";
import { type ActivityRow, aggregatePulse, type EventCohort, type Period, PERIODS, type PulseData } from "./aggregate.ts";
import eventCohorts from "./event-cohorts.json" with { type: "json" };

const DAY_MS = 86_400_000;
const BLOCK_MS = 2_000;

type Rows = { rows: ActivityRow[]; blockZeroMs: number; indexedBlock: number; syncedAt: string | null };

/** Writes per UTC day and wallet: creates by creator, updates (patches) by the record's owner. Scans all of history (~0.5 s). */
function readRows(): Rows {
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
  return { rows: [...merged.values()], blockZeroMs, indexedBlock, syncedAt: s ? new Date(s.syncedAtMs).toISOString() : null };
}

export type Pulse = PulseData & { syncedAt: string | null; loadWallets: number; datasetsByProject: Record<string, number> };

const pulseKey = (period: Period, includeLoad: boolean) => `pulse:${period}:${includeLoad ? "all" : "apps"}`;

/**
 * The pulse for every period, with and without load generators, as `[key, pulse]` pairs for the
 * indexer to store. One scan of the index serves all six.
 */
export function pulseAggregates(): [string, Pulse][] {
  const r = readRows();
  const loadWallets = loadGeneratorOwners();
  const projectOf = projectsByWallet();
  const byProject = datasetsByProject();
  return PERIODS.flatMap((period) => [false, true].map((includeLoad): [string, Pulse] => {
    const data = aggregatePulse({
      rows: r.rows, projectOf, loadWallets, includeLoad, period,
      today: Math.floor((r.blockZeroMs + r.indexedBlock * BLOCK_MS) / DAY_MS),
      firstDay: Math.floor(r.blockZeroMs / DAY_MS),
      events: eventCohorts as EventCohort[],
    });
    return [pulseKey(period, includeLoad), { ...data, syncedAt: r.syncedAt, loadWallets: loadWallets.size, datasetsByProject: byProject }];
  }));
}

/** The pulse as the indexer last stored it; null until it has. */
export function getPulse({ period, includeLoad }: { period: Period; includeLoad: boolean }): Pulse | null {
  return readAggregate<Pulse>(pulseKey(period, includeLoad))?.value ?? null;
}
