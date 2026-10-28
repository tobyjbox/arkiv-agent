import { z } from "zod";

/** Value types an Arkiv attribute can carry (the catalogue's inferred types). */
export const ATTR_TYPES = ["bool", "i32", "u64", "u256", "dec", "bytes32", "str", "addr", "key"] as const;
export type AttrType = (typeof ATTR_TYPES)[number];

/** Attributes the node indexes besides user attributes, with their fixed types. */
export const SYSTEM_ATTRS = { $owner: "addr", $creator: "addr", $expiresAt: "u64", $key: "key" } as const satisfies Record<string, AttrType>;

export type Comparison = { op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; attr: string; type: AttrType; value: string };
export type Prefix = { op: "startsWith"; attr: string; value: string };
export type AskQuery = Comparison | Prefix | { op: "and" | "or"; terms: AskQuery[] } | { op: "not"; term: AskQuery };

/** What a question becomes: which dataset to read (its own predicates are added), and the conditions on it. */
export type AskPlan = {
  /** Catalogue dataset id, or null to query across all datasets. */
  datasetId: string | null;
  where: AskQuery | null;
  limit: number;
  /** Short notes for the reader: dataset choice, unit conversions, assumptions. */
  explain: string[];
};

const attrName = z.string().min(1).max(64);
const ComparisonSchema = z.object({ op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte"]), attr: attrName, type: z.enum(ATTR_TYPES), value: z.string().max(200) });
const PrefixSchema = z.object({ op: z.literal("startsWith"), attr: attrName, value: z.string().min(1).max(128) });
export const AskQuerySchema: z.ZodType<AskQuery> = z.lazy(() =>
  z.union([
    ComparisonSchema,
    PrefixSchema,
    z.object({ op: z.enum(["and", "or"]), terms: z.array(AskQuerySchema).min(1).max(8) }),
    z.object({ op: z.literal("not"), term: AskQuerySchema }),
  ]),
);

export const MAX_RESULTS = 50;

export const AskPlanSchema = z.object({
  datasetId: z.string().max(32).nullable(),
  where: AskQuerySchema.nullable(),
  limit: z.number().int().min(1).max(MAX_RESULTS),
  explain: z.array(z.string().max(300)).max(6),
});

/** Order-insensitive form, for comparing plans: nested groups flattened, terms sorted. */
export function canonical(q: AskQuery | null): AskQuery | null {
  if (!q) return null;
  if (q.op === "not") return { op: "not", term: canonical(q.term)! };
  if (q.op === "and" || q.op === "or") {
    const terms = q.terms.map((t) => canonical(t)!).flatMap((t) => (t.op === q.op ? (t as { terms: AskQuery[] }).terms : [t]));
    if (terms.length === 1) return terms[0]!;
    return { op: q.op, terms: terms.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
  }
  return q;
}

/** Each leaf condition, in reading order (for chips). */
export function leaves(q: AskQuery | null): (Comparison | Prefix)[] {
  if (!q) return [];
  if (q.op === "not") return leaves(q.term);
  if (q.op === "and" || q.op === "or") return q.terms.flatMap(leaves);
  return [q as Comparison | Prefix];
}
