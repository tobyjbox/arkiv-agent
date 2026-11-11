// What a project appears to use its data for, from the words in its label, dataset names and
// attribute names. A keyword vote, not a model: the evidence is returned so the UI can show it.
import type { ArchetypeId, Purpose } from "./types.ts";

export const ARCHETYPES: Record<Exclude<ArchetypeId, "unclear">, { label: string; words: string[] }> = {
  marketplace: { label: "Marketplace", words: ["price", "seller", "buyer", "order", "listing", "offer", "bid", "sku", "product", "cart", "payment", "escrow", "marketplace", "shop", "store", "auction"] },
  social: { label: "Messaging and social", words: ["message", "inbox", "post", "comment", "follower", "thread", "chat", "reply", "like", "feed", "channel", "subscription", "mention", "dm"] },
  identity: { label: "Identity and consent", words: ["consent", "credential", "did", "kyc", "identity", "profile", "fiduciary", "principal", "attestation", "attest", "proof", "verifier", "issuer", "claim", "seal", "witness"] },
  registry: { label: "Registry and records", words: ["registry", "record", "certificate", "license", "document", "doc", "notice", "permit", "deed", "archive", "revision", "ledger", "log", "audit", "entry"] },
  logistics: { label: "Logistics and mobility", words: ["rider", "driver", "eta", "route", "delivery", "shipment", "parcel", "zone", "trip", "vehicle", "dest", "warehouse", "courier", "pickup", "supply"] },
  health: { label: "Health and medicines", words: ["hospital", "patient", "insurer", "medicine", "drug", "clinic", "lab", "dose", "mfr", "pharmacy", "diagnosis", "recall", "batch"] },
  finance: { label: "Finance and lending", words: ["lender", "loan", "borrower", "interest", "invoice", "salary", "payroll", "asset", "balance", "repay", "wage", "debt", "lease", "rent", "tax"] },
  game: { label: "Game or virtual world", words: ["world", "guild", "player", "score", "level", "tile", "structure", "inventory", "quest", "turn", "game", "match", "x", "y"] },
  civic: { label: "Civic and governance", words: ["vote", "proposal", "petition", "complaint", "grievance", "district", "authority", "case", "ballot", "citizen", "ward", "municipal", "rti", "exam"] },
  agents: { label: "AI agents and compute", words: ["agent", "model", "prompt", "job", "task", "worker", "inference", "run", "caller", "tool", "call", "trace", "memory"] },
  telemetry: { label: "Devices and telemetry", words: ["device", "sensor", "reading", "temperature", "telemetry", "meter", "voltage", "lat", "lng", "gps", "signal", "outage"] },
  files: { label: "Files and storage", words: ["file", "chunk", "manifest", "blob", "cid", "mime", "upload", "source", "filename", "bytes"] },
  test: { label: "Test or demo", words: ["test", "demo", "example", "hello", "sample", "load", "baseload", "foo", "bar", "tmp"] },
};

export const archetypeLabel = (id: ArchetypeId) => (id === "unclear" ? "Unclear" : ARCHETYPES[id].label);

/** `targetKey`, `post_key`, `Supply-Setu` → target key post key supply setu. */
export const words = (text: string): string[] =>
  text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const INDEX = new Map<string, ArchetypeId[]>();
for (const [id, a] of Object.entries(ARCHETYPES)) for (const w of a.words) INDEX.set(w, [...(INDEX.get(w) ?? []), id as ArchetypeId]);

const MIN_EVIDENCE = 2;
const MAX_EVIDENCE = 8;

/** The archetype most of the vocabulary points at; "unclear" under two matching words. */
export function classifyPurpose(vocabulary: Iterable<string>): Purpose {
  const hits = new Map<ArchetypeId, Set<string>>();
  for (const text of vocabulary) {
    for (const w of words(text)) {
      // Plurals count: `orders` votes as `order`.
      const ids = INDEX.get(w) ?? (w.endsWith("s") ? INDEX.get(w.slice(0, -1)) : undefined);
      const word = INDEX.has(w) ? w : w.slice(0, -1);
      for (const id of ids ?? []) (hits.get(id) ?? hits.set(id, new Set()).get(id)!).add(word);
    }
  }
  const ranked = [...hits].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
  const top = ranked[0];
  if (!top || top[1].size < MIN_EVIDENCE) return { archetype: "unclear", confidence: 0, evidence: top ? [...top[1]] : [], runnerUp: null };
  const total = ranked.reduce((n, [, set]) => n + set.size, 0);
  const second = ranked[1];
  return {
    archetype: top[0], confidence: top[1].size / total, evidence: [...top[1]].sort().slice(0, MAX_EVIDENCE),
    runnerUp: second && second[1].size >= MIN_EVIDENCE ? second[0] : null,
  };
}
