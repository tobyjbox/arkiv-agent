// The no-key path: turns a question into an AskPlan with rules driven by the catalogue (dataset
// labels and names, attribute names, types and stored example values). Deterministic, so the eval
// runs in CI and every interpretation can be explained.
//
// A pipeline: tokenize → pick the dataset → condition parsers → build the plan. Each parser uses up
// the words it reads, so an earlier parser's reading wins: the order of the lists below is part of
// the rules. Negation isn't a pass of its own; the parsers that build conditions apply it
// (interpret/conditions/negation.ts).
import { type Result, err, ok } from "@arkiv-agent/core";
import { addresses } from "./interpret/conditions/addresses.ts";
import { ranges } from "./interpret/conditions/between.ts";
import { comparisons } from "./interpret/conditions/comparison.ts";
import { fieldValues } from "./interpret/conditions/field-value.ts";
import { resultLimit, sortNote } from "./interpret/conditions/latest.ts";
import { places } from "./interpret/conditions/places.ts";
import { presence } from "./interpret/conditions/presence.ts";
import { timeWindows } from "./interpret/conditions/time.ts";
import { exampleValues, indexValues } from "./interpret/conditions/values.ts";
import { yesNo } from "./interpret/conditions/yes-no.ts";
import { pickDataset } from "./interpret/dataset.ts";
import { type AskContext, type DatasetParse, forDataset, type NotUnderstood, type Parse, startParse } from "./interpret/parse.ts";
import { buildPlan, countNote } from "./interpret/plan.ts";
import type { AskPlan } from "./query.ts";

export type { AskContext, NotUnderstood } from "./interpret/parse.ts";
export { rankDatasets } from "./interpret/dataset.ts";
export { stem } from "./interpret/tokens.ts";

/** Before the dataset is chosen: addresses and result counts are never part of a dataset's name. */
const BEFORE_DATASET: ((p: Parse) => void)[] = [addresses, resultLimit];

/** Conditions on the chosen dataset's fields, in order. */
const CONDITIONS: ((p: DatasetParse) => void)[] = [
  timeWindows, // "last 7 days", "next 24 hours"
  comparisons, // "ctc over 1500000", "longer than 3 hours"
  ranges, // "between 10 and 20", "5 or more"
  yesNo, // "exceeds the limit", "exp_ok is false"
  exampleValues, // stored example values: "noida"
  fieldValues, // "district Doda", "lender type NBFC"
  places, // "in Nashik"
  presence, // "without a parent_key": reported, not applied
  indexValues, // other stored values, from the index lookup
];

/** Notes about what Arkiv can't do, after the conditions. */
const NOTES: ((p: Parse) => void)[] = [sortNote, countNote];

/**
 * Interprets a question against the catalogue. Returns a plan whose dataset and conditions came
 * only from the catalogue; anything it can't ground becomes "not understood" rather than a guess.
 */
export function interpret(question: string, ctx: AskContext): Result<AskPlan, NotUnderstood> {
  const p = startParse(question, ctx);
  for (const step of BEFORE_DATASET) step(p);
  const notUnderstood = pickDataset(p);
  if (notUnderstood) return err(notUnderstood);
  if (p.dataset) {
    const dp = forDataset(p, p.dataset);
    for (const parse of CONDITIONS) parse(dp);
  }
  for (const note of NOTES) note(p);
  return ok(buildPlan(p));
}
