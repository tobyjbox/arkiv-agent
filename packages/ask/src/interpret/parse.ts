// The state interpret()'s steps share: the question's tokens, which of them are used up, and the
// conditions and notes found so far. Each parser marks the tokens it reads as consumed, so a later
// parser never reads the same words again.
import type { Dataset, SchemaField } from "@arkiv-agent/catalogue";
import { type AskPlan, type AskQuery, MAX_RESULTS } from "../query.ts";
import { datasetAttrs, mentions } from "./fields.ts";
import { COMPARATORS, NEGATION, STOP, stem, type Token, tokenize, words } from "./tokens.ts";

export type AskContext = {
  datasets: Dataset[];
  /** Indexed head block, for expiry windows. */
  head: number;
  /** Wall clock in ms, for "last 7 days". */
  now: number;
  /** Restrict to one dataset (arriving from a dataset page). */
  scope?: string | null;
  /** The previous turn, so a follow-up ("only in Surat") narrows it. */
  previous?: AskPlan | null;
  /**
   * Stored text values of a dataset equal to `text` (ignoring case), across `fields`. The app looks
   * in the whole index; without it only the catalogue's three examples per field are known.
   */
  lookup?: (datasetId: string, text: string, fields: readonly string[]) => { field: string; value: string; count: number }[];
};

export type NotUnderstood = { kind: "not-understood"; message: string };

/** A condition and the tokens it came from. */
export type Cond = { attr: string; q: AskQuery; tokens: number[] };

export type Parse = {
  ctx: AskContext;
  tokens: Token[];
  /** Each token's lowercase text. */
  lows: string[];
  /** Tokens a step has used. */
  consumed: Set<number>;
  conds: Cond[];
  explain: string[];
  limit: number;
  dataset: Dataset | null;
};

/** The parse once a dataset is chosen: the fields its conditions can use. */
export type DatasetParse = Parse & {
  d: Dataset;
  /** Fields that only say which dataset a record is in. */
  skip: Set<string>;
  fields: SchemaField[];
  strFields: SchemaField[];
  /** Stems of the words in field names: a value run stops at one. */
  fieldWordStems: Set<string>;
  /** The question is about expiry ("expiring", "expires"). */
  isExpiry: boolean;
};

export function startParse(question: string, ctx: AskContext): Parse {
  const tokens = tokenize(question);
  return { ctx, tokens, lows: tokens.map((t) => t.low), consumed: new Set(), conds: [], explain: [], limit: MAX_RESULTS, dataset: null };
}

export function forDataset(p: Parse, d: Dataset): DatasetParse {
  const skip = datasetAttrs(d);
  const fields = d.schema.filter((f) => !skip.has(f.name) && !f.name.includes("*"));
  return Object.assign(p, {
    d, skip, fields,
    strFields: fields.filter((f) => f.type === "str"),
    fieldWordStems: new Set(fields.flatMap((f) => words(f.name).filter((w) => w.length >= 3).map(stem))),
    isExpiry: p.tokens.some((t) => t.low.startsWith("expir")),
  });
}

export const isFree = (p: Parse, k: number) => k >= 0 && k < p.tokens.length && !p.consumed.has(k);

/** The field (passing `pred`) that the token at `i` names, unless that token is used up. */
export const mentionAt = (p: DatasetParse, i: number, pred: (f: SchemaField) => boolean = () => true) =>
  i < 0 || i >= p.tokens.length || p.consumed.has(i) ? undefined : p.fields.find((f) => pred(f) && mentions(p.tokens[i]!, f));

export const textOf = (p: Parse, span: number[], sep = " ") => span.map((k) => p.tokens[k]!.raw).join(sep);

/** Spans of free words starting at k, longest first (up to 3), that could be one value. */
export function runsFrom(p: DatasetParse, k: number): number[][] {
  const { tokens, lows } = p;
  let end = k;
  const startsComparison = (j: number) => COMPARATORS.some(([c]) => c.every((w, n) => lows[j + n] === w));
  while (end - k < 3 && isFree(p, end) && (tokens[end]!.quoted || (!STOP.has(lows[end]!) && !NEGATION.has(lows[end]!) && !p.fieldWordStems.has(tokens[end]!.stem) && !startsComparison(end)))) end++;
  return Array.from({ length: end - k }, (_, n) => Array.from({ length: end - k - n }, (_, j) => k + j));
}

/** Index lookup for a span, trying "delhi ncr" as delhi_ncr and delhi-ncr too. */
export function lookupSpan(p: DatasetParse, span: number[], among: SchemaField[]) {
  if (!p.ctx.lookup || !among.length) return [];
  const names = among.map((f) => f.name);
  for (const sep of [" ", "_", "-"]) {
    if (sep !== " " && span.length === 1) break;
    const hits = p.ctx.lookup(p.d.id, textOf(p, span, sep), names);
    if (hits.length) return hits;
  }
  return [];
}

/** A typed value in the case the field's stored examples use (all upper or all lower), else as typed. */
export function casedLike(field: SchemaField, typed: string): string {
  const ex = field.examples.filter((e) => /[a-z]/i.test(e));
  if (ex.length && ex.every((e) => e === e.toUpperCase())) return typed.toUpperCase();
  if (ex.length && ex.every((e) => e === e.toLowerCase())) return typed.toLowerCase();
  return typed;
}

/** Words from i that name `f` ("lender type" for lender_type), as an end index. */
export function fieldEnd(p: Parse, i: number, f: SchemaField): number {
  const fw = words(f.name).map(stem);
  const seen = new Set([p.tokens[i]!.stem]);
  let k = i + 1;
  while (isFree(p, k) && fw.includes(p.tokens[k]!.stem) && !seen.has(p.tokens[k]!.stem)) seen.add(p.tokens[k++]!.stem);
  return k;
}
