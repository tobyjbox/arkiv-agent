import type { SchemaField } from "@arkiv-agent/catalogue";
import { type DatasetParse, isFree } from "../parse.ts";
import { EQUALS, stem, words } from "../tokens.ts";
import { negationsBefore } from "./negation.ts";

/** One yes/no field: its words in the question, with "is", "not", "true/false" after and negations before. */
function yesNoField(p: DatasetParse, f: SchemaField): void {
  const { tokens, lows, consumed, conds } = p;
  const fw = words(f.name).map(stem);
  /** A word of this field ("known"), and whether it came negated ("unknown", "non-demo"). */
  const fieldWord = (k: number) => {
    if (!isFree(p, k)) return null;
    if (lows[k] === f.name.toLowerCase()) return { all: true, w: "", neg: false };
    if (fw.includes(tokens[k]!.stem)) return { all: false, w: tokens[k]!.stem, neg: false };
    const m = /^(un|non-?)(.{3,})$/.exec(lows[k]!);
    return m && fw.includes(stem(m[2]!)) ? { all: false, w: stem(m[2]!), neg: true } : null;
  };
  for (let i = 0; i < tokens.length; i++) {
    const first = fieldWord(i);
    if (!first) continue;
    let end = i;
    let value = true;
    const seen = new Set<string>();
    const used: number[] = [];
    for (let m = fieldWord(end); m; m = fieldWord(end)) {
      if (m.all) fw.forEach((w) => seen.add(w)); else seen.add(m.w);
      if (m.neg) value = !value;
      used.push(end++);
      if (fw.every((w) => seen.has(w))) break;
      // "expiry is known", "quote is not checked": connectors between the field's own words.
      let gap = end;
      const negations: number[] = [];
      while (isFree(p, gap) && /^(is|are|was|be|been|not|isn't)$/.test(lows[gap]!)) { if (/^(not|isn't)$/.test(lows[gap]!)) negations.push(gap); gap++; }
      if (gap > end && fieldWord(gap)) { for (let g = end; g < gap; g++) used.push(g); if (negations.length % 2) value = !value; end = gap; }
    }
    if (!fw.every((w) => seen.has(w))) continue;
    let k = end;
    if (EQUALS.has(lows[k] ?? "") || lows[k] === "are" || lows[k] === "was") used.push(k++);
    if (lows[k] === "not" || lows[k] === "isn't") { value = !value; used.push(k++); }
    if (/^(true|yes)$/.test(lows[k] ?? "")) used.push(k++);
    else if (/^(false|no)$/.test(lows[k] ?? "")) { value = !value; used.push(k++); }
    const negs = negationsBefore(p, i, true);
    if (negs.length % 2) value = !value;
    conds.push({ attr: f.name, q: { op: "eq", attr: f.name, type: "bool", value: String(value) }, tokens: [...used, ...negs] });
    [...used, ...negs].forEach((j) => consumed.add(j));
    break;
  }
}

/** Yes/no fields: "exceeds the limit", "where exp_ok is false", "that are not historical", "unverified". */
export function yesNo(p: DatasetParse): void {
  for (const f of p.fields.filter((x) => x.type === "bool")) yesNoField(p, f);
}
