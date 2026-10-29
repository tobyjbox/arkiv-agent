import { mentions, type ValueHit, valueHits } from "../fields.ts";
import { type DatasetParse, isFree, lookupSpan, runsFrom, textOf } from "../parse.ts";
import { FILLER, NEGATION, STOP } from "../tokens.ts";
import { bind } from "./negation.ts";

/** Stored example values named in the question: "noida", "State drug lab", "tata-aig". */
export function exampleValues(p: DatasetParse): void {
  const { tokens, consumed, explain, d, skip } = p;
  const hits = valueHits(d, tokens, consumed).filter((h) => !skip.has(h.field.name));
  const bySpan = new Map<string, ValueHit[]>();
  for (const h of hits) bySpan.set(h.span.join(":"), [...(bySpan.get(h.span.join(":")) ?? []), h]);
  for (const group of bySpan.values()) {
    // The same text can be a value of two fields: prefer one the question names.
    const h = group.find((g) => tokens.some((t, i) => isFree(p, i) && mentions(t, g.field))) ?? group.sort((a, b) => b.field.presence - a.field.presence)[0]!;
    const span = Array.from({ length: h.span[1] - h.span[0] }, (_, k) => h.span[0] + k);
    if (!span.every((k) => isFree(p, k))) continue;
    bind(p, h.field, h.value, span);
    const said = textOf(p, span);
    if (said !== h.value) explain.push(`“${said}” matched the stored value ${h.field.name} = “${h.value}” (values are exact and case-sensitive).`);
  }
}

/** Any other words that are a stored value per the index lookup: "the pricing category", "millet". */
export function indexValues(p: DatasetParse): void {
  const { tokens, lows, explain, strFields } = p;
  for (let i = 0; i < tokens.length; i++) {
    if (!isFree(p, i) || STOP.has(lows[i]!) || FILLER.has(lows[i]!) || NEGATION.has(lows[i]!)) continue;
    const found = runsFrom(p, i).map((span) => ({ span, hits: lookupSpan(p, span, strFields) })).find((r) => r.hits.length);
    if (!found) continue;
    const named = found.hits.find((h) => tokens.some((t) => mentions(t, strFields.find((f) => f.name === h.field)!)));
    const top = named ?? found.hits[0]!;
    bind(p, strFields.find((f) => f.name === top.field)!, top.value, found.span);
    if (textOf(p, found.span) !== top.value) explain.push(`“${textOf(p, found.span)}” matched the stored value ${top.field} = “${top.value}”.`);
  }
}
