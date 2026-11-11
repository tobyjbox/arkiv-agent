import { loadCatalogue } from "@arkiv-agent/catalogue";
import { entityStatuses, readAggregate } from "@arkiv-agent/db";
import { assembleDecode } from "./assemble.ts";
import { candidateRefs, type Target } from "./links.ts";
import type { Decode } from "./types.ts";

const KEY = "decode:v1";

/** The decode of the current catalogue, as a `[key, value]` pair for the indexer to store. Reads the catalogue and looks up link targets outside it. */
export function decodeAggregates(): [string, Decode][] {
  const { datasets, membersById, summary } = loadCatalogue();
  const known = new Map<string, Target>();
  for (const [datasetId, members] of membersById) {
    for (const m of members) known.set(m.key.toLowerCase(), { datasetId, owner: m.owner, isLive: m.status === "live" });
  }
  // Targets outside the catalogue (expired over a week ago, or not decoded): one lookup for all of them.
  const outside = new Set<string>();
  for (const members of membersById.values()) for (const m of members) for (const r of candidateRefs(m)) if (!known.has(r.value)) outside.add(r.value);
  for (const row of entityStatuses([...outside])) known.set(row.key.toLowerCase(), { datasetId: null, owner: row.owner, isLive: row.status === "live" });
  return [[KEY, assembleDecode({ datasets, membersById, resolve: (key) => known.get(key) ?? null, indexedBlock: summary.indexedBlock })]];
}

/** The decode as the indexer last stored it; null until it has. */
export const getDecode = (): Decode | null => readAggregate<Decode>(KEY)?.value ?? null;
