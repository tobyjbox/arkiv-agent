import { loadCatalogue } from "@arkiv-agent/catalogue";

type ProjectDataset = { id: string; isLoadGenerator: boolean; project: { method: string; label: string } };

/** Each wallet (lowercase) and its project: the label on most of its records in labelled datasets. */
export function assignProjects(datasets: readonly ProjectDataset[], membersById: ReadonlyMap<string, readonly { owner: string }[]>): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const ds of datasets) {
    if (ds.project.method !== "label") continue;
    for (const m of membersById.get(ds.id) ?? []) {
      const w = m.owner.toLowerCase();
      const c = counts.get(w) ?? counts.set(w, new Map()).get(w)!;
      c.set(ds.project.label, (c.get(ds.project.label) ?? 0) + 1);
    }
  }
  return new Map([...counts].map(([w, c]) => [w, [...c].sort((a, b) => b[1] - a[1])[0]![0]]));
}

/** Datasets per project label, leaving out load generators. */
export function countDatasetsByProject(datasets: readonly ProjectDataset[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ds of datasets) if (!ds.isLoadGenerator) counts[ds.project.label] = (counts[ds.project.label] ?? 0) + 1;
  return counts;
}

/** Each wallet's project, from the current catalogue. */
export function projectsByWallet(): Map<string, string> {
  const { datasets, membersById } = loadCatalogue();
  return assignProjects(datasets, membersById);
}

/** Datasets per project in the current catalogue, leaving out load generators. */
export const datasetsByProject = (): Record<string, number> => countDatasetsByProject(loadCatalogue().datasets);
