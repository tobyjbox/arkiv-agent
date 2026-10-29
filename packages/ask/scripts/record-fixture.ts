// Records a slice of the live catalogue for the Ask Arkiv eval: `pnpm --filter @arkiv-agent/ask record-fixture`.
// The eval questions refer to datasets by id, so re-recording can change ids; check the eval still passes.
import { writeFileSync } from "node:fs";
import { loadCatalogue } from "@arkiv-agent/catalogue";

const MIN_LIVE = 50;
const { summary, datasets } = loadCatalogue();
const apps = datasets.filter((d) => !d.isLoadGenerator && d.liveCount >= MIN_LIVE);
// A few load-generator datasets, so the eval checks they are never picked.
const load = datasets.filter((d) => d.isLoadGenerator).sort((a, b) => b.liveCount - a.liveCount).slice(0, 3);
const out = { summary, datasets: [...apps, ...load] };
const path = new URL("../test/fixtures/catalogue.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`);
console.log(`recorded ${out.datasets.length} datasets at block ${summary.indexedBlock}`);
