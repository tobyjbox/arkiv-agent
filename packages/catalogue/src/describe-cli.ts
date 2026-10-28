// `pnpm describe [--limit N]`: pre-generates descriptions for listed datasets (load generators
// excluded), most active first, so the catalogue list shows them. Needs ANTHROPIC_API_KEY.
import { hasApiKey } from "./describe.ts";
import { getOrCreateDescription } from "./describe-store.ts";
import { loadCatalogue } from "./load.ts";

if (!hasApiKey()) {
  console.log("ANTHROPIC_API_KEY is not set: nothing to do. The catalogue shows schemas without AI summaries.");
  process.exit(0);
}
const at = process.argv.indexOf("--limit");
const limit = at > 0 ? Number(process.argv[at + 1]) : 50;
const targets = loadCatalogue().datasets.filter((d) => !d.isLoadGenerator).slice(0, limit);
let ready = 0;
for (const d of targets) {
  const s = await getOrCreateDescription(d.id);
  ready += s.status === "ready" ? 1 : 0;
  console.log(`${s.status.padEnd(9)} ${d.name} (${d.project.label})`);
}
console.log(`${ready}/${targets.length} datasets described`);
