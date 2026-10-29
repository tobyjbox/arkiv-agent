import {
  type Attr, classifyOwnership, confidenceOf, datasetId, datasetName, groupKey, labelGroups, median, normalizeAttrName,
} from "./infer.ts";
import type { AttrRef, Attribution, AttrType, Dataset, SchemaField, Shape } from "./types.ts";

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
    firstWriteBlock: members.reduce((min, m) => (m.createdAtBlock < min ? m.createdAtBlock : min), Number.POSITIVE_INFINITY),
    hourly24h, writes24h: hourly24h.reduce((a, b) => a + b, 0),
    contentTypes: [...new Set(basis.flatMap((m) => (m.contentType ? [m.contentType] : [])))].slice(0, 3),
    medianPayloadBytes: median(basis.flatMap((m) => (m.payloadBytes === null ? [] : [m.payloadBytes]))),
    isLoadGenerator: busyWrites * 2 > members.length,
    soleOwner: perWriter.size === 1 ? [...perWriter.keys()][0]! : null,
    writerSet: new Set(members.map((m) => m.owner)),
  };
}

/**
 * Types with a comparison every value passes, which stands in for EXISTS (Tiramisu rejects it):
 * `STARTSWITH ''` for str, `>= 0` for u64, `>= i32 min` for i32. Checked live; snippet.ts builds them.
 */
export const PRESENCE_TYPES: ReadonlySet<AttrType> = new Set(["str", "u64", "i32"]);
const MAX_SHAPE_TERMS = 6;

const hasAttr = (m: Member, r: AttrRef) => m.attrs.get(r.name)?.type === r.type;

/** The records a dataset's base query matches: its label (exact or prefix), else its wallet. */
function inBase(p: Pick<Attribution, "method" | "label" | "labelAttr" | "isPrefix">): (m: Member) => boolean {
  if (p.method === "creator" || !p.labelAttr) {
    const owner = p.label.toLowerCase();
    return (m) => m.owner.toLowerCase() === owner;
  }
  const attr = p.labelAttr;
  const prefix = p.isPrefix ? p.label.replace(/\*$/, "") : null;
  return (m) => {
    const a = m.attrs.get(attr);
    return a?.type === "str" && (prefix === null ? a.value === p.label : a.value.startsWith(prefix));
  };
}

/**
 * How one query reads a shape-named dataset back. Its base query (label or wallet) also matches other
 * records, so attributes it has, or lacks, are added until no other live record in the index is left,
 * picking the one that rules out most each time. Returns the reason instead when that can't be done,
 * because the records differ only in attributes with no presence check (PRESENCE_TYPES).
 */
export function readBack(
  d: { project: Pick<Attribution, "method" | "label" | "labelAttr" | "isPrefix">; schema: readonly SchemaField[] },
  own: readonly Member[],
  live: readonly Member[],
): { shape: Shape } | { unqueryable: string } {
  const ownKeys = new Set(own.map((m) => m.key));
  const matches = inBase(d.project);
  let rest = live.filter((m) => !ownKeys.has(m.key) && matches(m));
  const ownNames = new Set(own.flatMap((m) => [...m.attrs.keys()]));
  const has = d.schema
    .filter((f) => f.presence === 1 && !f.name.includes("*") && f.name !== d.project.labelAttr && PRESENCE_TYPES.has(f.type))
    .map(({ name, type }) => ({ name, type }));
  const lacks = new Map<string, AttrRef>();
  for (const m of rest) {
    for (const [name, a] of m.attrs) {
      // Generated names (`random_number_0_dc68…`) belong to one record each: no use as a filter.
      if (!ownNames.has(name) && PRESENCE_TYPES.has(a.type) && normalizeAttrName(name) === name) lacks.set(`${name}:${a.type}`, { name, type: a.type });
    }
  }
  const candidates = [
    ...has.map((ref) => ({ ref, isHas: true })),
    ...[...lacks.values()].sort((a, b) => a.name.localeCompare(b.name)).map((ref) => ({ ref, isHas: false })),
  ];
  const shape: Shape = { has: [], lacks: [] };
  while (rest.length && shape.has.length + shape.lacks.length < MAX_SHAPE_TERMS) {
    // Ties go to the earlier candidate: attributes the dataset has, then names in order.
    let best: { c: (typeof candidates)[number]; out: number } | null = null;
    for (const c of candidates) {
      const out = rest.filter((m) => hasAttr(m, c.ref) !== c.isHas).length;
      if (out > (best?.out ?? 0)) best = { c, out };
    }
    if (!best) break;
    const { ref, isHas } = best.c;
    (isHas ? shape.has : shape.lacks).push(ref);
    candidates.splice(candidates.indexOf(best.c), 1);
    rest = rest.filter((m) => hasAttr(m, ref) === isHas);
  }
  if (!rest.length) return { shape };
  const n = rest.length;
  const from = d.project.method === "label" ? `labelled ${d.project.labelAttr} = ${d.project.label}` : "from the same wallet";
  return {
    unqueryable: `${n.toLocaleString("en")} other live record${n === 1 ? "" : "s"} ${from} differ${n === 1 ? "s" : ""} from these only in attributes Arkiv can't filter on yet (it has no EXISTS), so any query for this dataset would return ${n === 1 ? "it" : "them"} too.`,
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
  const live = members.filter((m) => m.status === "live");
  const datasets: Dataset[] = built.map(({ g, ms, s }) => {
    const id = datasetId(g.key);
    membersById.set(id, ms);
    const groupsForLabel = g.project.method === "label" ? (conflicts.get(g.project.label) ?? 1) : 1;
    const { writerSet: _, ...stats } = s;
    const read = g.discriminator ? null : readBack({ project: g.project, schema: s.schema }, ms, live);
    return {
      id, name: datasetName(g.discriminator, s.schema.map((f) => f.name)), nameSource: g.discriminator ? "discriminator" : "schema",
      discriminator: g.discriminator,
      shape: read && "shape" in read ? read.shape : null,
      unqueryable: read && "unqueryable" in read ? read.unqueryable : null,
      project: { ...g.project, confidence: confidenceOf(g.project.method, groupsForLabel), conflictWallets: groupsForLabel > 1 ? groupsForLabel : null },
      ...stats,
    };
  });
  datasets.sort((a, b) => b.writes24h - a.writes24h || b.liveCount - a.liveCount || a.name.localeCompare(b.name));
  return { datasets, membersById };
}
