import { catalogueDb, loadCatalogue } from "./load.ts";

export type ValueHit = { field: string; value: string; count: number };

/**
 * Stored text values of a dataset that equal `text`, ignoring case, across `fields`. The catalogue
 * keeps three examples per field; this looks in the whole index, so "Pune" is found even when it
 * isn't an example. Exact matches only: no guessing.
 */
export function findValues(datasetId: string, text: string, fields: readonly string[]): ValueHit[] {
  const members = loadCatalogue().membersById.get(datasetId);
  if (!members?.length || !fields.length || !text.trim()) return [];
  const keys = new Set(members.map((m) => m.key));
  const rows = catalogueDb()
    .prepare(`SELECT entityKey, name, value FROM "Attribute" WHERE name IN (${fields.map(() => "?").join(",")}) AND type = 'str' AND value = ? COLLATE NOCASE LIMIT 5000`)
    .all(...fields, text.trim()) as { entityKey: string; name: string; value: string }[];
  const counts = new Map<string, ValueHit>();
  for (const r of rows) {
    if (!keys.has(r.entityKey)) continue;
    const id = `${r.name}\u0000${r.value}`;
    const hit = counts.get(id) ?? { field: r.name, value: r.value, count: 0 };
    hit.count++;
    counts.set(id, hit);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/** The most common text values of one field in a dataset (for recording test fixtures). */
export function commonValues(datasetId: string, field: string, limit: number): string[] {
  const members = loadCatalogue().membersById.get(datasetId) ?? [];
  const counts = new Map<string, number>();
  for (const m of members) {
    const a = m.attrs.get(field);
    if (a?.type === "str") counts.set(a.value, (counts.get(a.value) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([v]) => v);
}
