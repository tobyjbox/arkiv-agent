import { type CatalogueSummary, type Dataset, loadCatalogue } from "@arkiv-agent/catalogue";

/** What the list needs per dataset: everything but schema examples (kept for the detail page). */
export type DatasetRow = Omit<Dataset, "schema"> & { fields: { name: string; type: Dataset["schema"][number]["type"] }[] };
export type CatalogueData = { summary: CatalogueSummary; rows: DatasetRow[] };

export function getCatalogueData(): CatalogueData {
  const { summary, datasets } = loadCatalogue();
  return { summary, rows: datasets.map(({ schema, ...d }) => ({ ...d, fields: schema.map(({ name, type }) => ({ name, type })) })) };
}
