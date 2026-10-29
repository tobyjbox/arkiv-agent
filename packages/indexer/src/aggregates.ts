import { costAggregates } from "@arkiv-agent/cost";
import { readCursor, type Sqlite, writeAggregates } from "@arkiv-agent/db";
import { pulseAggregates } from "@arkiv-agent/pulse";

/**
 * Computes the Insights and Financials results and stores them; the pages only read them. Takes a few
 * seconds, as it reads all of history. The fee model is refitted only when receipts were added.
 */
export function storeAggregates(db: Sqlite): { indexedBlock: number; seconds: string } {
  const started = performance.now();
  const indexedBlock = readCursor(db)?.indexedBlock ?? 0;
  writeAggregates([...pulseAggregates(), ...costAggregates()], indexedBlock, db);
  return { indexedBlock, seconds: ((performance.now() - started) / 1000).toFixed(1) };
}

/** For commands that don't migrate: says what to do when the table isn't there yet. */
export const missingTable = (error: unknown) =>
  error instanceof Error && /no such table: Aggregate/.test(error.message) ? "The index has no Aggregate table yet: run pnpm index once to add it." : null;
