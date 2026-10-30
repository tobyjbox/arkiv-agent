import { type AskContext, type AskPlan, exampleQuestions } from "@arkiv-agent/ask";
import { type Dataset, findValues, loadCatalogue } from "@arkiv-agent/catalogue";
import { type ArkivClient, createArkivClient } from "@arkiv-agent/core";

/** What the Ask screen needs about the chosen dataset: names, and table columns in schema order. */
export type DatasetBrief = { id: string; name: string; project: string; liveCount: number; columns: { name: string; type: string }[] };

export function brief(d: Dataset): DatasetBrief {
  const skip = new Set([d.project.labelAttr, d.discriminator?.name]);
  return {
    id: d.id, name: d.name, liveCount: d.liveCount,
    project: d.project.method === "label" ? d.project.label : `${d.project.label.slice(0, 8)}…${d.project.label.slice(-4)}`,
    columns: d.schema.filter((f) => !skip.has(f.name) && !f.name.includes("*")).map(({ name, type }) => ({ name, type })),
  };
}

export function askContext(scope: string | null = null, previous: AskPlan | null = null): AskContext {
  const { datasets, summary } = loadCatalogue();
  // The rules look values up in the whole index, not just the catalogue's three examples per field.
  return { datasets, head: summary.indexedBlock, now: Date.now(), scope, previous, lookup: findValues };
}

const EXAMPLES_TTL_MS = 10 * 60_000;
let examples: { at: number; value: string[] } | null = null;

/**
 * "Try asking" questions, each checked against the index so it returns results. Checking reads the
 * index the way the API does, which takes a moment, so they are kept for ten minutes.
 */
export function askExamples(ctx: AskContext): string[] {
  if (!examples || Date.now() - examples.at > EXAMPLES_TTL_MS) {
    const { membersById } = loadCatalogue();
    examples = { at: Date.now(), value: exampleQuestions(ctx, (id) => membersById.get(id) ?? []) };
  }
  return examples.value;
}

/** Arkiv's Data Explorer runs the same query string from `?q=` (checked 2026-10-28). */
export const explorerUrl = (query: string) => `https://data.arkiv.network/?q=${encodeURIComponent(query)}`;

/**
 * Public, read-only client (no wallet, so Ask can only read), one per read so its timeout can
 * abort it. One retry: a person is waiting, and the indexer shares the RPC budget.
 */
export const arkiv = (signal: AbortSignal, onResponse: (response: Response) => void): ArkivClient =>
  createArkivClient(undefined, undefined, { signal, retryCount: 1, onResponse });
