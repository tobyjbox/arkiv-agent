// `pnpm aggregates`: computes and stores the Insights and Financials results now, without syncing.
// The indexer does this itself (after `pnpm index`, and every 30 s with --watch); this is for when it
// isn't running. Safe beside it.
import { openSqlite } from "@arkiv-agent/db";
import { missingTable, storeAggregates } from "./aggregates.ts";

try {
  const r = storeAggregates(openSqlite());
  console.log(`stored the Insights and Financials results for block ${r.indexedBlock} in ${r.seconds}s`);
} catch (error) {
  console.error(missingTable(error) ?? error);
  process.exitCode = 1;
}
