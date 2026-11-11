// Record links: Arkiv has a `key` attribute type, so records can point at each other, and some
// projects store keys as text or bytes32 instead. Grouped per (dataset, attribute, target dataset).
import type { Member } from "@arkiv-agent/catalogue";
import type { RefEdge } from "./types.ts";

const KEY_RE = /^0x[0-9a-f]{64}$/;

/** Where a record key leads: its dataset when it is in the catalogue, and whether it is live. */
export type Target = { datasetId: string | null; owner: string | null; isLive: boolean };

/** Values of a record that may be record keys: every `key`, and key-shaped text or bytes32. */
export function candidateRefs(m: Member): { attr: string; value: string; isImplicit: boolean }[] {
  const out: { attr: string; value: string; isImplicit: boolean }[] = [];
  for (const [attr, a] of m.attrs) {
    if (a.type === "key") out.push({ attr, value: a.value.toLowerCase(), isImplicit: false });
    else if ((a.type === "str" || a.type === "bytes32") && KEY_RE.test(a.value.toLowerCase()) && a.value.toLowerCase() !== m.key.toLowerCase()) {
      out.push({ attr, value: a.value.toLowerCase(), isImplicit: true });
    }
  }
  return out;
}

/**
 * Groups references into edges. `resolve` returns null for a key the index has never seen: a `key`
 * attribute then counts as a broken reference, while text and bytes32 are taken to be plain hashes
 * and left out.
 */
export function inferLinks(membersById: ReadonlyMap<string, readonly Member[]>, resolve: (key: string) => Target | null): RefEdge[] {
  const edges = new Map<string, RefEdge>();
  for (const [from, members] of membersById) {
    for (const m of members) {
      for (const ref of candidateRefs(m)) {
        const target = resolve(ref.value);
        if (!target && ref.isImplicit) continue;
        const to = target?.datasetId ?? null;
        const id = `${from}|${ref.attr}|${to ?? ""}`;
        const e = edges.get(id) ?? edges.set(id, { from, to, attr: ref.attr, isImplicit: ref.isImplicit, count: 0, broken: 0, crossWallet: 0 }).get(id)!;
        e.count++;
        if (m.status === "live" && !target?.isLive) e.broken++;
        if (target?.owner && target.owner.toLowerCase() !== m.owner.toLowerCase()) e.crossWallet++;
      }
    }
  }
  return [...edges.values()].sort((a, b) => b.count - a.count);
}
