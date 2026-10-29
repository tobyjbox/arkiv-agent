import { type DatasetParse, fieldEnd, isFree, mentionAt } from "../parse.ts";
import { CONJUNCTION, STOP } from "../tokens.ts";

/**
 * Presence ("without a parent_key", "with a guild") would be EXISTS, which Tiramisu's node rejects
 * (-32002, checked 2026-10-29). Adds no condition: leaves those words unused so they are reported,
 * and says why.
 */
export function presence(p: DatasetParse): void {
  const { tokens, lows, conds, explain } = p;
  for (let i = 0; i < tokens.length; i++) {
    if (!isFree(p, i) || !/^(with|without|has|have|having|missing|lacking|no)$/.test(lows[i]!)) continue;
    let k = i + 1;
    if (lows[k] === "no") k++;
    if (/^(a|an|any|the)$/.test(lows[k] ?? "")) k++;
    const field = mentionAt(p, k);
    if (!field || conds.some((c) => c.attr === field.name)) continue;
    const end = fieldEnd(p, k, field);
    if (end < tokens.length && !STOP.has(lows[end]!) && !CONJUNCTION.test(lows[end]!)) continue;
    explain.push(`Arkiv can't yet filter on whether a record has ${field.name} at all (the node rejects EXISTS), so that part isn't applied.`);
    break;
  }
}
