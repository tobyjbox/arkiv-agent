// Negation is not a pass of its own: a "not", "except" or "isn't" just before a condition's words
// turns that condition around, so the parsers that build conditions ask here.
import type { SchemaField } from "@arkiv-agent/catalogue";
import type { AskQuery } from "../../query.ts";
import { mentions } from "../fields.ts";
import { type DatasetParse, isFree, type Parse } from "../parse.ts";
import { NEGATION } from "../tokens.ts";

/** Free negation words ("not", "except", "isn't"…) among the two tokens before `k`; `orUn` also counts a lone "un". */
export const negationsBefore = (p: Parse, k: number, orUn = false) =>
  [k - 1, k - 2].filter((j) => isFree(p, j) && (NEGATION.has(p.lows[j]!) || (orUn && p.lows[j] === "un")));

/** Adds `field = value` (or NOT, after "not"/"except"), using up the words it came from. */
export function bind(p: DatasetParse, field: SchemaField, value: string, span: number[]): void {
  const negs = negationsBefore(p, span[0]!);
  const eq: AskQuery = { op: "eq", attr: field.name, type: field.type, value };
  p.conds.push({ attr: field.name, q: negs.length ? { op: "not", term: eq } : eq, tokens: span });
  [...span, ...negs].forEach((k) => p.consumed.add(k));
  // The field's own name just before ("city noida", "lender_type is not NBFC") is part of it too.
  let j = span[0]! - 1;
  while (j >= 0 && /^(is|are|was|=|:|equals|of|not|isn't)$/.test(p.lows[j]!)) j--;
  if (isFree(p, j) && mentions(p.tokens[j]!, field)) p.consumed.add(j);
}
