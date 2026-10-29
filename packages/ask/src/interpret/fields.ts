// What a dataset's schema says about a question: which field a word names, which stored example
// values it contains, and a field's time unit, duration unit or scale.
import type { Dataset, SchemaField } from "@arkiv-agent/catalogue";
import { STOP, stem, type Token, words } from "./tokens.ts";

const looksLikeHash = (v: string) => /^(0x)?[0-9a-f]{12,}$/i.test(v);

/**
 * Where a stored example value appears in the question (token span), e.g. "State drug lab". One-word
 * values also match inflections ("challenge" for "challenges", "withdrawals" for "withdraw") and
 * compounds with the dataset's own name ("downvotes" for dir = "down" in votes).
 */
export function findValue(tokens: Token[], value: string, nameWords: string[] = []): [number, number] | null {
  const variants = [...new Set([value.toLowerCase(), value.toLowerCase().replace(/[_-]+/g, " ")])];
  for (const v of variants) {
    const parts = v.split(/\s+/);
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      if (parts.every((p, j) => tokens[i + j]!.low === p)) return [i, i + parts.length];
    }
  }
  const v = value.toLowerCase();
  if (/\s/.test(v)) return null;
  const i = tokens.findIndex((t) => {
    if (t.quoted || t.low.length <= v.length) return t.stem === stem(v) && v.length >= 4;
    const rest = t.low.slice(v.length);
    if (!t.low.startsWith(v)) return false;
    return (v.length >= 5 && /^(al|als|s|es|ed|ing|ings)$/.test(rest)) || (v.length >= 2 && nameWords.some((w) => stem(rest) === stem(w)));
  });
  return i >= 0 ? [i, i + 1] : null;
}

/** The attribute a token names: exact name, or one of its words (stemmed) of 3+ letters. */
export function mentions(t: Token, f: SchemaField): boolean {
  if (t.low === f.name.toLowerCase()) return true;
  if (STOP.has(t.low)) return false;
  const ws = words(f.name);
  if (ws.length === 1) return t.stem === stem(ws[0]!) || (ws[0]!.length === 1 && t.low === ws[0]);
  return ws.some((w) => w.length >= 3 && !/^(at|ms|id|num|raw|key|ym|ts)$/.test(w) && t.stem === stem(w));
}

/** Fields that only say which dataset a record is in; the dataset predicates already cover them. */
export const datasetAttrs = (d: Dataset) => new Set([d.project.labelAttr, d.discriminator?.name].filter(Boolean) as string[]);

export type ValueHit = { field: SchemaField; value: string; span: [number, number] };

/** Stored example values of the dataset's text fields that appear in the question, outside `blocked` tokens. */
export function valueHits(d: Dataset, tokens: Token[], blocked: Set<number>): ValueHit[] {
  const skip = datasetAttrs(d);
  const hits: ValueHit[] = [];
  for (const f of d.schema) {
    if (f.type !== "str" || skip.has(f.name)) continue;
    for (const e of f.examples) {
      if (e.length < 3 || e.length > 60 || /^\d+$/.test(e) || looksLikeHash(e) || STOP.has(e.toLowerCase())) continue;
      const span = findValue(tokens, e, d.discriminator ? words(d.discriminator.value) : []);
      if (!span) continue;
      let free = true;
      for (let i = span[0]; i < span[1]; i++) if (blocked.has(i)) free = false;
      if (free) hits.push({ field: f, value: e, span });
    }
  }
  return hits;
}

/** A record-time attribute and its unit, judged from its name and the magnitude of its values. */
export function timeField(d: Dataset): { field: SchemaField; unit: "ms" | "s" | "block" } | null {
  const candidates = d.schema.flatMap((f) => {
    if (f.type !== "u64" && f.type !== "i32") return [];
    const ws = words(f.name);
    const timeish = ws.some((w) => /^(at|ts|time|timestamp|date|created|updated|reported|seen|observed|issued|computed|fired|block)$/.test(w)) || f.name === "t";
    if (!timeish) return [];
    const nums = f.examples.map(Number).filter(Number.isFinite);
    if (!nums.length) return [];
    const v = nums[0]!;
    const unit = v >= 1e12 && v < 1e14 ? "ms" : v >= 1e9 && v < 1e11 ? "s" : ws.includes("block") ? "block" : null;
    if (!unit) return [];
    const rank = ws.includes("created") ? 0 : ws.some((w) => /^(reported|seen|observed|issued|at|ts|t)$/.test(w)) || f.name === "t" ? 1 : 2;
    return [{ field: f, unit: unit as "ms" | "s" | "block", rank }];
  });
  candidates.sort((a, b) => a.rank - b.rank || b.field.presence - a.field.presence);
  return candidates[0] ?? null;
}

/** Seconds in a duration attribute's unit, from its name suffix (`duration_min`, `dur_s`, `lag_d`). */
export function durationUnit(f: SchemaField): number | null {
  const ws = words(f.name);
  const last = ws[ws.length - 1]!;
  if (!ws.some((w) => /^(dur|duration|minutes|mins|secs|seconds|hours|lag|length|elapsed|wait)$/.test(w)) && ws.length > 1 && !/^(min|s|sec|h|d)$/.test(last)) return null;
  const units: Record<string, number> = { ms: 0.001, s: 1, sec: 1, secs: 1, seconds: 1, min: 60, mins: 60, minutes: 60, h: 3600, hr: 3600, hours: 3600, d: 86_400, days: 86_400 };
  return units[last] ?? (ws.length === 1 && units[ws[0]!] ? units[ws[0]!]! : null);
}

/** Scale implied by a name suffix: `temp_c_x100` stores hundredths, `price_cents` cents. */
export function scaleOf(f: SchemaField): { factor: number; note: string } | null {
  const x = /_x(\d+)$/i.exec(f.name);
  if (x) return { factor: Number(x[1]), note: `${f.name} stores values ×${x[1]}` };
  if (/_cents$/i.test(f.name)) return { factor: 100, note: `${f.name} is in cents` };
  return null;
}
