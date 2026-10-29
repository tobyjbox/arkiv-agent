import { type DatasetParse, isFree, mentionAt } from "../parse.ts";
import { CONJUNCTION, isNumber, ORDERED, parseNumber } from "../tokens.ts";
import { negationsBefore } from "./negation.ts";

/** The numeric field named near a range: just before it, then just after, then further back. */
function orderedNear(p: DatasetParse, before: number, after: number) {
  const { lows } = p;
  for (let k = before; k >= Math.max(0, before - 2); k--) { const f = mentionAt(p, k, (x) => ORDERED.has(x.type)); if (f) return { f, k }; if (CONJUNCTION.test(lows[k] ?? "")) break; }
  for (const k of [after, after + 1]) { if (CONJUNCTION.test(lows[k] ?? "")) break; const f = mentionAt(p, k, (x) => ORDERED.has(x.type)); if (f) return { f, k }; }
  for (let k = before; k >= Math.max(0, before - 4); k--) { const f = mentionAt(p, k, (x) => ORDERED.has(x.type)); if (f) return { f, k }; }
  return null;
}

/**
 * Ranges: "between 1000 and 5000" (both bounds), "not between 1000 and 5000" (below or above), and
 * "10 or more" / "5 or less" (one bound, inclusive).
 */
export function ranges(p: DatasetParse): void {
  const { tokens, lows, consumed, conds } = p;
  for (let i = 0; i < tokens.length; i++) {
    if (!isFree(p, i)) continue;
    if (lows[i] === "between" && isNumber(lows[i + 1] ?? "") && lows[i + 2] === "and" && isNumber(lows[i + 3] ?? "")) {
      const hit = orderedNear(p, i - 1, i + 4);
      if (!hit) continue;
      const [a, b] = [parseNumber(lows[i + 1]!), parseNumber(lows[i + 3]!)].sort((x, y) => x - y);
      const negs = negationsBefore(p, i);
      const f = hit.f;
      if (negs.length) {
        conds.push({ attr: f.name, q: { op: "or", terms: [{ op: "lt", attr: f.name, type: f.type, value: String(a) }, { op: "gt", attr: f.name, type: f.type, value: String(b) }] }, tokens: [i, ...negs] });
      } else {
        conds.push({ attr: f.name, q: { op: "gte", attr: f.name, type: f.type, value: String(a) }, tokens: [i] });
        conds.push({ attr: f.name, q: { op: "lte", attr: f.name, type: f.type, value: String(b) }, tokens: [i] });
      }
      [i, i + 1, i + 2, i + 3, hit.k, ...negs].forEach((k) => consumed.add(k));
    } else if (isNumber(lows[i]!) && lows[i + 1] === "or" && /^(more|above|higher|greater|over|less|below|lower|fewer|under)$/.test(lows[i + 2] ?? "")) {
      const hit = orderedNear(p, i - 1, i + 3);
      if (!hit) continue;
      const op = /^(more|above|higher|greater|over)$/.test(lows[i + 2]!) ? "gte" : "lte";
      conds.push({ attr: hit.f.name, q: { op, attr: hit.f.name, type: hit.f.type, value: String(parseNumber(lows[i]!)) }, tokens: [i] });
      [i, i + 1, i + 2, hit.k].forEach((k) => consumed.add(k));
    }
  }
}
