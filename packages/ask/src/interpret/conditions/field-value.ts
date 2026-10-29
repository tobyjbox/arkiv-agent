import type { SchemaField } from "@arkiv-agent/catalogue";
import { mentions } from "../fields.ts";
import { casedLike, type DatasetParse, fieldEnd, isFree, lookupSpan, runsFrom, textOf } from "../parse.ts";
import { isNumber, ORDERED, parseNumber, words } from "../tokens.ts";
import { bind } from "./negation.ts";

/** A text field's value after its name: a stored value from the index if one matches, else one word as typed. */
function textValue(p: DatasetParse, field: SchemaField, fieldSpan: number[], k: number): void {
  const runs = runsFrom(p, k);
  if (!runs.length) return;
  const found = runs.map((span) => ({ span, hit: lookupSpan(p, span, [field])[0] })).find((r) => r.hit);
  if (found?.hit) {
    bind(p, field, found.hit.value, [...fieldSpan, ...found.span]);
    if (textOf(p, found.span) !== found.hit.value) p.explain.push(`“${textOf(p, found.span)}” matched the stored value ${field.name} = “${found.hit.value}”.`);
    return;
  }
  // Not a stored value: take one word (or the quoted text) as typed, cased like the examples, and say so.
  const span = runs[runs.length - 1]!;
  const token = p.tokens[span[0]!]!;
  const value = token.quoted ? token.raw : casedLike(field, token.raw);
  bind(p, field, value, [...fieldSpan, ...span]);
  p.explain.push(`${field.name} = “${value}” is not among the values ArkivAgent has seen, so it may match nothing (values are exact).`);
}

/** A field named, then its value: "district Doda", "asset LINK", "city: Pune", "shift 2", "lender type NBFC". */
export function fieldValues(p: DatasetParse): void {
  const { tokens, lows, consumed, conds, fields } = p;
  for (let i = 0; i < tokens.length; i++) {
    if (!isFree(p, i)) continue;
    const candidates = fields.filter((f) => f.type !== "bool" && mentions(tokens[i]!, f));
    const field = candidates.sort((a, b) => fieldEnd(p, i, b) - fieldEnd(p, i, a) || words(a.name).length - words(b.name).length)[0];
    if (!field) continue;
    let k = fieldEnd(p, i, field);
    const fieldSpan = Array.from({ length: k - i }, (_, n) => i + n);
    while (isFree(p, k) && /^(is|=|==|:|equals|equal|to|of|exactly)$/.test(lows[k]!)) k++;
    if (!isFree(p, k)) continue;
    if (ORDERED.has(field.type)) {
      if (!isNumber(lows[k]!)) continue;
      conds.push({ attr: field.name, q: { op: "eq", attr: field.name, type: field.type, value: String(parseNumber(lows[k]!)) }, tokens: [...fieldSpan, k] });
      [...fieldSpan, k - 1, k].forEach((j) => j > i && consumed.add(j));
      fieldSpan.forEach((j) => consumed.add(j));
      continue;
    }
    if (field.type === "addr" || field.type === "key" || field.type === "bytes32") {
      if (!/^0x[0-9a-f]+$/i.test(tokens[k]!.raw)) continue;
      bind(p, field, tokens[k]!.raw, [...fieldSpan, k]);
      continue;
    }
    if (field.type === "str") textValue(p, field, fieldSpan, k);
  }
}
