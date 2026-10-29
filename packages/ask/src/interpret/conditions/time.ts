import { timeField } from "../fields.ts";
import type { DatasetParse } from "../parse.ts";
import { isNumber, parseNumber, TIME_UNITS } from "../tokens.ts";

const BLOCKS_PER_SECOND = 0.5;

/**
 * Time windows: "last 7 days", "past hour", "next 24 hours", "today". A past window filters the
 * dataset's time field (ms, s or block numbers); "next", "within" or an expiry question filter
 * `$expiresAt`. Without a time field the window is reported as not applied.
 */
export function timeWindows(p: DatasetParse): void {
  const { tokens, lows, consumed, conds, explain, ctx, d, isExpiry } = p;
  for (let i = 0; i < tokens.length; i++) {
    const w = lows[i]!;
    if (!/^(last|past|next|within|today)$/.test(w) || consumed.has(i)) continue;
    let n = 1;
    let unitIdx = i + 1;
    if (w === "today") unitIdx = -1;
    else if (lows[i + 1] && isNumber(lows[i + 1]!)) { n = parseNumber(lows[i + 1]!); unitIdx = i + 2; }
    const unitWord = unitIdx < 0 ? "day" : lows[unitIdx];
    const secs = unitWord ? TIME_UNITS[unitWord] : undefined;
    if (!secs) continue;
    const windowS = n * secs;
    const span = unitIdx < 0 ? [i] : Array.from({ length: unitIdx - i + 1 }, (_, k) => i + k);
    span.forEach((k) => consumed.add(k));
    const phrase = tokens.slice(span[0], span[span.length - 1]! + 1).map((t) => t.raw).join(" ");
    if (isExpiry || w === "next" || w === "within") {
      const by = ctx.head + Math.round(windowS * BLOCKS_PER_SECOND);
      conds.push({ attr: "$expiresAt", q: { op: "lte", attr: "$expiresAt", type: "u64", value: String(by) }, tokens: span });
      explain.push(`“${phrase}” read as expiring by block ${by.toLocaleString("en")} (2 s blocks).`);
      continue;
    }
    const tf = timeField(d);
    if (!tf) {
      explain.push(`Arkiv can't filter on when a record was written, and this dataset has no time attribute, so “${phrase}” was not applied.`);
      continue;
    }
    const since = tf.unit === "ms" ? ctx.now - windowS * 1000 : tf.unit === "s" ? Math.floor(ctx.now / 1000) - windowS : ctx.head - Math.round(windowS * BLOCKS_PER_SECOND);
    conds.push({ attr: tf.field.name, q: { op: "gte", attr: tf.field.name, type: tf.field.type, value: String(since) }, tokens: span });
    const unitNote = tf.unit === "ms" ? "milliseconds" : tf.unit === "s" ? "seconds" : "block numbers";
    explain.push(`“${phrase}” read as ${tf.field.name} ≥ ${since} (${unitNote}).`);
  }
}
