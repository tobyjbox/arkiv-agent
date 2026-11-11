// Patterns between projects: attribute names many projects chose independently, record shapes that
// appear under more than one project, and wallets that write for several projects.
import type { Convention, SharedBuilder, SharedShape } from "./types.ts";

export type PatternDataset = { id: string; project: string; fields: readonly { name: string; type: string }[]; writers: Iterable<string> };

const MIN_CONVENTION_PROJECTS = 3;
const MIN_SHAPE_FIELDS = 3;

/** Attribute names used by at least three projects, with the types they gave them. More than one type is a conflict. */
export function conventions(datasets: readonly PatternDataset[], limit = 40): Convention[] {
  const byName = new Map<string, Map<string, Set<string>>>();
  for (const d of datasets) {
    for (const f of d.fields) {
      if (f.name.includes("*")) continue;
      const types = byName.get(f.name) ?? byName.set(f.name, new Map()).get(f.name)!;
      (types.get(f.type) ?? types.set(f.type, new Set()).get(f.type)!).add(d.project);
    }
  }
  return [...byName]
    .map(([name, types]) => ({
      name, projects: new Set([...types.values()].flatMap((s) => [...s])).size,
      types: [...types].map(([type, s]) => ({ type, projects: s.size })).sort((a, b) => b.projects - a.projects),
    }))
    .filter((c) => c.projects >= MIN_CONVENTION_PROJECTS)
    .sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Shapes (the same attribute names and types, three or more) found under more than one project. */
export function sharedShapes(datasets: readonly PatternDataset[]): SharedShape[] {
  const bySig = new Map<string, { fields: string[]; projects: Set<string>; datasets: string[] }>();
  for (const d of datasets) {
    const fields = d.fields.filter((f) => !f.name.includes("*")).map((f) => `${f.name}:${f.type}`).sort();
    if (fields.length < MIN_SHAPE_FIELDS) continue;
    const sig = fields.join(",");
    const g = bySig.get(sig) ?? bySig.set(sig, { fields, projects: new Set(), datasets: [] }).get(sig)!;
    g.projects.add(d.project);
    g.datasets.push(d.id);
  }
  return [...bySig.values()].filter((g) => g.projects.size > 1)
    .map((g) => ({ fields: g.fields, projects: [...g.projects].sort(), datasets: g.datasets }))
    .sort((a, b) => b.projects.length - a.projects.length || b.fields.length - a.fields.length);
}

/** Pairs of projects with a writer in common, and how many wallets write for more than one project. */
export function sharedBuilders(datasets: readonly PatternDataset[]): { pairs: SharedBuilder[]; wallets: number } {
  const byWallet = new Map<string, Set<string>>();
  for (const d of datasets) for (const w of d.writers) (byWallet.get(w.toLowerCase()) ?? byWallet.set(w.toLowerCase(), new Set()).get(w.toLowerCase())!).add(d.project);
  const pairs = new Map<string, SharedBuilder>();
  let wallets = 0;
  for (const projects of byWallet.values()) {
    if (projects.size < 2) continue;
    wallets++;
    const list = [...projects].sort();
    // A wallet in very many projects is a shared faucet or tool, not a builder: its pairs would swamp the graph.
    if (list.length > 8) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const id = `${list[i]}|${list[j]}`;
      const p = pairs.get(id) ?? pairs.set(id, { a: list[i]!, b: list[j]!, wallets: 0 }).get(id)!;
      p.wallets++;
    }
  }
  return { pairs: [...pairs.values()].sort((a, b) => b.wallets - a.wallets), wallets };
}
