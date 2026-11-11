// Puts the four inferences together into one result the page reads as it is.
import type { Dataset, Member } from "@arkiv-agent/catalogue";
import { inferLinks, type Target } from "./links.ts";
import { conventions, type PatternDataset, sharedBuilders, sharedShapes } from "./patterns.ts";
import { isSealed, privacyFlags } from "./privacy.ts";
import { classifyPurpose } from "./purpose.ts";
import type { Decode, DecodeProject, GraphLink, GraphNode } from "./types.ts";

const BLOCKS_PER_DAY = 43_200;
export const projectId = (d: Pick<Dataset, "project">) => `${d.project.method}:${d.project.label}`;

function traitsOf(datasets: readonly Dataset[], refs: number, broken: number): string[] {
  const traits: string[] = [];
  const lifetimes = datasets.flatMap((d) => (d.medianLifetimeBlocks === null ? [] : [d.medianLifetimeBlocks]));
  const permanent = datasets.length - lifetimes.length;
  if (permanent === datasets.length) traits.push("Records never expire");
  else if (lifetimes.length) {
    const days = Math.max(...lifetimes) / BLOCKS_PER_DAY;
    traits.push(days < 1 ? "Short-lived records (under a day)" : days < 31 ? `Records live up to about ${Math.round(days)} d` : "Long-lived records (a month or more)");
  }
  const owners = new Set(datasets.map((d) => d.ownership));
  traits.push(owners.has("user") ? "Users write their own records" : owners.has("mixed") ? "Written by the app and its users" : "Written by the app's own wallets");
  if (refs) traits.push(`Relational: ${refs.toLocaleString("en")} links between records${broken ? `, ${broken.toLocaleString("en")} of them broken` : ""}`);
  return traits;
}

/** `datasets` and `membersById` come from the catalogue; `resolve` looks a record key up in the index. */
export function assembleDecode(input: { datasets: readonly Dataset[]; membersById: ReadonlyMap<string, readonly Member[]>; resolve: (key: string) => Target | null; indexedBlock: number }): Decode {
  const datasets = input.datasets.filter((d) => !d.isLoadGenerator);
  const byId = new Map(datasets.map((d) => [d.id, d]));
  const members = new Map([...input.membersById].filter(([id]) => byId.has(id)));
  // A target in a load generator's dataset is outside this view: it counts as outside the catalogue.
  const refEdges = inferLinks(members, (key) => {
    const t = input.resolve(key);
    return t && t.datasetId !== null && !byId.has(t.datasetId) ? { ...t, datasetId: null } : t;
  });

  const grouped = Map.groupBy(datasets, projectId);
  const refsBy = new Map<string, { refs: number; broken: number }>();
  for (const e of refEdges) {
    const p = projectId(byId.get(e.from)!);
    const r = refsBy.get(p) ?? refsBy.set(p, { refs: 0, broken: 0 }).get(p)!;
    r.refs += e.count;
    r.broken += e.broken;
  }

  const projects: DecodeProject[] = [...grouped].map(([id, list]) => {
    const first = list[0]!;
    const isLabel = first.project.method === "label";
    const vocabulary = [...(isLabel ? [first.project.label] : []), ...list.flatMap((d) => [...(d.discriminator ? [d.discriminator.value] : []), ...d.schema.map((f) => f.name)])];
    const r = refsBy.get(id) ?? { refs: 0, broken: 0 };
    const writers = new Set(list.flatMap((d) => (members.get(d.id) ?? []).map((m) => m.owner.toLowerCase())));
    return {
      id, label: first.project.label, isLabel, live: list.reduce((n, d) => n + d.liveCount, 0), writers: writers.size,
      purpose: classifyPurpose(vocabulary), traits: traitsOf(list, r.refs, r.broken), refs: r.refs, broken: r.broken,
      datasets: list.map((d) => ({ id: d.id, name: d.name, live: d.liveCount, writers: d.writers, fields: d.schema.length, flags: privacyFlags(d.schema), isSealed: isSealed(d.contentTypes) }))
        .sort((a, b) => b.live - a.live),
    };
  }).sort((a, b) => b.live - a.live);

  const patternInput: PatternDataset[] = datasets.filter((d) => d.project.method === "label").map((d) => ({
    id: d.id, project: projectId(d), fields: d.schema.filter((f) => f.name !== d.project.labelAttr), writers: new Set((members.get(d.id) ?? []).map((m) => m.owner)),
  }));
  const shapes = sharedShapes(patternInput);
  const builders = sharedBuilders(patternInput);

  const archetypeOf = new Map(projects.map((p) => [p.id, p.purpose.archetype]));
  const nodes: GraphNode[] = [
    ...projects.map((p): GraphNode => ({ id: p.id, kind: "project", label: p.isLabel ? p.label : `${p.label.slice(0, 8)}…`, project: p.id, live: p.live, archetype: p.purpose.archetype, flags: p.datasets.filter((d) => d.flags.length).length })),
    ...datasets.map((d): GraphNode => ({ id: d.id, kind: "dataset", label: d.name, project: projectId(d), live: d.liveCount, archetype: archetypeOf.get(projectId(d)) ?? "unclear", flags: privacyFlags(d.schema).length })),
  ];
  const refLinks = new Map<string, GraphLink>();
  for (const e of refEdges) {
    if (e.to === null || e.to === e.from) continue;
    const l = refLinks.get(`${e.from}|${e.to}`) ?? refLinks.set(`${e.from}|${e.to}`, { source: e.from, target: e.to, kind: "ref", count: 0, broken: 0 }).get(`${e.from}|${e.to}`)!;
    l.count += e.count;
    l.broken += e.broken;
  }
  const links: GraphLink[] = [
    ...datasets.map((d): GraphLink => ({ source: projectId(d), target: d.id, kind: "member", count: 1, broken: 0 })),
    ...refLinks.values(),
    ...shapes.flatMap((s) => s.projects.slice(1).map((p): GraphLink => ({ source: s.projects[0]!, target: p, kind: "shape", count: s.fields.length, broken: 0 }))),
    ...builders.pairs.map((b): GraphLink => ({ source: b.a, target: b.b, kind: "builder", count: b.wallets, broken: 0 })),
  ];

  const sum = (f: (e: (typeof refEdges)[number]) => number) => refEdges.reduce((n, e) => n + f(e), 0);
  return {
    indexedBlock: input.indexedBlock,
    summary: {
      projects: projects.length, datasets: datasets.length, refs: sum((e) => e.count), resolved: sum((e) => (e.to === null ? 0 : e.count)), broken: sum((e) => e.broken),
      crossProject: sum((e) => (e.to !== null && projectId(byId.get(e.to)!) !== projectId(byId.get(e.from)!) ? e.count : 0)),
      crossWallet: sum((e) => e.crossWallet), implicit: sum((e) => (e.isImplicit ? e.count : 0)),
      flaggedDatasets: projects.reduce((n, p) => n + p.datasets.filter((d) => d.flags.length).length, 0), sharedShapes: shapes.length, multiProjectWallets: builders.wallets,
    },
    projects, refEdges, conventions: conventions(patternInput), sharedShapes: shapes.slice(0, 30), sharedBuilders: builders.pairs.slice(0, 60), nodes, links,
  };
}
