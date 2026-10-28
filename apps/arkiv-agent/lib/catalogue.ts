import { type CatalogueSummary, type Dataset, loadCatalogue, readDescriptions, schemaHash } from "@arkiv-agent/catalogue";

/** What the list needs per dataset: everything but schema examples (kept for the detail page). */
export type DatasetRow = Omit<Dataset, "schema"> & { fields: { name: string; type: Dataset["schema"][number]["type"] }[]; description: string | null };
export type CatalogueData = { summary: CatalogueSummary; rows: DatasetRow[] };

export function getCatalogueData(): CatalogueData {
  const { summary, datasets } = loadCatalogue();
  const described = readDescriptions();
  return {
    summary,
    rows: datasets.map(({ schema, ...d }) => {
      const desc = described.get(d.id);
      // A description written for an older schema is not shown in the list (the detail page refreshes it).
      const description = desc && desc.schemaHash === schemaHash({ id: d.id, schema }) ? desc.summary : null;
      return { ...d, description, fields: schema.map(({ name, type }) => ({ name, type })) };
    }),
  };
}
