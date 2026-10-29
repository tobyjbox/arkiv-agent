export type AttrType = "bool" | "i32" | "u64" | "u256" | "dec" | "bytes32" | "str" | "addr" | "key";

/** Who a dataset belongs to, and how sure we are. Labels on Arkiv are not locks. */
export type Attribution = {
  /** The label value, or the writer's address when there is no label. */
  label: string;
  method: "label" | "creator";
  /** The attribute that carried the label (`project`, `app`, …), for queries. */
  labelAttr: string | null;
  /** True when the label was normalized (run-id suffix dropped), so queries use a prefix. */
  isPrefix: boolean;
  /** Heuristic, 0 to 1: shown so readers can judge it. */
  confidence: number;
  /** Set when unrelated wallets (no shared writers) use the same label. */
  conflictWallets: number | null;
};

export type Ownership = "app" | "user" | "mixed";

export type SchemaField = { name: string; type: AttrType; presence: number; examples: string[] };

/** An attribute by name and type, for presence checks. */
export type AttrRef = { name: string; type: AttrType };

/**
 * What picks a shape-named dataset's records out of everything its label or wallet writes: attributes
 * they all have and attributes none of them have, checked against the index (build.ts).
 */
export type Shape = { has: AttrRef[]; lacks: AttrRef[] };

export type Dataset = {
  /** Stable URL id: a hash of the grouping key. */
  id: string;
  name: string;
  /** `discriminator`: from a kind/type attribute value. `schema`: from the attribute names. */
  nameSource: "discriminator" | "schema";
  /** The attribute + value that defines it, if any (e.g. kind = "note"). */
  discriminator: { name: string; value: string } | null;
  /** Set for shape-named datasets that one query can read back; null otherwise. */
  shape: Shape | null;
  /** Why one query can't read this dataset back (it's browse-only), or null when it can. */
  unqueryable: string | null;
  project: Attribution;
  schema: SchemaField[];
  liveCount: number;
  writers: number;
  ownership: Ownership;
  /** Median planned lifetime of live records in blocks; null when they never expire. */
  medianLifetimeBlocks: number | null;
  firstWriteBlock: number;
  lastWriteBlock: number;
  writes24h: number;
  /** Creates per hour, oldest first, 24 points. */
  hourly24h: number[];
  contentTypes: string[];
  medianPayloadBytes: number | null;
  /** Most writes come from a high-volume owner (Arkiv's load generators). */
  isLoadGenerator: boolean;
  /** One writer, for SDK snippets (`ownedBy`); null when many. */
  soleOwner: string | null;
};

export type CatalogueSummary = {
  indexedBlock: number;
  chainHead: number;
  syncedAt: string | null;
  datasets: number;
  projects: number;
  /** Live records in the index, decoded or not. */
  liveRecords: number;
  /** Live records whose attributes are not decoded yet (excluded from datasets). */
  undecodedLive: number;
  writes24h: number;
  hourlyWrites24h: number[];
};

export type Catalogue = { summary: CatalogueSummary; datasets: Dataset[] };
