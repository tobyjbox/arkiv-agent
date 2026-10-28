// Dataset inference: which records belong together, whose they are, and how they are owned.
// Pure functions over decoded index rows; every heuristic here is shown to users as one.
import { createHash } from "node:crypto";
import type { AttrType, Ownership } from "./types.ts";

export type Attr = { type: AttrType; value: string };

/** Attributes that name a project (the "label" attribution method), in priority order. */
const LABEL_ATTRS = ["project", "app", "application", "dapp", "project_id", "projectId"];
/** String attributes that say what kind of record this is, in priority order. */
const DISCRIMINATOR_ATTRS = ["kind", "type", "entityType", "entity_type", "recordType", "record_type", "collection", "table", "category"];

/** `random_number_0_dc6812240366360d` → `random_number_0_*`: generated suffixes are not schema. */
export const normalizeAttrName = (name: string) => name.replace(/([_\-.:])[0-9a-f]{8,}$/i, "$1*");

/** `supercall-test-1793010381266` → `supercall-test-*`: run ids and timestamps are not projects. */
export const normalizeLabel = (label: string) => label.trim().replace(/([_\-.:])\d{10,}$/, "$1*");

export type Project = { method: "label" | "creator"; label: string; labelAttr: string | null; isPrefix: boolean };

export function projectOf(attrs: ReadonlyMap<string, Attr>, owner: string): Project {
  for (const name of LABEL_ATTRS) {
    const a = attrs.get(name);
    if (a?.type !== "str" || !a.value.trim()) continue;
    const label = normalizeLabel(a.value);
    return { method: "label", label, labelAttr: name, isPrefix: label !== a.value.trim() };
  }
  return { method: "creator", label: owner.toLowerCase(), labelAttr: null, isPrefix: false };
}

export function discriminatorOf(attrs: ReadonlyMap<string, Attr>): { name: string; value: string } | null {
  for (const name of DISCRIMINATOR_ATTRS) {
    const a = attrs.get(name);
    if (a?.type === "str" && a.value.trim() && a.value.length <= 64) return { name, value: a.value.trim() };
  }
  return null;
}

/** The sorted `name:type` list after normalization: two records with it share a shape. */
export const shapeOf = (attrs: ReadonlyMap<string, Attr>) =>
  [...new Set([...attrs].map(([n, a]) => `${normalizeAttrName(n)}:${a.type}`))].sort().join(",");

/** Groups by project, then by discriminator value when there is one, else by shape. */
export function groupKey(attrs: ReadonlyMap<string, Attr>, owner: string) {
  const project = projectOf(attrs, owner);
  const discriminator = discriminatorOf(attrs);
  const rest = discriminator ? `${discriminator.name}=${discriminator.value}` : `shape=${shapeOf(attrs)}`;
  return { key: `${project.method}:${project.label}|${rest}`, project, discriminator };
}

export const datasetId = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 12);

/** A name a developer can scan: the discriminator value, else the most specific attribute names. */
export function datasetName(discriminator: { value: string } | null, fieldNames: readonly string[]): string {
  if (discriminator) return discriminator.value;
  const specific = fieldNames.filter((n) => !LABEL_ATTRS.includes(n));
  const picked = (specific.length ? specific : fieldNames).slice(0, 3);
  return picked.length ? picked.join(" · ") : "(no attributes)";
}

/** app: three writers or fewer. mixed: one writer holds at least half. user: many, none dominant. */
export function classifyOwnership(recordsPerWriter: readonly number[]): Ownership {
  if (recordsPerWriter.length <= 3) return "app";
  const total = recordsPerWriter.reduce((a, b) => a + b, 0);
  return Math.max(...recordsPerWriter) / total >= 0.5 ? "mixed" : "user";
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/**
 * Label conflicts: datasets sharing a label are linked when they share a writer. More than one
 * linked group means unrelated wallets use the label. Returns the group count per dataset index.
 */
export function labelGroups(writersPerDataset: readonly ReadonlySet<string>[]): number {
  const parent = writersPerDataset.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const owner = new Map<string, number>();
  writersPerDataset.forEach((writers, i) => {
    for (const w of writers) {
      const j = owner.get(w);
      if (j === undefined) owner.set(w, i);
      else parent[find(i)] = find(j);
    }
  });
  return new Set(parent.map((_, i) => find(i))).size;
}

/** Shown as a percentage beside the method; documented as a heuristic in the UI tooltip. */
export const confidenceOf = (method: "label" | "creator", conflictGroups: number) =>
  method === "creator" ? 0.55 : conflictGroups > 1 ? 0.6 : 0.92;
