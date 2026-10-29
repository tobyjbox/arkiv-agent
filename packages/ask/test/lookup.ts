import values from "./fixtures/values.json" with { type: "json" };

const byDataset = values as Record<string, Record<string, string[]>>;

/** The app's index lookup, over the recorded values (exact match, ignoring case). */
export function fixtureLookup(datasetId: string, text: string, fields: readonly string[]) {
  const t = text.trim().toLowerCase();
  return fields.flatMap((field) => (byDataset[datasetId]?.[field] ?? []).filter((v) => v.toLowerCase() === t).map((value) => ({ field, value, count: 1 })));
}
