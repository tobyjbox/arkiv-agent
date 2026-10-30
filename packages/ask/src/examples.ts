// "Try asking" examples: one question per kind the catalogue rules read, built from datasets that
// exist now. Each is kept only if the rules (no API key) read it back to its own dataset and the
// condition it shows, using every word, and it matches at least one live record in the index.
// No expiry example: the rules read "expiring in the next 7 days" but list "expiring" as not used.
import type { Dataset, Member } from "@arkiv-agent/catalogue";
import { type AskContext, interpret } from "./interpret.ts";
import { durationUnit, scaleOf, timeField } from "./interpret/fields.ts";
import { ORDERED } from "./interpret/tokens.ts";
import { type AskQuery, type Comparison, leaves } from "./query.ts";

/** A dataset's records from the index (the catalogue's members); only live ones count. */
export type RecordsOf = (datasetId: string) => readonly Member[];

/**
 * A question and the condition it should read as. `expect` is checked against the records first,
 * because interpreting is the slow part; the condition actually read is checked again after.
 */
type Candidate = { question: string; expect: Comparison | null };
type Form = (subject: string, d: Dataset, live: readonly Member[], ctx: AskContext) => Candidate[];

const plural = (w: string) =>
  /ed$/.test(w) ? `${w} records` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(s|x|ch|sh)$/.test(w) ? `${w}es` : `${w}s`;
/** A value a person would type: words, not ids or codes. */
const WORDY = /^[A-Za-z][A-Za-z -]{2,18}$/;
/** Numbers that count, version or name records rather than measure something. */
const NOT_A_MEASURE = /^(v|seq|page|row|version|schema.*|(.*_)?id|.*_ym|.*_num)$/i;
/** Shortest first, so the example is as narrow as the data allows. */
const WINDOWS: [string, number][] = [["24 hours", 86_400], ["7 days", 604_800], ["30 days", 2_592_000]];
/** As the rules read a window (interpret/conditions/time.ts). */
const BLOCKS_PER_SECOND = 0.5;
/** Datasets each kind is interpreted against before it is skipped: interpreting is the slow part. */
const MAX_TRIES = 8;

/** "1,234" style thresholds a person would type: two significant figures, rounded down. */
function roundDown(x: number): number {
  if (x < 10) return Math.floor(x * 100) / 100;
  const step = 10 ** (Math.floor(Math.log10(x)) - 1);
  return Math.floor(x / step) * step;
}

/** The kinds of question, in the order they are shown. */
const FORMS: Form[] = [
  // A stored text value: "dawa-alert alerts with authority CDSCO".
  (subject, d) => {
    const skip = new Set([d.project.labelAttr, d.discriminator?.name]);
    const f = d.schema.find((x) => x.type === "str" && !skip.has(x.name) && x.presence > 0.9 && x.examples.some((e) => WORDY.test(e)));
    const value = f?.examples.find((e) => WORDY.test(e));
    return f && value ? [{ question: `${subject} with ${f.name} ${value}`, expect: { op: "eq", attr: f.name, type: "str", value } }] : [];
  },
  // The whole dataset: "kharab alerts".
  (subject) => [{ question: subject, expect: null }],
  // A number comparison: "haqclock ic orders with penalty_inr over 10000".
  (subject, d, live) => {
    const time = timeField(d)?.field.name;
    return d.schema
      .filter((f) => ORDERED.has(f.type) && f.presence > 0.9 && f.name !== time && !NOT_A_MEASURE.test(f.name) && !scaleOf(f) && durationUnit(f) === null)
      .flatMap((f): Candidate[] => {
        const values = live.flatMap((m) => (m.attrs.get(f.name)?.type === f.type ? [Number(m.attrs.get(f.name)!.value)] : [])).sort((a, b) => a - b);
        if (new Set(values).size < 3) return [];
        const t = roundDown(values[Math.floor(values.length / 2)]!);
        if (t < 0 || t >= 100_000 || t >= values[values.length - 1]!) return [];
        return [{ question: `${subject} with ${f.name} over ${t}`, expect: { op: "gt", attr: f.name, type: f.type, value: String(t) } }];
      });
  },
  // A time window on the dataset's time field: "tankha votes from the last 7 days".
  (subject, d, _live, ctx) => {
    const time = timeField(d);
    if (!time) return [];
    return WINDOWS.map(([w, secs]) => {
      const since = time.unit === "ms" ? ctx.now - secs * 1000 : time.unit === "s" ? Math.floor(ctx.now / 1000) - secs : ctx.head - Math.round(secs * BLOCKS_PER_SECOND);
      return { question: `${subject} from the last ${w}`, expect: { op: "gte", attr: time.field.name, type: time.field.type, value: String(since) } };
    });
  },
  // One wallet's records: "muhurat appointments owned by 0x…".
  (subject, d) => (d.soleOwner ? [{ question: `${subject} owned by ${d.soleOwner}`, expect: { op: "eq", attr: "$owner", type: "addr", value: d.soleOwner } }] : []),
];

const valueOf = (m: Member, attr: string): { type: string; value: string } | null =>
  attr === "$owner" ? { type: "addr", value: m.owner }
  : attr === "$expiresAt" ? (m.expiresAt === null ? null : { type: "u64", value: String(m.expiresAt) })
  : (m.attrs.get(attr) ?? null);

function order(a: string, b: string, type: string): number {
  if (type === "dec") return Number(a) - Number(b);
  if (type === "i32" || type === "u64" || type === "u256") { const d = BigInt(a) - BigInt(b); return d < 0n ? -1 : d > 0n ? 1 : 0; }
  return type === "addr" ? a.toLowerCase().localeCompare(b.toLowerCase()) : a < b ? -1 : a > b ? 1 : 0;
}

/** Whether a record passes a query, the way Arkiv reads it: typed values, missing attributes never match. */
export function matches(q: AskQuery, m: Member): boolean {
  switch (q.op) {
    case "and": return q.terms.every((t) => matches(t, m));
    case "or": return q.terms.some((t) => matches(t, m));
    case "not": return !matches(q.term, m);
    case "exists": return valueOf(m, q.attr) !== null;
    case "startsWith": { const v = valueOf(m, q.attr); return v?.type === "str" && v.value.startsWith(q.value); }
    default: {
      const v = valueOf(m, q.attr);
      if (!v || v.type !== q.type) return false;
      const c = order(v.value, q.value, q.type);
      return { eq: c === 0, ne: c !== 0, gt: c > 0, gte: c >= 0, lt: c < 0, lte: c <= 0 }[q.op];
    }
  }
}

/**
 * Up to `n` example questions, each a different kind, from the largest datasets first and one per
 * project. A kind with no fitting data is skipped, so there can be fewer.
 */
export function exampleQuestions(ctx: AskContext, records: RecordsOf, n = 6): string[] {
  const rules = { ...ctx, scope: null, previous: null };
  const { lookup, ...withoutLookup } = rules;
  const datasets = ctx.datasets
    .filter((d) => !d.isLoadGenerator && !d.unqueryable && d.liveCount > 0 && d.project.method === "label" && d.discriminator && /^[a-z]+(_[a-z]+)?$/.test(d.discriminator.value))
    .sort((a, b) => b.liveCount - a.liveCount);
  const liveOf = new Map<string, readonly Member[]>();
  const live = (d: Dataset) => liveOf.get(d.id) ?? liveOf.set(d.id, records(d.id).filter((m) => m.status === "live" && (m.expiresAt === null || m.expiresAt > ctx.head))).get(d.id)!;
  /** Read back to `d` and the expected attribute alone, every word used, and a live record matches. */
  const reads = (c: Candidate, d: Dataset, reading: AskContext) => {
    const r = interpret(c.question, reading);
    if (!r.ok || r.value.datasetId !== d.id || r.value.ignored.length) return false;
    const { where } = r.value;
    return leaves(where).map((l) => l.attr).join() === (c.expect?.attr ?? "") && live(d).some((m) => !where || matches(where, m));
  };
  const out: string[] = [];
  const projects = new Set<string>();
  for (const form of FORMS) {
    if (out.length >= n) break;
    let tries = 0;
    for (const d of datasets) {
      if (tries >= MAX_TRIES) break;
      if (projects.has(d.project.label)) continue;
      const words = d.discriminator!.value.split("_");
      const subject = `${d.project.label.replace(/[-_.]?\*$/, "")} ${[...words.slice(0, -1), plural(words[words.length - 1]!)].join(" ")}`;
      const fitting = form(subject, d, live(d), ctx).filter((x) => live(d).some((m) => !x.expect || matches(x.expect, m)));
      if (!fitting.length) continue;
      tries++;
      // Without the index lookup first (fast), then with it, as the API reads the question.
      const c = fitting.find((x) => reads(x, d, withoutLookup) && (!lookup || reads(x, d, rules)));
      if (c) { out.push(c.question); projects.add(d.project.label); break; }
    }
  }
  return out;
}
