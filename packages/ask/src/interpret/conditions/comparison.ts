import type { SchemaField } from "@arkiv-agent/catalogue";
import { durationUnit, scaleOf } from "../fields.ts";
import { type DatasetParse, mentionAt } from "../parse.ts";
import { COMPARATORS, CONJUNCTION, isNumber, NUMBER_WORDS, ORDERED, parseNumber, TIME_UNITS } from "../tokens.ts";

const UNIT_WORD = /^(grams?|g|kg|percent|%|rupees|inr|usd|dollars)$/;

/** The numeric field a comparison at `i` (phrase ending before `numIdx`) is about, and the tokens that named it. */
function comparedField(p: DatasetParse, i: number, numIdx: number, usedIdx: number[]): SchemaField | undefined {
  const { tokens, lows } = p;
  const ordered = (f: SchemaField) => ORDERED.has(f.type);
  let field: SchemaField | undefined;
  // "x greater than 10": the field right before (only "is", "of"… between) wins. Then "more than
  // 10000 events": right after the number (or its unit). Then further back. Never across and/or.
  for (let k = i - 1; k >= Math.max(0, i - 3) && !field; k--) {
    field = mentionAt(p, k, ordered);
    if (field) usedIdx.push(k);
    else if (!/^(is|are|was|be|of|its|the)$/.test(lows[k]!)) break;
  }
  for (const k of [numIdx + 1, numIdx + 2]) {
    if (field || k >= tokens.length || CONJUNCTION.test(lows[k]!)) break;
    field = mentionAt(p, k, ordered);
    if (field) usedIdx.push(k);
    else if (k === numIdx + 1 && !(TIME_UNITS[lows[k]!] || UNIT_WORD.test(lows[k]!))) break;
  }
  for (let k = i - 1; k >= Math.max(0, i - 5) && !field; k--) {
    if (CONJUNCTION.test(lows[k]!)) break;
    field = mentionAt(p, k, ordered);
    if (field) usedIdx.push(k);
  }
  return field;
}

/**
 * Numeric comparisons: "ctc over 1500000", "more than 10000 events", "longer than 3 hours". Durations
 * convert to the field's unit (`duration_min`), and scaled fields (`temp_x100`, `_cents`) scale the value.
 */
export function comparisons(p: DatasetParse): void {
  const { tokens, lows, consumed, conds, explain, fields } = p;
  for (let i = 0; i < tokens.length; i++) {
    const hit = COMPARATORS.find(([c]) => c.every((w, j) => lows[i + j] === w));
    if (!hit || consumed.has(i)) continue;
    const [phrase, op] = hit;
    const numIdx = i + phrase.length;
    const numTok = lows[numIdx];
    if (!numTok) continue;
    // "ten" as well as "10", "10k", "30°c".
    const unitMatch = numTok in NUMBER_WORDS ? ([numTok, numTok] as const) : /^(-?\d[\d,]*(?:\.\d+)?[km]?)([a-z°%]+)?$/i.exec(numTok);
    if (!unitMatch || !isNumber(unitMatch[1]!)) continue;
    let value = parseNumber(unitMatch[1]!);
    const unitWord = unitMatch[2]?.toLowerCase() ?? lows[numIdx + 1];
    const unitIsWord = !unitMatch[2] && unitWord !== undefined;
    const usedIdx = Array.from({ length: phrase.length + 1 }, (_, k) => i + k);
    let field = comparedField(p, i, numIdx, usedIdx);
    const secsPer = unitWord ? TIME_UNITS[unitWord] : undefined;
    if (!field && secsPer) field = fields.find((f) => ORDERED.has(f.type) && durationUnit(f) !== null);
    if (!field) continue;
    if (unitIsWord && (secsPer || UNIT_WORD.test(unitWord!))) usedIdx.push(numIdx + 1);
    const fieldUnit = durationUnit(field);
    if (secsPer && fieldUnit) {
      const converted = (value * secsPer) / fieldUnit;
      const unitName = { 0.001: "milliseconds", 1: "seconds", 60: "minutes", 3600: "hours", 86400: "days" }[fieldUnit] ?? "its unit";
      explain.push(`${value} ${unitWord} = ${converted} ${unitName} (${field.name}).`);
      value = converted;
    }
    const scale = scaleOf(field);
    if (scale) { explain.push(`${value} stored as ${value * scale.factor} (${scale.note}).`); value *= scale.factor; }
    if (field.type !== "dec") value = Math.round(value);
    usedIdx.forEach((k) => consumed.add(k));
    conds.push({ attr: field.name, q: { op, attr: field.name, type: field.type, value: String(value) }, tokens: usedIdx });
  }
}
