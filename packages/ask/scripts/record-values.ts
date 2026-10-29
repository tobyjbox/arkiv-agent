// Records stored text values for the fixture's datasets (`pnpm --filter @arkiv-agent/ask record-values`),
// so tests exercise the value lookup the app does against the index.
import { readFileSync, writeFileSync } from "node:fs";
import { commonValues, type Dataset } from "@arkiv-agent/catalogue";

const VALUES_PER_FIELD = 40;
const fixture = JSON.parse(readFileSync(new URL("../test/fixtures/catalogue.json", import.meta.url), "utf8")) as { datasets: Dataset[] };
const out: Record<string, Record<string, string[]>> = {};
for (const d of fixture.datasets) {
  const skip = new Set([d.project.labelAttr, d.discriminator?.name]);
  for (const f of d.schema) {
    if (f.type !== "str" || skip.has(f.name) || f.name.includes("*")) continue;
    const values = commonValues(d.id, f.name, VALUES_PER_FIELD);
    if (values.length) (out[d.id] ??= {})[f.name] = values;
  }
}
writeFileSync(new URL("../test/fixtures/values.json", import.meta.url), `${JSON.stringify(out)}\n`);
console.log(`recorded values for ${Object.keys(out).length} datasets`);
