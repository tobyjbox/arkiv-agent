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
const NEGATION = new Set(["not", "except", "excluding", "without", "isn't", "aren't", "non", "never", "exclude"]);
const LABEL_NOISE = new Set(["v1", "v2", "v3", "test", "app", "open", "dev", "demo", "prod", "arkiv", "data"]);
const ORDERED: ReadonlySet<AttrType> = new Set(["i32", "u64", "u256", "dec"]);

type Op = "gt" | "gte" | "lt" | "lte";
/** Comparator phrases, longest first so "more than" wins over "more". */
const COMPARATORS: [string[], Op][] = (
  [
    ["greater than", "gt"], ["more than", "gt"], ["higher than", "gt"], ["longer than", "gt"], ["bigger than", "gt"],
    ["larger than", "gt"], ["older than", "gt"], ["at least", "gte"], ["no less than", "gte"], ["less than", "lt"],
    ["fewer than", "lt"], ["lower than", "lt"], ["shorter than", "lt"], ["smaller than", "lt"], ["at most", "lte"],
    ["no more than", "lte"], ["up to", "lte"], ["over", "gt"], ["above", "gt"], ["exceeding", "gt"], [">", "gt"],
    [">=", "gte"], ["under", "lt"], ["below", "lt"], ["<", "lt"], ["<=", "lte"],
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
  if (w.length > 5 && w.endsWith("ed")) return w.slice(0, -2);
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
    const parts = words(full).filter((w) => w.length >= 3 && !LABEL_NOISE.has(w) && !/^\d+$/.test(w));
    tokens.forEach((t, i) => {
      if (t.low === full || t.low === d.project.label.toLowerCase()) { label = Math.max(label, 10); used.add(i); }
      else if (parts[0] && t.low === parts[0]) { label = Math.max(label, 8); used.add(i); }
      else if (parts.slice(1).includes(t.low)) { label = Math.max(label, 4); used.add(i); }
    });
  }
  let name = 0;
  const nameWords = d.discriminator ? words(d.discriminator.value) : [];
  for (const w of nameWords) {
    const exact = tokens.findIndex((t, i) => !used.has(i) && !STOP.has(t.low) && t.stem === stem(w));
    if (exact >= 0) { name += 5; used.add(exact); continue; }
    const prefix = w.length >= 3 ? tokens.findIndex((t, i) => !used.has(i) && t.low.length > w.length && t.low.startsWith(w)) : -1;
    if (prefix >= 0) { name += 3; used.add(prefix); continue; }
    // A compound ("downvotes" for votes) names the dataset but its first part may be a value: leave it free.
    if (w.length >= 3 && tokens.some((t) => t.low.length > w.length + 1 && t.stem.endsWith(stem(w)))) name += 3;
  }
  const skip = datasetAttrs(d);
  const attrs = d.schema.filter((f) => !skip.has(f.name) && tokens.some((t, i) => !used.has(i) && mentions(t, f))).length;
  const values = new Set(valueHits(d, tokens, used).map((h) => h.span.join(":"))).size;
  return { score: label + name + 2 * attrs + 3 * values, named: label > 0 || name > 0, used };
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
    conds.push({ attr, q: { op: "eq", attr, type: "addr", value: t.raw }, tokens: [i] });
  });

  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (/^(first|top|latest|last|newest)$/.test(t.low) && next && /^\d{1,3}$/.test(next.low) && !TIME_UNITS[tokens[i + 2]?.low ?? ""]) {
      limit = Math.min(MAX_RESULTS, Math.max(1, Number(next.low)));
      consumed.add(i).add(i + 1);
    }
  });

  // Which dataset.
  let dataset: Dataset | null = null;
  if (ctx.scope) {
    dataset = ctx.datasets.find((d) => d.id === ctx.scope) ?? null;
  } else {
    const ranked = ctx.datasets
      .map((d) => ({ d, ...scoreDataset(d, tokens.map((t, i) => (consumed.has(i) ? { ...t, low: "", stem: "" } : t))) }))
      .filter((r) => r.named && r.score >= 5 && (!r.d.isLoadGenerator || r.score >= 10))
      .sort((a, b) => b.score - a.score || b.d.liveCount - a.d.liveCount);
    const best = ranked[0];
    if (best) {
      dataset = best.d;
      for (const i of best.used) consumed.add(i);
      const label = best.d.project.method === "label" ? best.d.project.label : `${best.d.project.label.slice(0, 10)}…`;
      explain.push(`Dataset “${best.d.name}” from ${label} (${best.d.liveCount.toLocaleString("en")} live records), the best match in the catalogue.`);
    } else if (ctx.previous?.datasetId && !conds.length) {
      dataset = ctx.datasets.find((d) => d.id === ctx.previous!.datasetId) ?? null;
    }
  }

  if (!dataset && !conds.length) {
    return err({ kind: "not-understood", message: "No dataset or attribute in the catalogue matches this question." });
  }

  if (dataset) {
    const d = dataset;
    const skip = datasetAttrs(d);
    const fields = d.schema.filter((f) => !skip.has(f.name) && !f.name.includes("*"));
    const mentionAt = (i: number, pred: (f: SchemaField) => boolean = () => true) =>
      consumed.has(i) ? undefined : fields.find((f) => pred(f) && mentions(tokens[i]!, f));
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
      for (const k of [numIdx + 1, numIdx + 2]) {
        if (k < tokens.length && !field) { field = mentionAt(k, ordered); if (field) usedIdx.push(k); }
      }
      for (let k = i - 1; k >= Math.max(0, i - 5) && !field; k--) { field = mentionAt(k, ordered); if (field) usedIdx.push(k); }
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

    // Stored values named in the question: "noida", "State drug lab", "tata-aig".
    const hits = valueHits(d, tokens, consumed).filter((h) => !skip.has(h.field.name));
    const bySpan = new Map<string, ValueHit[]>();
    for (const h of hits) bySpan.set(h.span.join(":"), [...(bySpan.get(h.span.join(":")) ?? []), h]);
    for (const group of bySpan.values()) {
      // The same text can be a value of two fields: prefer one the question names.
      const h = group.find((g) => tokens.some((t, i) => !consumed.has(i) && mentions(t, g.field))) ?? group.sort((a, b) => b.field.presence - a.field.presence)[0]!;
      const span = Array.from({ length: h.span[1] - h.span[0] }, (_, k) => h.span[0] + k);
      const negated = [1, 2].some((k) => NEGATION.has(lows[h.span[0] - k] ?? "") && !consumed.has(h.span[0] - k));
      const eq: AskQuery = { op: "eq", attr: h.field.name, type: "str", value: h.value };
      conds.push({ attr: h.field.name, q: negated ? { op: "not", term: eq } : eq, tokens: span });
      span.forEach((k) => consumed.add(k));
      const said = tokens.slice(h.span[0], h.span[1]).map((t) => t.raw).join(" ");
      if (said !== h.value) explain.push(`“${said}” matched the stored value ${h.field.name} = “${h.value}” (values are exact and case-sensitive).`);
    }

    // "status is failed", "city: Pune", quoted values: a field named, then a value not seen in examples.
    for (let i = 0; i < tokens.length; i++) {
      const field = mentionAt(i);
      if (!field || field.type === "bool") continue;
      let v = i + 1;
      if (EQUALS.has(lows[v] ?? "")) v++;
      const t = tokens[v];
      if (!t || consumed.has(v) || (!t.quoted && (STOP.has(t.low) || COMPARATORS.some(([p]) => p[0] === t.low)))) continue;
      if (!t.quoted && !EQUALS.has(lows[i + 1] ?? "") && !(ORDERED.has(field.type) && isNumber(t.low))) continue;
      let value = t.raw;
      if (ORDERED.has(field.type)) { if (!isNumber(t.low)) continue; value = String(parseNumber(t.low)); }
      else if (field.type === "str") {
        const ex = field.examples.filter((e) => /[a-z]/i.test(e));
        if (ex.length && ex.every((e) => e === e.toUpperCase())) value = value.toUpperCase();
        else if (ex.length && ex.every((e) => e === e.toLowerCase())) value = value.toLowerCase();
      } else if (field.type !== "addr" && field.type !== "key" && field.type !== "bytes32") continue;
      conds.push({ attr: field.name, q: { op: "eq", attr: field.name, type: field.type, value }, tokens: [i, v] });
      [i, i + 1, v].forEach((k) => consumed.add(k));
    }

    // Boolean fields named outright: "where arsenic exceeds the limit" → exceeds = true.
    for (const f of fields.filter((x) => x.type === "bool")) {
      const i = tokens.findIndex((t, k) => !consumed.has(k) && (t.low === f.name.toLowerCase() || (words(f.name).length === 1 && t.stem === stem(f.name.toLowerCase()))));
      if (i < 0) continue;
      const negated = [1, 2].some((k) => NEGATION.has(lows[i - k] ?? "") || /^(don't|doesn't|didn't|no)$/.test(lows[i - k] ?? ""));
      conds.push({ attr: f.name, q: { op: "eq", attr: f.name, type: "bool", value: String(!negated) }, tokens: [i] });
      consumed.add(i);
    }
  }

  // Same field, several values: any of them ("CDSCO or State drug lab"). Everything else: all of them.
  const groups = new Map<string, AskQuery[]>();
  const rest: AskQuery[] = [];
  for (const c of conds) {
    if (c.q.op === "eq" && !c.attr.startsWith("$")) groups.set(c.attr, [...(groups.get(c.attr) ?? []), c.q]);
    else rest.push(c.q);
  }
  const terms = [...[...groups.values()].map((g): AskQuery => (g.length === 1 ? g[0]! : { op: "or", terms: g })), ...rest];
  let where: AskQuery | null = terms.length === 0 ? null : terms.length === 1 ? terms[0]! : { op: "and", terms };
  if (ctx.previous?.where && dataset && ctx.previous.datasetId === dataset.id && !ctx.scope) {
    where = where ? { op: "and", terms: [ctx.previous.where, where] } : ctx.previous.where;
  }
  return ok({ datasetId: dataset?.id ?? null, where, limit, explain: explain.slice(0, 6) });
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
