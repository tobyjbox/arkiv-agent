import {
  type Attr, classifyOwnership, confidenceOf, datasetId, datasetName, groupKey, labelGroups, median, normalizeAttrName,
} from "./infer.ts";
import type { AttrType, Dataset, SchemaField } from "./types.ts";

/** One decoded record from the index. `expiresAt` null: it never expires. */
export type Member = {
  key: string; owner: string; status: "live" | "expired" | "deleted";
  createdAtBlock: number; updatedAtBlock: number; expiresAt: number | null;
  contentType: string | null; payloadBytes: number | null; attrs: ReadonlyMap<string, Attr>;
};

export const BLOCKS_PER_HOUR = 1_800;
const EXAMPLES = 3;
const EXAMPLE_CHARS = 48;

export type BuildContext = { indexedBlock: number; busyOwners: ReadonlySet<string> };

/** Creates per hour for the last `hours`, oldest first. */
export function hourlySeries(blocks: Iterable<number>, indexedBlock: number, hours: number): number[] {
  const series = new Array<number>(hours).fill(0);
  for (const b of blocks) {
    const age = Math.floor((indexedBlock - b) / BLOCKS_PER_HOUR);
    if (age >= 0 && age < hours) series[hours - 1 - age]!++;
  }
  return series;
}

function schemaOf(basis: readonly Member[]): SchemaField[] {
  const fields = new Map<string, { name: string; type: AttrType; count: number; examples: Set<string> }>();
  for (const m of basis) {
    for (const [raw, a] of m.attrs) {
      const name = normalizeAttrName(raw);
      const id = `${name}:${a.type}`;
      const f = fields.get(id) ?? fields.set(id, { name, type: a.type, count: 0, examples: new Set() }).get(id)!;
      f.count++;
      if (f.examples.size < EXAMPLES) f.examples.add(a.value.length > EXAMPLE_CHARS ? `${a.value.slice(0, EXAMPLE_CHARS)}…` : a.value);
    }
  }
  return [...fields.values()]
    .map((f) => ({ name: f.name, type: f.type, presence: f.count / basis.length, examples: [...f.examples] }))
    .sort((a, b) => b.presence - a.presence || a.name.localeCompare(b.name));
}

function summarize(members: readonly Member[], ctx: BuildContext) {
  const live = members.filter((m) => m.status === "live");
  const basis = live.length ? live : members;
  const perWriter = new Map<string, number>();
  for (const m of basis) perWriter.set(m.owner, (perWriter.get(m.owner) ?? 0) + 1);
  const finite = basis.flatMap((m) => (m.expiresAt === null ? [] : [m.expiresAt - m.createdAtBlock]));
  const busyWrites = members.filter((m) => ctx.busyOwners.has(m.owner)).length;
  const hourly24h = hourlySeries(members.map((m) => m.createdAtBlock), ctx.indexedBlock, 24);
  return {
    schema: schemaOf(basis), liveCount: live.length, writers: perWriter.size, ownership: classifyOwnership([...perWriter.values()]),
    medianLifetimeBlocks: median(finite), lastWriteBlock: members.reduce((max, m) => (m.updatedAtBlock > max ? m.updatedAtBlock : max), 0),
    hourly24h, writes24h: hourly24h.reduce((a, b) => a + b, 0),
    contentTypes: [...new Set(basis.flatMap((m) => (m.contentType ? [m.contentType] : [])))].slice(0, 3),
    medianPayloadBytes: median(basis.flatMap((m) => (m.payloadBytes === null ? [] : [m.payloadBytes]))),
    isLoadGenerator: busyWrites * 2 > members.length,
    soleOwner: perWriter.size === 1 ? [...perWriter.keys()][0]! : null,
    writerSet: new Set(members.map((m) => m.owner)),
  };
}

/** Groups records into datasets and flags labels that unrelated wallets share. */
export function buildDatasets(members: readonly Member[], ctx: BuildContext) {
  const groups = new Map<string, { g: ReturnType<typeof groupKey>; members: Member[] }>();
  for (const m of members) {
    const g = groupKey(m.attrs, m.owner);
    (groups.get(g.key) ?? groups.set(g.key, { g, members: [] }).get(g.key)!).members.push(m);
  }
  const built = [...groups.values()].map(({ g, members: ms }) => ({ g, ms, s: summarize(ms, ctx) }));

  const byLabel = Map.groupBy(built.filter((b) => b.g.project.method === "label"), (b) => b.g.project.label);
  const conflicts = new Map([...byLabel].map(([label, list]) => [label, labelGroups(list.map((b) => b.s.writerSet))]));

  const membersById = new Map<string, Member[]>();
  const datasets: Dataset[] = built.map(({ g, ms, s }) => {
    const id = datasetId(g.key);
    membersById.set(id, ms);
    const groupsForLabel = g.project.method === "label" ? (conflicts.get(g.project.label) ?? 1) : 1;
    const { writerSet: _, ...stats } = s;
    return {
      id, name: datasetName(g.discriminator, s.schema.map((f) => f.name)), nameSource: g.discriminator ? "discriminator" : "schema",
      discriminator: g.discriminator,
      project: { ...g.project, confidence: confidenceOf(g.project.method, groupsForLabel), conflictWallets: groupsForLabel > 1 ? groupsForLabel : null },
      ...stats,
    };
  });
  datasets.sort((a, b) => b.writes24h - a.writes24h || b.liveCount - a.liveCount || a.name.localeCompare(b.name));
  return { datasets, membersById };
}
