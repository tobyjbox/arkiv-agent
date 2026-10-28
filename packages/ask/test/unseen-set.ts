// T14 unseen set: written and committed before the T14 parser changes, and scored once as written
// (T14 progress log). Not drawn from QA's T06 questions. Written knowing which kinds of failure T14
// fixes, so it is not blind either; QA's fresh set in T15 is the real measure.
import type { AskQuery } from "../src/query.ts";
import type { EvalCase } from "./eval-set.ts";

const s = (attr: string, value: string): AskQuery => ({ op: "eq", attr, type: "str", value });
const and = (...terms: AskQuery[]): AskQuery => ({ op: "and", terms });

/** `ignored`: words the answer must report as not used (never silently dropped). */
export const unseenSet: (EvalCase & { ignored?: string[] })[] = [
  { q: "claim-check delisted hospitals in Nashik", expect: { datasetId: "527c66cea25a", where: s("city", "NASHIK") } },
  { q: "switched-off records in district Doda", expect: { datasetId: "381a3ade5c1f", where: s("district", "Doda") } },
  { q: "tolmol reports for millet in patna", expect: { datasetId: "5cc56d19c6d7", where: and(s("item", "millet"), s("district", "patna")) } },
  { q: "nexora shifts that are not demo", expect: { datasetId: "e5cdf38e16e3", where: { op: "eq", attr: "demo", type: "bool", value: "false" } } },
  { q: "switched-off records where emergency is false", expect: { datasetId: "381a3ade5c1f", where: { op: "eq", attr: "emergency", type: "bool", value: "false" } } },
  { q: "doorledger episodes with t0 after 1791500000", expect: { datasetId: "24ff9529cf92", where: { op: "gt", attr: "t0", type: "u64", value: "1791500000" } } },
  { q: "stet facts in the pricing category", expect: { datasetId: "0079ace5f83c", where: s("category", "pricing") } },
  { q: "muhurat appointments for physics in Jharkhand", expect: { datasetId: "81015db9fc0c", where: and(s("section", "physics"), s("state", "Jharkhand")) } },
  { q: "entities created by 0x2187a4c9A5CB1701A680950dE1b10A698A5cDABC", expect: { datasetId: null, where: { op: "eq", attr: "$creator", type: "addr", value: "0x2187a4c9A5CB1701A680950dE1b10A698A5cDABC" } } },
  { q: "kharab links from src ka with lag_d over 40", expect: { datasetId: "2cffd6fdce8c", where: and(s("src", "ka"), { op: "gt", attr: "lag_d", type: "i32", value: "40" }) } },
  { q: "tankha salaries at deccan-cloudworks in pune", expect: { datasetId: "011e76e5c32f", where: and(s("company", "deccan-cloudworks"), s("city", "pune")) } },
  { q: "supercall calls on asset LINK", expect: { datasetId: "973e952b5a36", where: s("asset", "LINK") } },
  { q: "tideland structures made of driftwood near the harbour", expect: { datasetId: "8743747487be", where: s("material", "driftwood") }, ignored: ["harbour"] },
  { q: "claim-check listed hospitals by tata-aig in GUJARAT", expect: { datasetId: "473026c53192", where: and(s("insurer", "tata-aig"), s("state", "GUJARAT")) } },
  { q: "weather stations in Oslo", expect: null },
];
