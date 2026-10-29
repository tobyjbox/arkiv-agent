import { casedLike, type DatasetParse, lookupSpan, runsFrom, textOf } from "../parse.ts";
import { PLACE_WORDS, words } from "../tokens.ts";
import { bind } from "./negation.ts";

/**
 * Places: "in Nashik", "from Jharkhand", "at Pune" fill a place field (city, district, state…). A
 * stored value wins; else a capitalised word, when the dataset has exactly one place field.
 */
export function places(p: DatasetParse): void {
  const { tokens, lows, explain, strFields } = p;
  const placeFields = strFields.filter((f) => words(f.name).some((w) => PLACE_WORDS.test(w)));
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!/^(in|at|from|near)$/.test(lows[i]!) || !placeFields.length) continue;
    const runs = runsFrom(p, i + 1);
    if (!runs.length) continue;
    const found = runs.map((span) => ({ span, hits: lookupSpan(p, span, placeFields) })).find((r) => r.hits.length);
    if (found) {
      const top = found.hits[0]!;
      const field = placeFields.find((f) => f.name === top.field)!;
      bind(p, field, top.value, [i, ...found.span]);
      const others = [...new Set(found.hits.slice(1).map((h) => h.field))].filter((f) => f !== top.field);
      explain.push(`“${textOf(p, found.span)}” read as ${field.name} = “${top.value}”${others.length ? ` (also a value of ${others.join(", ")}; name the field to choose)` : ""}.`);
      continue;
    }
    const span = runs[runs.length - 1]!;
    const word = tokens[span[0]!]!;
    if (placeFields.length !== 1 || word.raw[0] !== word.raw[0]!.toUpperCase() || /^\d/.test(word.raw)) continue;
    const field = placeFields[0]!;
    const value = casedLike(field, word.raw);
    bind(p, field, value, [i, ...span]);
    explain.push(`“${word.raw}” read as ${field.name} = “${value}”; ArkivAgent hasn't seen that value, so it may match nothing.`);
  }
}
