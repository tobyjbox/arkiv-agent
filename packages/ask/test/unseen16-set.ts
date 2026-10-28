// T16 check set: written and committed before the T16 parser changes, without QA's T15 questions,
// and scored once as written (T16 progress log). It targets the failure kinds T15 found, on other
// datasets and wordings, so it is not blind; QA's T17 set is the measure.
import type { AskQuery } from "../src/query.ts";
import type { EvalCase } from "./eval-set.ts";

const n = (op: "gt" | "gte" | "lt" | "lte", attr: string, type: "i32" | "u64", value: string): AskQuery => ({ op, attr, type, value });
const b = (attr: string, value: boolean): AskQuery => ({ op: "eq", attr, type: "bool", value: String(value) });

/** `ignored`: words that must be reported as not used; `notIgnored`: words that must not be. */
export const unseen16Set: (EvalCase & { ignored?: string[]; notIgnored?: string[] })[] = [
  { q: "lcrd protocol days with events over 10000 and active_contracts under 3", expect: { datasetId: "0fb4f33507b2", where: { op: "and", terms: [n("gt", "events", "u64", "10000"), n("lt", "active_contracts", "i32", "3")] } } },
  { q: "tolmol reports with entitled_g at least 10000 and received_g below 9000", expect: { datasetId: "5cc56d19c6d7", where: { op: "and", terms: [n("gte", "entitled_g", "i32", "10000"), n("lt", "received_g", "i32", "9000")] } } },
  { q: "bijlilog power cuts with confirmers over 2 and duration_min under 200", expect: { datasetId: "92ce24315cab", where: { op: "and", terms: [n("gt", "confirmers", "i32", "2"), n("lt", "duration_min", "i32", "200")] } } },
  { q: "tideland parcels with x over 20 or y under 5", expect: { datasetId: "8d34dcda4c56", where: { op: "or", terms: [n("gt", "x", "i32", "20"), n("lt", "y", "i32", "5")] } } },
  { q: "stet facts where quote is checked", expect: { datasetId: "0079ace5f83c", where: b("quote_checked", true) } },
  { q: "stet facts where the quote is not checked", expect: { datasetId: "0079ace5f83c", where: b("quote_checked", false) } },
  { q: "show every entity on arkiv", expect: null },
  { q: "all data on the chain", expect: null },
  { q: "newest 10 canton-venues executions", expect: { datasetId: "11d9e431d22c", where: null }, ignored: ["newest"] },
  { q: "muhurat appointments where section is not biology", expect: { datasetId: "81015db9fc0c", where: { op: "not", term: { op: "eq", attr: "section", type: "str", value: "biology" } } }, notIgnored: ["section"] },
];
