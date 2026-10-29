// Step 2 of interpret(): which dataset the question is about. Datasets are scored on the words
// that name them (label, name, field names, stored values); the index lookup can re-rank the top ones.
import type { Dataset } from "@arkiv-agent/catalogue";
import { datasetAttrs, mentions, valueHits } from "./fields.ts";
import type { AskContext, NotUnderstood, Parse } from "./parse.ts";
import { FILLER, GENERIC, LABEL_NOISE, STOP, stem, type Token, tokenize, words } from "./tokens.ts";

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

type Ranked = { d: Dataset; score: number; named: boolean; used: Set<number> };
const byScore = (a: Ranked, b: Ranked) => b.score - a.score || b.d.liveCount - a.d.liveCount;

/** The best-scoring dataset for the free tokens, if one is named clearly enough. */
function bestMatch(p: Parse): Ranked | undefined {
  const { ctx, tokens, consumed, conds } = p;
  const visible = tokens.map((t, i) => (consumed.has(i) ? { ...t, low: "", stem: "" } : t));
  let ranked = ctx.datasets
    .map((d) => ({ d, ...scoreDataset(d, visible) }))
    .filter((r) => r.named && r.score >= (ctx.lookup ? 3 : 5) && (!r.d.isLoadGenerator || r.score >= 10))
    .sort(byScore);
  if (ctx.lookup) {
    const lookup = ctx.lookup;
    ranked = [...ranked.slice(0, 8).map((r) => ({ ...r, score: r.score + 3 * lookupValueCount(r.d, visible, r.used, lookup) })).sort(byScore), ...ranked.slice(8)]
      .filter((r) => r.score >= 5);
  }
  // With an owner/creator address, only a clearly named dataset narrows it (else: all datasets).
  return ranked[0] && (conds.length === 0 || ranked[0].score >= 8) ? ranked[0] : undefined;
}

/**
 * Sets `p.dataset`: the scope, else the best match, else the previous turn's dataset. "All records"
 * with only a weak match means no dataset. Not understood when there's no dataset and no address.
 */
export function pickDataset(p: Parse): NotUnderstood | null {
  const { ctx, tokens, consumed, conds, explain } = p;
  let dataset: Dataset | null = null;
  let datasetNamedWeakly = false;
  if (ctx.scope) {
    dataset = ctx.datasets.find((d) => d.id === ctx.scope) ?? null;
  } else {
    const best = bestMatch(p);
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
  p.dataset = dataset;
  if (!dataset && !conds.length) {
    return { kind: "not-understood", message: "No dataset in the catalogue matches. Ask reads one dataset at a time (name a project or a kind of record), or finds records by owner or creator address." };
  }
  return null;
}

/** Datasets the question points at, best first, topped up with the largest ones (the model's candidates). */
export function rankDatasets(question: string, datasets: Dataset[], n = 12): Dataset[] {
  const tokens = tokenize(question);
  const matched = datasets
    .map((d) => ({ d, ...scoreDataset(d, tokens) }))
    .filter((r) => r.score > 0 && (!r.d.isLoadGenerator || r.score >= 10))
    .sort((a, b) => b.score - a.score || b.d.liveCount - a.d.liveCount)
    .map((r) => r.d);
  const seen = new Set(matched.map((d) => d.id));
  const largest = datasets.filter((d) => !d.isLoadGenerator && !seen.has(d.id)).sort((a, b) => b.liveCount - a.liveCount);
  return [...matched, ...largest].slice(0, n);
}
