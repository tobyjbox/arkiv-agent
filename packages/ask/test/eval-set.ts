// The Ask Arkiv eval: 20 questions a new developer might type, with the query each should become.
// Written against the recorded catalogue (fixtures/catalogue.json) before the parser, and not
// edited to fit it. A case passes when the dataset and the conditions match (order-insensitive).
import type { AskQuery } from "../src/query.ts";
import fixture from "./fixtures/catalogue.json" with { type: "json" };

const head = fixture.summary.indexedBlock;
const now = Date.parse(fixture.summary.syncedAt!);
const BLOCKS_PER_DAY = 43_200;
const DAY_MS = 86_400_000;

export type EvalCase = {
  q: string;
  /** null: the question should not become a query ("couldn't understand"). */
  expect: { datasetId: string | null; where: AskQuery | null } | null;
};

const s = (attr: string, value: string): AskQuery => ({ op: "eq", attr, type: "str", value });

export const evalContext = { head, now };

export const evalSet: EvalCase[] = [
  { q: "tankha salaries in noida", expect: { datasetId: "011e76e5c32f", where: s("city", "noida") } },
  { q: "Salaries on tankha with ctc over 1500000", expect: { datasetId: "011e76e5c32f", where: { op: "gt", attr: "ctc", type: "i32", value: "1500000" } } },
  {
    q: "Water quality observations where arsenic exceeds the limit",
    expect: { datasetId: "4f710a5e2124", where: { op: "and", terms: [s("contaminant", "arsenic"), { op: "eq", attr: "exceeds", type: "bool", value: "true" }] } },
  },
  { q: "tagwitness observations not for actions/checkout", expect: { datasetId: "fc3d1203b706", where: { op: "not", term: s("repo", "actions/checkout") } } },
  { q: "dawa-alert alerts issued by CDSCO", expect: { datasetId: "ef25a3564038", where: s("authority", "CDSCO") } },
  { q: "kharab alerts for misbranded drugs", expect: { datasetId: "4b790fc3d088", where: s("class", "misbranded") } },
  { q: "hospitals delisted by tata-aig in Surat", expect: { datasetId: "527c66cea25a", where: { op: "and", terms: [s("insurer", "tata-aig"), s("city", "SURAT")] } } },
  { q: "tideland parcels with x greater than 20", expect: { datasetId: "8d34dcda4c56", where: { op: "gt", attr: "x", type: "i32", value: "20" } } },
  { q: "tolmol reports from the last 7 days", expect: { datasetId: "5cc56d19c6d7", where: { op: "gte", attr: "reported_at", type: "u64", value: String(now - 7 * DAY_MS) } } },
  { q: "tolmol wheat reports from gaya", expect: { datasetId: "5cc56d19c6d7", where: { op: "and", terms: [s("item", "wheat"), s("district", "gaya")] } } },
  { q: "tolmol reports where received is below 8000 grams", expect: { datasetId: "5cc56d19c6d7", where: { op: "lt", attr: "received_g", type: "i32", value: "8000" } } },
  { q: "supercall calls on WETH", expect: { datasetId: "973e952b5a36", where: s("asset", "WETH") } },
  { q: "canton-venues executions", expect: { datasetId: "11d9e431d22c", where: null } },
  { q: "sayso consent receipts that were withdrawn", expect: { datasetId: "2f55d575814f", where: s("action", "withdrawn") } },
  {
    q: "entities owned by 0x1c92087EC55B3B4114c7647ECADe3ab0b494C9b6",
    expect: { datasetId: null, where: { op: "eq", attr: "$owner", type: "addr", value: "0x1c92087EC55B3B4114c7647ECADe3ab0b494C9b6" } },
  },
  { q: "tideland signs expiring in the next 24 hours", expect: { datasetId: "f077658188ca", where: { op: "lte", attr: "$expiresAt", type: "u64", value: String(head + BLOCKS_PER_DAY) } } },
  {
    q: "lcrd protocol days for etherfuse with more than 10000 events",
    expect: { datasetId: "0fb4f33507b2", where: { op: "and", terms: [s("protocol", "etherfuse"), { op: "gt", attr: "events", type: "u64", value: "10000" }] } },
  },
  { q: "bijlilog power cuts longer than 3 hours", expect: { datasetId: "92ce24315cab", where: { op: "gt", attr: "duration_min", type: "i32", value: "180" } } },
  { q: "dawa alerts from CDSCO or State drug lab", expect: { datasetId: "ef25a3564038", where: { op: "or", terms: [s("authority", "CDSCO"), s("authority", "State drug lab")] } } },
  { q: "what's the weather in Lisbon today?", expect: null },
];
