// The no-key path: turns a question into an AskPlan with rules driven by the catalogue (dataset
// labels and names, attribute names, types and stored example values). Deterministic, so the eval
// runs in CI and every interpretation can be explained.
import type { Dataset, SchemaField } from "@arkiv-agent/catalogue";
import { type Result, err, ok } from "@arkiv-agent/core";
import { type AskPlan, type AskQuery, type AttrType, MAX_RESULTS } from "./query.ts";

export type AskContext = {
  datasets: Dataset[];
  /** Indexed head block, for expiry windows. */
  head: number;
  /** Wall clock in ms, for "last 7 days". */
  now: number;
  /** Restrict to one dataset (arriving from a dataset page). */
  scope?: string | null;
  /** The previous turn, so a follow-up ("only in Surat") narrows it. */
  previous?: AskPlan | null;
  /**
   * Stored text values of a dataset equal to `text` (ignoring case), across `fields`. The app looks
   * in the whole index; without it only the catalogue's three examples per field are known.
   */
  lookup?: (datasetId: string, text: string, fields: readonly string[]) => { field: string; value: string; count: number }[];
};

export type NotUnderstood = { kind: "not-understood"; message: string };

const BLOCKS_PER_SECOND = 0.5;
const STOP = new Set(
  ("a an the of in on at for from with where which that who whose by to and or is are was were be been all any " +
    "show me find list get give what whats what's which how many much please only some there their its this these those " +
    "i my our your can do does records record entities entity entries entry data items rows results stuff " +
    "live public other none new true false yes no than more less over under above below has have had")
    .split(" "),
);
const NEGATION = new Set(["not", "except", "excluding", "without", "isn't", "aren't", "non", "never", "exclude", "no", "don't", "doesn't", "didn't", "aren’t", "isn’t"]);
/** Words that ask for data without describing it: not reported as unused. */
const FILLER = new Set(["show", "find", "list", "get", "give", "fetch", "search", "how", "many", "count", "number", "total", "please", "every", "each", "kind", "type", "sort", "like", "also", "just", "whose", "them", "they", "it", "made", "using", "having"]);
/** Field-name words that say where something is: "in Pune" fills one of these. */
const PLACE_WORDS = /^(city|town|district|state|region|country|location|place|area|village|county|province|ward|lga|zone|locality|tehsil|taluk|centre|center)$/;
const LABEL_NOISE = new Set(["v1", "v2", "v3", "test", "app", "open", "dev", "demo", "prod", "arkiv", "data"]);
const ORDERED: ReadonlySet<AttrType> = new Set(["i32", "u64", "u256", "dec"]);
const CONJUNCTION = /^(and|or|but|,|;)$/;
/** Words that describe Arkiv itself, not one project or kind of record. */
const GENERIC = /^(arkiv|golem|chain|blockchain|network|testnet|mainnet|everything|anything|thing|things)$/;

type Op = "gt" | "gte" | "lt" | "lte";
/** Comparator phrases, longest first so "more than" wins over "more". */
const COMPARATORS: [string[], Op][] = (
  [
    ["greater than", "gt"], ["more than", "gt"], ["higher than", "gt"], ["longer than", "gt"], ["bigger than", "gt"],
    ["larger than", "gt"], ["older than", "gt"], ["at least", "gte"], ["no less than", "gte"], ["less than", "lt"],
    ["fewer than", "lt"], ["lower than", "lt"], ["shorter than", "lt"], ["smaller than", "lt"], ["at most", "lte"],
    ["no more than", "lte"], ["not more than", "lte"], ["not less than", "gte"], ["up to", "lte"], ["over", "gt"],
    ["above", "gt"], ["exceeding", "gt"], ["exceeds", "gt"], ["after", "gt"], ["since", "gte"], ["before", "lt"],
    ["until", "lte"], [">", "gt"], [">=", "gte"], ["≥", "gte"], ["under", "lt"], ["below", "lt"], ["<", "lt"],
    ["<=", "lte"], ["≤", "lte"],
  ] as [string, Op][]
)
  .map(([p, op]) => [p.split(" "), op] as [string[], Op])
  .sort((a, b) => b[0].length - a[0].length);
const EQUALS = new Set(["is", "=", "==", "equals", "equal", ":"]);

/** Seconds per unit word. */
const TIME_UNITS: Record<string, number> = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1, min: 60, mins: 60, minute: 60, minutes: 60, h: 3600, hr: 3600,
  hrs: 3600, hour: 3600, hours: 3600, day: 86_400, days: 86_400, week: 604_800, weeks: 604_800, month: 2_592_000, months: 2_592_000,
};

type Token = { raw: string; low: string; stem: string; quoted: boolean };

export function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !/(ss|us)$/.test(w)) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ed") && !w.endsWith("eed")) return w.slice(0, -2); // "exceed" stays whole
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  return w;
}

const words = (name: string) =>
  name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[\s_\-./:*]+/).filter(Boolean);

function tokenize(question: string): Token[] {
  const out: Token[] = [];
  for (const m of question.matchAll(/"([^"]+)"|“([^”]+)”|'([^'\s][^']*)'(?=\s|$|[?.,!])|(\S+)/g)) {
    const quoted = m[4] === undefined;
    const raw = quoted ? (m[1] ?? m[2] ?? m[3])! : m[4]!.replace(/^[(\[{"'“]+|[)\]}"'”?!,;…]+$|\.$/g, "");
    if (!raw) continue;
    const low = raw.toLowerCase();
    out.push({ raw, low, stem: quoted ? low : stem(low), quoted });
  }
  return out;
}

const isNumber = (t: string) => /^-?\d[\d,]*(\.\d+)?(k|m)?$/i.test(t);
function parseNumber(t: string): number {
  const m = /^(-?\d[\d,]*(?:\.\d+)?)(k|m)?$/i.exec(t)!;
  const n = Number(m[1]!.replace(/,/g, ""));
  return m[2]?.toLowerCase() === "k" ? n * 1e3 : m[2]?.toLowerCase() === "m" ? n * 1e6 : n;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const looksLikeHash = (v: string) => /^(0x)?[0-9a-f]{12,}$/i.test(v);

/**
 * Where a stored example value appears in the question (token span), e.g. "State drug lab". One-word
 * values also match inflections ("challenge" for "challenges", "withdrawals" for "withdraw") and
 * compounds with the dataset's own name ("downvotes" for dir = "down" in votes).
 */
function findValue(tokens: Token[], value: string, nameWords: string[] = []): [number, number] | null {
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
function mentions(t: Token, f: SchemaField): boolean {
  if (t.low === f.name.toLowerCase()) return true;
  if (STOP.has(t.low)) return false;
  const ws = words(f.name);
  if (ws.length === 1) return t.stem === stem(ws[0]!) || (ws[0]!.length === 1 && t.low === ws[0]);
  return ws.some((w) => w.length >= 3 && !/^(at|ms|id|num|raw|key|ym|ts)$/.test(w) && t.stem === stem(w));
}

/** Fields that only say which dataset a record is in; the dataset predicates already cover them. */
const datasetAttrs = (d: Dataset) => new Set([d.project.labelAttr, d.discriminator?.name].filter(Boolean) as string[]);

type ValueHit = { field: SchemaField; value: string; span: [number, number] };

function valueHits(d: Dataset, tokens: Token[], blocked: Set<number>): ValueHit[] {
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

/** How strongly the question points at a dataset, and which tokens named it. */
function scoreDataset(d: Dataset, tokens: Token[]): { score: number; named: boolean; used: Set<number> } {
  const used = new Set<number>();
  let label = 0;
  if (d.project.method === "label") {
    const full = d.project.label.replace(/\*$/, "").replace(/[-_.]$/, "").toLowerCase();
    // Generic words ("records" in arkiv-records-app) don't name a project.
    const parts = words(full).filter((w) => w.length >= 3 && !LABEL_NOISE.has(w) && !STOP.has(w) && !/^\d+$/.test(w));
    tokens.forEach((t, i) => {
      if (LABEL_NOISE.has(full) || STOP.has(full) || GENERIC.test(full)) return;
      if (t.low === full || t.low === d.project.label.toLowerCase()) { label = Math.max(label, 10); used.add(i); }
      else if (parts[0] && t.low === parts[0]) { label = Math.max(label, 8); used.add(i); }
      else if (parts.slice(1).includes(t.low)) { label = Math.max(label, 4); used.add(i); }
    });
  }
  let name = 0;
  const nameWords = (d.discriminator ? words(d.discriminator.value) : []).filter((w) => !GENERIC.test(w) && !LABEL_NOISE.has(w) && !STOP.has(w));
  for (const w of nameWords) {
    const exact = tokens.findIndex((t, i) => !used.has(i) && !STOP.has(t.low) && t.stem === stem(w));
    if (exact >= 0) { name += 5; used.add(exact); continue; }
    const prefix = w.length >= 3 ? tokens.findIndex((t, i) => !used.has(i) && !STOP.has(t.low) && t.low.length > w.length && t.low.startsWith(w)) : -1;
    if (prefix >= 0) { name += 3; used.add(prefix); continue; }
    // A compound ("downvotes" for votes) names the dataset but its first part may be a value: leave it free.
    if (w.length >= 3 && tokens.some((t) => t.low.length > w.length + 1 && t.stem.endsWith(stem(w)))) name += 3;
  }
  const skip = datasetAttrs(d);
  const attrs = d.schema.filter((f) => !skip.has(f.name) && tokens.some((t, i) => !used.has(i) && mentions(t, f))).length;
  const values = new Set(valueHits(d, tokens, used).map((h) => h.span.join(":"))).size;
  return { score: label + name + 2 * attrs + 3 * values, named: label > 0 || name > 0, used };
}

/**
 * Question words that are stored values of a dataset per the index lookup, beyond its three
 * examples (counted in `scoreDataset`). Three examples per field are luck; the index is not.
 */
function lookupValueCount(d: Dataset, tokens: Token[], used: Set<number>, lookup: NonNullable<AskContext["lookup"]>): number {
  const skip = datasetAttrs(d);
  const fields = d.schema.filter((f) => f.type === "str" && !skip.has(f.name) && !f.name.includes("*")).map((f) => f.name);
  if (!fields.length) return 0;
  const exampleSpans = new Set(valueHits(d, tokens, used).flatMap((h) => Array.from({ length: h.span[1] - h.span[0] }, (_, k) => h.span[0] + k)));
  const free = (k: number) => k < tokens.length && !used.has(k) && !exampleSpans.has(k) && !STOP.has(tokens[k]!.low) && !FILLER.has(tokens[k]!.low) && tokens[k]!.low !== "";
  let count = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (!free(i)) continue;
    let end = i;
    while (end - i < 3 && free(end)) end++;
    for (let e = end; e > i; e--) {
      const span = tokens.slice(i, e);
      const texts = [...new Set([" ", "_", "-"].map((sep) => span.map((t) => t.raw).join(sep)))];
      if (texts.some((t) => lookup(d.id, t, fields).length)) { count++; i = e - 1; break; }
    }
  }
  return count;
}

/** A record-time attribute and its unit, judged from its name and the magnitude of its values. */
function timeField(d: Dataset): { field: SchemaField; unit: "ms" | "s" | "block" } | null {
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
function durationUnit(f: SchemaField): number | null {
  const ws = words(f.name);
  const last = ws[ws.length - 1]!;
  if (!ws.some((w) => /^(dur|duration|minutes|mins|secs|seconds|hours|lag|length|elapsed|wait)$/.test(w)) && ws.length > 1 && !/^(min|s|sec|h|d)$/.test(last)) return null;
  const units: Record<string, number> = { ms: 0.001, s: 1, sec: 1, secs: 1, seconds: 1, min: 60, mins: 60, minutes: 60, h: 3600, hr: 3600, hours: 3600, d: 86_400, days: 86_400 };
  return units[last] ?? (ws.length === 1 && units[ws[0]!] ? units[ws[0]!]! : null);
}

/** Scale implied by a name suffix: `temp_c_x100` stores hundredths, `price_cents` cents. */
function scaleOf(f: SchemaField): { factor: number; note: string } | null {
  const x = /_x(\d+)$/i.exec(f.name);
  if (x) return { factor: Number(x[1]), note: `${f.name} stores values ×${x[1]}` };
  if (/_cents$/i.test(f.name)) return { factor: 100, note: `${f.name} is in cents` };
  return null;
}

type Cond = { attr: string; q: AskQuery; tokens: number[] };

/**
 * Interprets a question against the catalogue. Returns a plan whose dataset and conditions came
 * only from the catalogue; anything it can't ground becomes "not understood" rather than a guess.
 */
export function interpret(question: string, ctx: AskContext): Result<AskPlan, NotUnderstood> {
  const tokens = tokenize(question);
  const lows0 = tokens.map((t) => t.low);
  const consumed = new Set<number>();
  const conds: Cond[] = [];
  const explain: string[] = [];
  let limit = MAX_RESULTS;

  // Addresses are conditions on owner/creator (or an address field), never dataset names.
  tokens.forEach((t, i) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(t.raw)) return;
    consumed.add(i);
    const before = tokens.slice(Math.max(0, i - 3), i).map((x) => x.low);
    const attr = before.some((w) => /^(created|creator|written|writer|wrote|made)$/.test(w)) ? "$creator" : "$owner";
    for (let k = Math.max(0, i - 3); k < i; k++) if (/^(owned|owner|owners|created|creator|written|writer|wrote|made|by|from)$/.test(tokens[k]!.low)) consumed.add(k);
    conds.push({ attr, q: { op: "eq", attr, type: "addr", value: t.raw }, tokens: [i] });
  });

  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (/^(first|top|latest|last|newest)$/.test(t.low) && next && /^\d{1,3}$/.test(next.low) && !TIME_UNITS[tokens[i + 2]?.low ?? ""]) {
      limit = Math.min(MAX_RESULTS, Math.max(1, Number(next.low)));
      // "first/top N" is just a count; "latest/newest N" also asks for an order Arkiv can't give.
      consumed.add(i + 1);
      if (/^(first|top)$/.test(t.low)) consumed.add(i);
    }
  });

  // Which dataset.
  let dataset: Dataset | null = null;
  let datasetNamedWeakly = false;
  if (ctx.scope) {
    dataset = ctx.datasets.find((d) => d.id === ctx.scope) ?? null;
  } else {
    const visible = tokens.map((t, i) => (consumed.has(i) ? { ...t, low: "", stem: "" } : t));
    const byScore = (a: { score: number; d: Dataset }, b: { score: number; d: Dataset }) => b.score - a.score || b.d.liveCount - a.d.liveCount;
    let ranked = ctx.datasets
      .map((d) => ({ d, ...scoreDataset(d, visible) }))
      .filter((r) => r.named && r.score >= 5 && (!r.d.isLoadGenerator || r.score >= 10))
      .sort(byScore);
    if (ctx.lookup) {
      const lookup = ctx.lookup;
      ranked = [...ranked.slice(0, 6).map((r) => ({ ...r, score: r.score + 3 * lookupValueCount(r.d, visible, r.used, lookup) })).sort(byScore), ...ranked.slice(6)];
    }
    // With an owner/creator address, only a clearly named dataset narrows it (else: all datasets).
    const best = ranked[0] && (conds.length === 0 || ranked[0].score >= 8) ? ranked[0] : undefined;
    if (best) {
      datasetNamedWeakly = best.score < 8;
      dataset = best.d;
      for (const i of best.used) consumed.add(i);
      const label = best.d.project.method === "label" ? best.d.project.label : `${best.d.project.label.slice(0, 10)}…`;
      explain.push(`Dataset “${best.d.name}” from ${label} (${best.d.liveCount.toLocaleString("en")} live records), the best match in the catalogue.`);
    } else if (ctx.previous?.datasetId && !conds.length) {
      dataset = ctx.datasets.find((d) => d.id === ctx.previous!.datasetId) ?? null;
    }
  }

  const wholeChain = tokens.some((t) => /^(every|all|everything|any|whole|entire)$/.test(t.low)) &&
    tokens.some((t) => /^(record|records|entity|entities|data|everything|chain|thing|things)$/.test(t.low));
  if (wholeChain && dataset && !ctx.scope && !ctx.previous && datasetNamedWeakly) dataset = null;
  if (!dataset && !conds.length) {
    return err({ kind: "not-understood", message: "No dataset in the catalogue matches. Ask reads one dataset at a time (name a project or a kind of record), or finds records by owner or creator address." });
  }

  if (dataset) {
    const d = dataset;
    const skip = datasetAttrs(d);
    const fields = d.schema.filter((f) => !skip.has(f.name) && !f.name.includes("*"));
    const mentionAt = (i: number, pred: (f: SchemaField) => boolean = () => true) =>
      i < 0 || i >= tokens.length || consumed.has(i) ? undefined : fields.find((f) => pred(f) && mentions(tokens[i]!, f));
    const lows = tokens.map((t) => t.low);
    const isExpiry = tokens.some((t) => t.low.startsWith("expir"));

    // Time windows: "last 7 days", "past hour", "next 24 hours", "today".
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

    // Numeric comparisons: "ctc over 1500000", "more than 10000 events", "longer than 3 hours".
    for (let i = 0; i < tokens.length; i++) {
      const hit = COMPARATORS.find(([p]) => p.every((w, j) => lows[i + j] === w));
      if (!hit || consumed.has(i)) continue;
      const [phrase, op] = hit;
      const numIdx = i + phrase.length;
      const numTok = lows[numIdx];
      if (!numTok) continue;
      const unitMatch = /^(-?\d[\d,]*(?:\.\d+)?[km]?)([a-z°%]+)?$/i.exec(numTok);
      if (!unitMatch || !isNumber(unitMatch[1]!)) continue;
      let value = parseNumber(unitMatch[1]!);
      let unitWord = unitMatch[2]?.toLowerCase() ?? lows[numIdx + 1];
      const unitIsWord = !unitMatch[2] && unitWord !== undefined;
      const ordered = (f: SchemaField) => ORDERED.has(f.type);
      let field: SchemaField | undefined;
      const usedIdx = Array.from({ length: phrase.length + 1 }, (_, k) => i + k);
      // "x greater than 10": the field right before (only "is", "of"… between) wins. Then "more than
      // 10000 events": right after the number (or its unit). Then further back. Never across and/or.
      for (let k = i - 1; k >= Math.max(0, i - 3) && !field; k--) {
        field = mentionAt(k, ordered);
        if (field) usedIdx.push(k);
        else if (!/^(is|are|was|be|of|its|the)$/.test(lows[k]!)) break;
      }
      for (const k of [numIdx + 1, numIdx + 2]) {
        if (field || k >= tokens.length || CONJUNCTION.test(lows[k]!)) break;
        field = mentionAt(k, ordered);
        if (field) usedIdx.push(k);
        else if (k === numIdx + 1 && !(TIME_UNITS[lows[k]!] || /^(grams?|g|kg|percent|%|rupees|inr|usd|dollars)$/.test(lows[k]!))) break;
      }
      for (let k = i - 1; k >= Math.max(0, i - 5) && !field; k--) {
        if (CONJUNCTION.test(lows[k]!)) break;
        field = mentionAt(k, ordered);
        if (field) usedIdx.push(k);
      }
      const secsPer = unitWord ? TIME_UNITS[unitWord] : undefined;
      if (!field && secsPer) field = fields.find((f) => ordered(f) && durationUnit(f) !== null);
      if (!field) continue;
      if (unitIsWord && (secsPer || /^(grams?|g|kg|percent|%|rupees|inr|usd|dollars)$/.test(unitWord!))) usedIdx.push(numIdx + 1);
      const fieldUnit = durationUnit(field);
      if (secsPer && fieldUnit) {
        const converted = (value * secsPer) / fieldUnit;
        const unitName = { 0.001: "milliseconds", 1: "seconds", 60: "minutes", 3600: "hours", 86400: "days" }[fieldUnit] ?? "its unit";
        explain.push(`${value} ${unitWord} = ${converted} ${unitName} (${field.name}).`);
        value = converted;
        unitWord = undefined;
      }
      const scale = scaleOf(field);
      if (scale) { explain.push(`${value} stored as ${value * scale.factor} (${scale.note}).`); value *= scale.factor; }
      if (field.type !== "dec") value = Math.round(value);
      usedIdx.forEach((k) => consumed.add(k));
      conds.push({ attr: field.name, q: { op, attr: field.name, type: field.type, value: String(value) }, tokens: usedIdx });
    }

    const isFree = (k: number) => k >= 0 && k < tokens.length && !consumed.has(k);
    const negationBefore = (k: number) => [k - 1, k - 2].filter((j) => isFree(j) && NEGATION.has(lows[j]!));
    /** Adds `field = value` (or NOT, after "not"/"except"), using up the words it came from. */
    const bind = (field: SchemaField, value: string, span: number[]) => {
      const negs = negationBefore(span[0]!);
      const eq: AskQuery = { op: "eq", attr: field.name, type: field.type, value };
      conds.push({ attr: field.name, q: negs.length ? { op: "not", term: eq } : eq, tokens: span });
      [...span, ...negs].forEach((k) => consumed.add(k));
      // The field's own name just before ("city noida", "lender_type is not NBFC") is part of it too.
      let j = span[0]! - 1;
      while (j >= 0 && /^(is|are|was|=|:|equals|of|not|isn't)$/.test(lows[j]!)) j--;
      if (isFree(j) && mentions(tokens[j]!, field)) consumed.add(j);
    };
    const strFields = fields.filter((f) => f.type === "str");
    const fieldWordStems = new Set(fields.flatMap((f) => words(f.name).filter((w) => w.length >= 3).map(stem)));
    /** Spans of free words starting at k, longest first (up to 3), that could be one value. */
    const runsFrom = (k: number) => {
      let end = k;
      const startsComparison = (j: number) => COMPARATORS.some(([p]) => p.every((w, n) => lows[j + n] === w));
      while (end - k < 3 && isFree(end) && (tokens[end]!.quoted || (!STOP.has(lows[end]!) && !NEGATION.has(lows[end]!) && !fieldWordStems.has(tokens[end]!.stem) && !startsComparison(end)))) end++;
      return Array.from({ length: end - k }, (_, n) => Array.from({ length: end - k - n }, (_, j) => k + j));
    };
    const textOf = (span: number[], sep = " ") => span.map((k) => tokens[k]!.raw).join(sep);
    /** Index lookup for a span, trying "delhi ncr" as delhi_ncr and delhi-ncr too. */
    const lookupSpan = (span: number[], among: SchemaField[]) => {
      if (!ctx.lookup || !among.length) return [];
      const names = among.map((f) => f.name);
      for (const sep of [" ", "_", "-"]) {
        if (sep !== " " && span.length === 1) break;
        const hits = ctx.lookup(d.id, textOf(span, sep), names);
        if (hits.length) return hits;
      }
      return [];
    };
    const casedLike = (field: SchemaField, typed: string) => {
      const ex = field.examples.filter((e) => /[a-z]/i.test(e));
      if (ex.length && ex.every((e) => e === e.toUpperCase())) return typed.toUpperCase();
      if (ex.length && ex.every((e) => e === e.toLowerCase())) return typed.toLowerCase();
      return typed;
    };

    // Numbers after "N or more", "between A and B".
    const orderedNear = (before: number, after: number) => {
      for (let k = before; k >= Math.max(0, before - 2); k--) { const f = mentionAt(k, (x) => ORDERED.has(x.type)); if (f) return { f, k }; if (CONJUNCTION.test(lows[k] ?? "")) break; }
      for (const k of [after, after + 1]) { if (CONJUNCTION.test(lows[k] ?? "")) break; const f = mentionAt(k, (x) => ORDERED.has(x.type)); if (f) return { f, k }; }
      for (let k = before; k >= Math.max(0, before - 4); k--) { const f = mentionAt(k, (x) => ORDERED.has(x.type)); if (f) return { f, k }; }
      return null;
    };
    for (let i = 0; i < tokens.length; i++) {
      if (!isFree(i)) continue;
      if (lows[i] === "between" && isNumber(lows[i + 1] ?? "") && lows[i + 2] === "and" && isNumber(lows[i + 3] ?? "")) {
        const hit = orderedNear(i - 1, i + 4);
        if (!hit) continue;
        const [a, b] = [parseNumber(lows[i + 1]!), parseNumber(lows[i + 3]!)].sort((x, y) => x - y);
        conds.push({ attr: hit.f.name, q: { op: "gte", attr: hit.f.name, type: hit.f.type, value: String(a) }, tokens: [i] });
        conds.push({ attr: hit.f.name, q: { op: "lte", attr: hit.f.name, type: hit.f.type, value: String(b) }, tokens: [i] });
        [i, i + 1, i + 2, i + 3, hit.k].forEach((k) => consumed.add(k));
      } else if (isNumber(lows[i]!) && lows[i + 1] === "or" && /^(more|above|higher|greater|over|less|below|lower|fewer|under)$/.test(lows[i + 2] ?? "")) {
        const hit = orderedNear(i - 1, i + 3);
        if (!hit) continue;
        const op = /^(more|above|higher|greater|over)$/.test(lows[i + 2]!) ? "gte" : "lte";
        conds.push({ attr: hit.f.name, q: { op, attr: hit.f.name, type: hit.f.type, value: String(parseNumber(lows[i]!)) }, tokens: [i] });
        [i, i + 1, i + 2, hit.k].forEach((k) => consumed.add(k));
      }
    }

    // Yes/no fields: "exceeds the limit", "where exp_ok is false", "that are not historical".
    for (const f of fields.filter((x) => x.type === "bool")) {
      const fw = words(f.name).map(stem);
      /** A word of this field ("known"), and whether it came negated ("unknown", "non-demo"). */
      const fieldWord = (k: number) => {
        if (!isFree(k)) return null;
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
          while (isFree(gap) && /^(is|are|was|be|been|not|isn't)$/.test(lows[gap]!)) { if (/^(not|isn't)$/.test(lows[gap]!)) negations.push(gap); gap++; }
          if (gap > end && fieldWord(gap)) { for (let g = end; g < gap; g++) used.push(g); if (negations.length % 2) value = !value; end = gap; }
        }
        if (!fw.every((w) => seen.has(w))) continue;
        let k = end;
        if (EQUALS.has(lows[k] ?? "") || lows[k] === "are" || lows[k] === "was") used.push(k++);
        if (lows[k] === "not" || lows[k] === "isn't") { value = !value; used.push(k++); }
        if (/^(true|yes)$/.test(lows[k] ?? "")) used.push(k++);
        else if (/^(false|no)$/.test(lows[k] ?? "")) { value = !value; used.push(k++); }
        const negs = [i - 1, i - 2].filter((j) => isFree(j) && (NEGATION.has(lows[j]!) || lows[j] === "un"));
        if (negs.length % 2) value = !value;
        conds.push({ attr: f.name, q: { op: "eq", attr: f.name, type: "bool", value: String(value) }, tokens: [...used, ...negs] });
        [...used, ...negs].forEach((j) => consumed.add(j));
        break;
      }
    }

    // Stored example values named in the question: "noida", "State drug lab", "tata-aig".
    const hits = valueHits(d, tokens, consumed).filter((h) => !skip.has(h.field.name));
    const bySpan = new Map<string, ValueHit[]>();
    for (const h of hits) bySpan.set(h.span.join(":"), [...(bySpan.get(h.span.join(":")) ?? []), h]);
    for (const group of bySpan.values()) {
      // The same text can be a value of two fields: prefer one the question names.
      const h = group.find((g) => tokens.some((t, i) => isFree(i) && mentions(t, g.field))) ?? group.sort((a, b) => b.field.presence - a.field.presence)[0]!;
      const span = Array.from({ length: h.span[1] - h.span[0] }, (_, k) => h.span[0] + k);
      if (!span.every(isFree)) continue;
      bind(h.field, h.value, span);
      const said = textOf(span);
      if (said !== h.value) explain.push(`“${said}” matched the stored value ${h.field.name} = “${h.value}” (values are exact and case-sensitive).`);
    }

    // A field named, then its value: "district Doda", "asset LINK", "city: Pune", "shift 2", "lender type NBFC".
    /** Words from i that name `f` ("lender type" for lender_type), as an end index. */
    const fieldEnd = (i: number, f: SchemaField) => {
      const fw = words(f.name).map(stem);
      const seen = new Set([tokens[i]!.stem]);
      let k = i + 1;
      while (isFree(k) && fw.includes(tokens[k]!.stem) && !seen.has(tokens[k]!.stem)) seen.add(tokens[k++]!.stem);
      return k;
    };
    for (let i = 0; i < tokens.length; i++) {
      if (!isFree(i)) continue;
      const candidates = fields.filter((f) => f.type !== "bool" && mentions(tokens[i]!, f));
      const field = candidates.sort((a, b) => fieldEnd(i, b) - fieldEnd(i, a) || words(a.name).length - words(b.name).length)[0];
      if (!field) continue;
      let k = fieldEnd(i, field);
      const fieldSpan = Array.from({ length: k - i }, (_, n) => i + n);
      if (EQUALS.has(lows[k] ?? "") || lows[k] === "of") k++;
      if (!isFree(k)) continue;
      if (ORDERED.has(field.type)) {
        if (!isNumber(lows[k]!)) continue;
        conds.push({ attr: field.name, q: { op: "eq", attr: field.name, type: field.type, value: String(parseNumber(lows[k]!)) }, tokens: [...fieldSpan, k] });
        [...fieldSpan, k - 1, k].forEach((j) => j > i && consumed.add(j));
        fieldSpan.forEach((j) => consumed.add(j));
        continue;
      }
      if (field.type === "addr" || field.type === "key" || field.type === "bytes32") {
        if (!/^0x[0-9a-f]+$/i.test(tokens[k]!.raw)) continue;
        bind(field, tokens[k]!.raw, [...fieldSpan, k]);
        continue;
      }
      if (field.type !== "str") continue;
      const runs = runsFrom(k);
      if (!runs.length) continue;
      const found = runs.map((span) => ({ span, hit: lookupSpan(span, [field])[0] })).find((r) => r.hit);
      if (found?.hit) {
        bind(field, found.hit.value, [...fieldSpan, ...found.span]);
        if (textOf(found.span) !== found.hit.value) explain.push(`“${textOf(found.span)}” matched the stored value ${field.name} = “${found.hit.value}”.`);
        continue;
      }
      // Not a stored value: take one word (or the quoted text) as typed, cased like the examples, and say so.
      const span = runs[runs.length - 1]!;
      const value = tokens[span[0]!]!.quoted ? tokens[span[0]!]!.raw : casedLike(field, tokens[span[0]!]!.raw);
      bind(field, value, [...fieldSpan, ...span]);
      explain.push(`${field.name} = “${value}” is not among the values ArkivAgent has seen, so it may match nothing (values are exact).`);
    }

    // Places: "in Nashik", "from Jharkhand", "at Pune" fill a place field (city, district, state…).
    const places = strFields.filter((f) => words(f.name).some((w) => PLACE_WORDS.test(w)));
    for (let i = 0; i < tokens.length - 1; i++) {
      if (!/^(in|at|from|near)$/.test(lows[i]!) || !places.length) continue;
      const runs = runsFrom(i + 1);
      if (!runs.length) continue;
      const found = runs.map((span) => ({ span, hits: lookupSpan(span, places) })).find((r) => r.hits.length);
      if (found) {
        const top = found.hits[0]!;
        const field = places.find((f) => f.name === top.field)!;
        bind(field, top.value, [i, ...found.span]);
        const others = [...new Set(found.hits.slice(1).map((h) => h.field))].filter((f) => f !== top.field);
        explain.push(`“${textOf(found.span)}” read as ${field.name} = “${top.value}”${others.length ? ` (also a value of ${others.join(", ")}; name the field to choose)` : ""}.`);
        continue;
      }
      const span = runs[runs.length - 1]!;
      const word = tokens[span[0]!]!;
      if (places.length !== 1 || word.raw[0] !== word.raw[0]!.toUpperCase() || /^\d/.test(word.raw)) continue;
      const field = places[0]!;
      const value = casedLike(field, word.raw);
      bind(field, value, [i, ...span]);
      explain.push(`“${word.raw}” read as ${field.name} = “${value}”; ArkivAgent hasn't seen that value, so it may match nothing.`);
    }

    // Presence: "without a parent_key", "with no guild", "missing parcel" → NOT exists; "with a guild",
    // "that have a guild" → exists. Only when no value follows (a value was bound above).
    for (let i = 0; i < tokens.length; i++) {
      if (!isFree(i) || !/^(with|without|has|have|having|missing|lacking|no)$/.test(lows[i]!)) continue;
      let k = i + 1;
      let isAbsent = /^(without|missing|lacking|no)$/.test(lows[i]!);
      if (lows[k] === "no") { isAbsent = true; k++; }
      if (/^(a|an|any|the)$/.test(lows[k] ?? "")) k++;
      const field = mentionAt(k);
      if (!field || conds.some((c) => c.attr === field.name)) continue;
      const end = fieldEnd(k, field);
      if (end < tokens.length && !STOP.has(lows[end]!) && !CONJUNCTION.test(lows[end]!)) continue;
      const has: AskQuery = { op: "exists", attr: field.name };
      const span = Array.from({ length: end - i }, (_, n) => i + n);
      conds.push({ attr: field.name, q: isAbsent ? { op: "not", term: has } : has, tokens: span });
      span.forEach((j) => consumed.add(j));
    }

    // Any other word that is a stored value: "the pricing category", "millet".
    for (let i = 0; i < tokens.length; i++) {
      if (!isFree(i) || STOP.has(lows[i]!) || FILLER.has(lows[i]!) || NEGATION.has(lows[i]!)) continue;
      const found = runsFrom(i).map((span) => ({ span, hits: lookupSpan(span, strFields) })).find((r) => r.hits.length);
      if (!found) continue;
      const named = found.hits.find((h) => tokens.some((t) => mentions(t, strFields.find((f) => f.name === h.field)!)));
      const top = named ?? found.hits[0]!;
      bind(strFields.find((f) => f.name === top.field)!, top.value, found.span);
      if (textOf(found.span) !== top.value) explain.push(`“${textOf(found.span)}” matched the stored value ${top.field} = “${top.value}”.`);
    }
  }

  // Never drop a word silently: whatever wasn't used is reported with the plan.
  const applied = new Set(conds.map((c) => c.attr));
  const appliedField = (t: Token) => (dataset?.schema ?? []).some((f) => applied.has(f.name) && mentions(t, f));
  const ignored = tokens
    .filter((t, i) => !consumed.has(i) && !STOP.has(t.low) && !FILLER.has(t.low) && /[\p{L}\p{N}]/u.test(t.low) && !appliedField(t))
    .map((t) => t.raw);
  if (tokens.some((t, i) => /^(latest|newest|recent|oldest|earliest)$/.test(t.low) && !consumed.has(i))) {
    explain.push("Arkiv can't sort query results, so newest-first isn't applied: these are the first records it returns.");
  }
  if (tokens.some((t, i) => t.low === "many" && lows0[i - 1] === "how") || tokens.some((t) => t.low === "count")) {
    explain.push("Arkiv has no count for a query: results come a page at a time (Load more).");
  }

  // Clauses joined by "or" ("x over 20 or y under 5") form one OR group; the rest are all required.
  const ordered = [...conds].sort((a, b) => Math.min(...a.tokens) - Math.min(...b.tokens));
  const merged: Cond[] = [];
  for (const c of ordered) {
    const prev = merged[merged.length - 1];
    const between = prev ? lows0.slice(Math.max(...prev.tokens) + 1, Math.min(...c.tokens)) : [];
    if (prev && between.includes("or") && !between.includes("and") && prev.attr !== c.attr) {
      const terms = prev.q.op === "or" ? [...prev.q.terms, c.q] : [prev.q, c.q];
      merged[merged.length - 1] = { attr: `${prev.attr}|${c.attr}`, q: { op: "or", terms }, tokens: [...prev.tokens, ...c.tokens] };
    } else merged.push(c);
  }

  // Same field, several values: any of them ("CDSCO or State drug lab"). Everything else: all of them.
  const groups = new Map<string, AskQuery[]>();
  const rest: AskQuery[] = [];
  for (const c of merged) {
    if (c.q.op === "eq" && !c.attr.startsWith("$")) groups.set(c.attr, [...(groups.get(c.attr) ?? []), c.q]);
    else rest.push(c.q);
  }
  const terms = [...[...groups.values()].map((g): AskQuery => (g.length === 1 ? g[0]! : { op: "or", terms: g })), ...rest];
  let where: AskQuery | null = terms.length === 0 ? null : terms.length === 1 ? terms[0]! : { op: "and", terms };
  if (ctx.previous?.where && dataset && ctx.previous.datasetId === dataset.id && !ctx.scope) {
    where = where ? { op: "and", terms: [ctx.previous.where, where] } : ctx.previous.where;
  }
  return ok({ datasetId: dataset?.id ?? null, where, limit, explain: explain.slice(0, 6), ignored: ignored.slice(0, 12) });
}

/** Datasets the question points at, best first, topped up with the largest ones (the model's candidates). */
export function rankDatasets(question: string, datasets: Dataset[], n = 12): Dataset[] {
  const tokens = tokenize(question);
  const byScore = datasets
    .map((d) => ({ d, ...scoreDataset(d, tokens) }))
    .filter((r) => r.score > 0 && (!r.d.isLoadGenerator || r.score >= 10))
    .sort((a, b) => b.score - a.score || b.d.liveCount - a.d.liveCount)
    .map((r) => r.d);
  const seen = new Set(byScore.map((d) => d.id));
  const largest = datasets.filter((d) => !d.isLoadGenerator && !seen.has(d.id)).sort((a, b) => b.liveCount - a.liveCount);
  return [...byScore, ...largest].slice(0, n);
}
