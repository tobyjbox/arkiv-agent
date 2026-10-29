import type { Dataset, SchemaField } from "@arkiv-agent/catalogue";
import { type AskContext, forDataset, startParse } from "../../src/interpret/parse.ts";

export const field = (name: string, type: SchemaField["type"], examples: string[] = [], presence = 1): SchemaField => ({ name, type, presence, examples });

/** A small labelled dataset: project `sensornet`, kind = reading. */
export function dataset(schema: SchemaField[], over: Partial<Dataset> = {}): Dataset {
  return {
    id: "ds1", name: "readings", nameSource: "discriminator", discriminator: { name: "kind", value: "reading" }, shape: null, unqueryable: null,
    project: { label: "sensornet", method: "label", labelAttr: "project", isPrefix: false, confidence: 1, conflictWallets: null },
    schema, liveCount: 10, writers: 1, ownership: "app", medianLifetimeBlocks: null, firstWriteBlock: 0, lastWriteBlock: 0, writes24h: 0,
    hourly24h: [], contentTypes: [], medianPayloadBytes: null, isLoadGenerator: false, soleOwner: null, ...over,
  };
}

export const NOW = Date.UTC(2026, 9, 29);
export const HEAD = 1_000_000;
export const context = (datasets: Dataset[], extra: Partial<AskContext> = {}): AskContext => ({ datasets, head: HEAD, now: NOW, ...extra });

/** Index lookup over fixed values: field → stored values, matched ignoring case. */
export const lookupOf = (values: Record<string, string[]>): NonNullable<AskContext["lookup"]> => (_id, text, fields) =>
  fields.flatMap((f) => (values[f] ?? []).filter((v) => v.toLowerCase() === text.toLowerCase()).map((value) => ({ field: f, value, count: 1 })));

/** The parse of `question` with `d` already chosen, as the condition parsers see it. */
export const parseFor = (question: string, d: Dataset, extra: Partial<AskContext> = {}) => forDataset(startParse(question, context([d], extra)), d);
