// Client-side plan helpers. Types only from @arkiv-agent/ask: the package itself is server code.
import type { AskPlan, AskQuery, AskRow, AttrType, Comparison, Prefix } from "@arkiv-agent/ask";
import type { DatasetBrief } from "../../lib/ask";

export type { AskPlan, AskQuery, AskRow, AttrType };
export type Leaf = Comparison | Prefix;

export type Interpreted = {
  engine: "rules" | "claude";
  plan: AskPlan;
  query: string;
  typescript: string;
  note: string | null;
  dataset: DatasetBrief | null;
  explorerUrl: string;
};

export type Failure = { kind: "not-understood" | "invalid" | "refused" | "timeout" | "rpc"; message: string };

export const OP_SYMBOL: Record<Leaf["op"], string> = { eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", startsWith: "starts with" };
export const OP_WORDS: Record<Leaf["op"], string> = { eq: "equals", ne: "is not", gt: "greater than", gte: "at least", lt: "less than", lte: "at most", startsWith: "starts with" };
const ORDERED = new Set<string>(["i32", "u64", "u256", "dec"]);

export const typeOf = (l: Leaf): AttrType => (l.op === "startsWith" ? "str" : l.type);

export function opsFor(type: AttrType): Leaf["op"][] {
  if (ORDERED.has(type)) return ["eq", "ne", "gt", "gte", "lt", "lte"];
  return type === "str" ? ["eq", "ne", "startsWith"] : ["eq", "ne"];
}

/** Why a value doesn't fit the attribute's type, or null when it does (the server checks again). */
export function invalidValue(type: AttrType, v: string): string | null {
  switch (type) {
    case "i32": return /^-?\d+$/.test(v) && Math.abs(Number(v)) <= 2_147_483_647 ? null : "Whole number between -2,147,483,648 and 2,147,483,647.";
    case "u64": return /^\d+$/.test(v) && BigInt(v) < 2n ** 64n ? null : "Whole number, 0 or more.";
    case "u256": return /^\d+$/.test(v) ? null : "Whole number, 0 or more.";
    case "dec": return /^-?\d+(\.\d+)?$/.test(v) ? null : "A decimal number, like 0.05.";
    case "bool": return v === "true" || v === "false" ? null : "true or false.";
    case "addr": return /^0x[0-9a-fA-F]{40}$/.test(v) ? null : "A 0x address (40 hex characters).";
    case "key":
    case "bytes32": return /^0x[0-9a-fA-F]{64}$/.test(v) ? null : "0x and 64 hex characters.";
    case "str": return v.length >= 1 && new TextEncoder().encode(v).length <= 128 ? null : "1 to 128 bytes of text.";
  }
}

/** The node at a path of child indexes (and/or: terms[i]; not: 0 is its term). */
export function replaceAt(q: AskQuery, path: number[], next: AskQuery | null): AskQuery | null {
  if (!path.length) return next;
  const [i, ...rest] = path as [number, ...number[]];
  if (q.op === "not") {
    const term = replaceAt(q.term, rest, next);
    return term ? { op: "not", term } : null;
  }
  if (q.op === "and" || q.op === "or") {
    const terms = q.terms.flatMap((t, k) => (k === i ? [replaceAt(t, rest, next)].filter((x): x is AskQuery => x !== null) : [t]));
    return terms.length === 0 ? null : terms.length === 1 ? terms[0]! : { op: q.op, terms };
  }
  return q;
}

/** Every leaf with its path and whether a NOT wraps it, in reading order. */
export function leafPaths(q: AskQuery | null, path: number[] = [], negated = false): { path: number[]; leaf: Leaf; negated: boolean }[] {
  if (!q) return [];
  if (q.op === "not") return leafPaths(q.term, [...path, 0], !negated);
  if (q.op === "and" || q.op === "or") return q.terms.flatMap((t, i) => leafPaths(t, [...path, i], negated));
  return [{ path, leaf: q as Leaf, negated }];
}

export const chipText = (l: Leaf, negated: boolean) => `${negated ? "NOT " : ""}${l.attr} ${OP_SYMBOL[l.op]} ${l.value}`;

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await r.json().catch(() => ({ error: `HTTP ${r.status}` }))) as T & { error?: string };
  if (!r.ok && json.error) return { ok: false, kind: "invalid", message: json.error } as T;
  return json;
}

export type InterpretResponse = ({ ok: true } & Interpreted) | ({ ok: false; examples: string[] } & Failure);
export type RunResponse =
  | { ok: true; query: string; typescript: string; explorerUrl: string; rows: AskRow[]; block: string; cursor: string | null; ms: number }
  | ({ ok: false; query?: string; typescript?: string; explorerUrl?: string } & Failure);

export const askApi = (body: { question: string; scope: string | null; previous: AskPlan | null }) => post<InterpretResponse>("/api/ask", body);
export const runApi = (body: { plan: AskPlan; cursor?: string | null; block?: string | null }) => post<RunResponse>("/api/ask/run", body);
