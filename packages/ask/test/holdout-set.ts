// Held-out questions: written after the parser passed the main eval, committed before running
// them, and scored once as written (see the T05 progress log). The parser was designed while
// reading the main set, so this set is the fairer measure of how it does on new questions.
import type { AskQuery } from "../src/query.ts";
import type { EvalCase } from "./eval-set.ts";
import { evalContext } from "./eval-set.ts";

const s = (attr: string, value: string): AskQuery => ({ op: "eq", attr, type: "str", value });
const and = (...terms: AskQuery[]): AskQuery => ({ op: "and", terms });

export const holdoutSet: EvalCase[] = [
  { q: "haqclock information commission orders that were corrected", expect: { datasetId: "8d5ce22578cc", where: null } },
  { q: "tideland jetty structures", expect: { datasetId: "8743747487be", where: s("material", "jetty") } },
  { q: "muhurat appointments for chemistry in Maharashtra", expect: { datasetId: "81015db9fc0c", where: and(s("section", "chemistry"), s("state", "Maharashtra")) } },
  { q: "nexora shifts in jaipur with net hourly over 400", expect: { datasetId: "e5cdf38e16e3", where: and(s("city", "jaipur"), { op: "gt", attr: "net_hourly", type: "i32", value: "400" }) } },
  { q: "doorledger withdrawals on ethereum", expect: { datasetId: "24ff9529cf92", where: and(s("side", "withdraw"), s("net", "ethereum")) } },
  { q: "stet facts that challenge the claim", expect: { datasetId: "0079ace5f83c", where: s("stance", "challenges") } },
  { q: "supercall statuses that are armed", expect: { datasetId: "0344946188a5", where: s("status", "armed") } },
  { q: "prometheus receipts for expired events", expect: { datasetId: "ff31b7daa8f1", where: s("event", "expired") } },
  { q: "tankha downvotes", expect: { datasetId: "41cc9cff4c28", where: s("dir", "down") } },
  { q: "switched-off emergency records", expect: { datasetId: "381a3ade5c1f", where: { op: "eq", attr: "emergency", type: "bool", value: "true" } } },
  { q: "kharab links with a lag of more than 30 days", expect: { datasetId: "2cffd6fdce8c", where: { op: "gt", attr: "lag_d", type: "i32", value: "30" } } },
  { q: "examseal key shares for shift 2", expect: { datasetId: "9ff4bfb6ae5c", where: { op: "eq", attr: "shift", type: "u64", value: "2" } } },
  {
    q: "onrecord messages seen in the last hour",
    expect: { datasetId: "2c0d7cec7ea7", where: { op: "gte", attr: "seen_at", type: "u64", value: String(Math.floor(evalContext.now / 1000) - 3600) } },
  },
  { q: "lcrd amm contracts", expect: { datasetId: "a0f00e13f070", where: s("group", "amm") } },
  { q: "jalsaakshya arsenic samples in Nadia", expect: { datasetId: "bc66899b596e", where: and(s("contaminant", "arsenic"), s("district", "Nadia")) } },
];
