// The last step of interpret(): the conditions combined into one query, plus the words nothing used.
import type { AskPlan, AskQuery } from "../query.ts";
import { mentions } from "./fields.ts";
import type { Cond, Parse } from "./parse.ts";
import { FILLER, STOP, type Token } from "./tokens.ts";

/** "how many", "count": Arkiv has no count for a query, so say how results come instead. */
export function countNote(p: Parse): void {
  if (p.tokens.some((t, i) => t.low === "many" && p.lows[i - 1] === "how") || p.tokens.some((t) => t.low === "count")) {
    p.explain.push("Arkiv has no count for a query: results come a page at a time (Load more).");
  }
}

/** Never drop a word silently: whatever wasn't used is reported with the plan. */
function ignoredWords(p: Parse): string[] {
  const applied = new Set(p.conds.map((c) => c.attr));
  const appliedField = (t: Token) => (p.dataset?.schema ?? []).some((f) => applied.has(f.name) && mentions(t, f));
  return p.tokens
    .filter((t, i) => !p.consumed.has(i) && !STOP.has(t.low) && !FILLER.has(t.low) && /[\p{L}\p{N}]/u.test(t.low) && !appliedField(t))
    .map((t) => t.raw);
}

/** Clauses joined by "or" ("x over 20 or y under 5") form one OR group; the rest are all required. */
function mergeOr(p: Parse): Cond[] {
  const ordered = [...p.conds].sort((a, b) => Math.min(...a.tokens) - Math.min(...b.tokens));
  const merged: Cond[] = [];
  for (const c of ordered) {
    const prev = merged[merged.length - 1];
    const between = prev ? p.lows.slice(Math.max(...prev.tokens) + 1, Math.min(...c.tokens)) : [];
    if (prev && between.includes("or") && !between.includes("and") && prev.attr !== c.attr) {
      const terms = prev.q.op === "or" ? [...prev.q.terms, c.q] : [prev.q, c.q];
      merged[merged.length - 1] = { attr: `${prev.attr}|${c.attr}`, q: { op: "or", terms }, tokens: [...prev.tokens, ...c.tokens] };
    } else merged.push(c);
  }
  return merged;
}

/** Same field, several values: any of them ("CDSCO or State drug lab"). Everything else: all of them. */
function combine(conds: Cond[]): AskQuery | null {
  const groups = new Map<string, AskQuery[]>();
  const rest: AskQuery[] = [];
  for (const c of conds) {
    if (c.q.op === "eq" && !c.attr.startsWith("$")) groups.set(c.attr, [...(groups.get(c.attr) ?? []), c.q]);
    else rest.push(c.q);
  }
  const terms = [...[...groups.values()].map((g): AskQuery => (g.length === 1 ? g[0]! : { op: "or", terms: g })), ...rest];
  return terms.length === 0 ? null : terms.length === 1 ? terms[0]! : { op: "and", terms };
}

/** The plan. A follow-up on the same dataset keeps the previous turn's conditions too. */
export function buildPlan(p: Parse): AskPlan {
  const { ctx, dataset } = p;
  const ignored = ignoredWords(p);
  let where = combine(mergeOr(p));
  if (ctx.previous?.where && dataset && ctx.previous.datasetId === dataset.id && !ctx.scope) {
    where = where ? { op: "and", terms: [ctx.previous.where, where] } : ctx.previous.where;
  }
  return { datasetId: dataset?.id ?? null, where, limit: p.limit, explain: p.explain.slice(0, 6), ignored: ignored.slice(0, 12) };
}
