// Arkiv-Decode: what the index says about how projects model and use their data. Everything here is
// inferred from attribute names, types and record links; the UI presents it as inference.

/** A group of record-to-record references: `attr` on records of `from` points at records of `to`. */
export type RefEdge = {
  from: string;
  /** The dataset the targets belong to; null when they are outside the catalogue (expired, deleted or never indexed). */
  to: string | null;
  attr: string;
  /** False when the attribute is a `key`; true when it is text or bytes32 holding a record key. */
  isImplicit: boolean;
  count: number;
  /** References from live records whose target is not live. */
  broken: number;
  /** References whose source and target have different owners. */
  crossWallet: number;
};

export type ArchetypeId =
  | "marketplace" | "social" | "identity" | "registry" | "logistics" | "health" | "finance" | "game"
  | "civic" | "agents" | "telemetry" | "files" | "test" | "unclear";

export type Purpose = {
  archetype: ArchetypeId;
  /** Share of the matched evidence that points at this archetype, 0 to 1. */
  confidence: number;
  /** Attribute, dataset or label words that matched. */
  evidence: string[];
  runnerUp: ArchetypeId | null;
};

export type PrivacyCategory = "contact" | "person" | "health" | "government id" | "location" | "financial" | "birth date" | "personal wallet";
export type PrivacyFlag = { category: PrivacyCategory; fields: string[] };

export type DecodeDataset = {
  id: string; name: string; live: number; writers: number; fields: number;
  flags: PrivacyFlag[];
  /** True when every content type on the dataset looks encrypted or sealed. */
  isSealed: boolean;
};

export type DecodeProject = {
  id: string; label: string; isLabel: boolean;
  live: number; writers: number;
  purpose: Purpose;
  /** Plain statements about how the data behaves: lifetime, ownership, links. */
  traits: string[];
  datasets: DecodeDataset[];
  refs: number; broken: number;
};

export type Convention = { name: string; projects: number; types: { type: string; projects: number }[] };
export type SharedShape = { fields: string[]; projects: string[]; datasets: string[] };
export type SharedBuilder = { a: string; b: string; wallets: number };

export type GraphNode = { id: string; kind: "project" | "dataset"; label: string; project: string; live: number; archetype: ArchetypeId; flags: number };
export type GraphLink = { source: string; target: string; kind: "member" | "ref" | "shape" | "builder"; count: number; broken: number };

export type Decode = {
  indexedBlock: number;
  summary: {
    projects: number; datasets: number; refs: number; resolved: number; broken: number;
    crossProject: number; crossWallet: number; implicit: number; flaggedDatasets: number; sharedShapes: number; multiProjectWallets: number;
  };
  projects: DecodeProject[];
  refEdges: RefEdge[];
  conventions: Convention[];
  sharedShapes: SharedShape[];
  sharedBuilders: SharedBuilder[];
  nodes: GraphNode[];
  links: GraphLink[];
};
