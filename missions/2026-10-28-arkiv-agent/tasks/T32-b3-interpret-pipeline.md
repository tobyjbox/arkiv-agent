# T32 — B3: split Ask interpret() into a pipeline

- **Persona:** coder · **Model tier:** frontier · **Depends on:** T31
- **Workspace:** <worktrees>/arkiv-agent-b3, branch refactor/b3-interpret (from local main)
- **Plan:** Part B, B3

## Acceptance criteria
- [x] tokenize -> pick dataset -> list of condition parsers (comparison, negation, between, presence, time, latest), each with its own tests -> build plan
- [x] no function over ~80 lines in packages/ask/src
- [x] every existing Ask question set (eval, held-out, unseen, unseen16) gives identical plans; tests, build, prod e2e pass; don't push

## Progress log
- 2026-10-29T16:27Z claimed; worktree <worktrees>/arkiv-agent-b3, branch refactor/b3-interpret from local main a2f73f9. DB: `.backup` copy. Recorded the full plan (dataset, where, limit, explain, ignored) and `rankDatasets` order from the unchanged code. The corpus: every question in eval, held-out, unseen and unseen16; the compile tests' questions; example questions; the robust odd inputs; 6 variants of each set question (not/last 7 days/between/latest/or/how many); 7,000 generated questions. Each was run in 4 contexts: no lookup, lookup, scoped, and a follow-up of the previous question. 7,472 questions in all; deterministic.
- 2026-10-29T16:51Z refactor (41f1794). Recorded plans byte-identical after. `pnpm test` 620/620, typecheck, build, prod e2e on 3111 21/21.
- 2026-10-29T16:54Z old vs new on the real catalogue (DB copy, 753 datasets, `findValues` lookup): 0 differences in 460 questions.
- 2026-10-29T16:55:02Z notify intent: T32 review candidate=41f1794 to Orchestrator local_<session> via ccd send_message; key 2026-10-28-arkiv-agent:T32@41f1794:review; attempt 1.

## Handoff
Branch refactor/b3-interpret (local only, not pushed), candidate 41f1794, base local main a2f73f9. One commit.

- **Pipeline.** `interpret()` (packages/ask/src/interpret.ts) is now 13 lines:
  1. tokenize;
  2. `BEFORE_DATASET` parsers (addresses, result count);
  3. `pickDataset`;
  4. the `CONDITIONS` list, in order;
  5. `NOTES`;
  6. `buildPlan`.
  - Each parser uses up the words it reads, so the order of the list is part of the rules. It is unchanged.
- **Modules** in packages/ask/src/interpret/:
  - `tokens.ts`: tokenize, stem, vocabulary, numbers.
  - `fields.ts`: which field a word names, example-value hits, time, duration and scale units.
  - `parse.ts`: shared state and helpers.
  - `dataset.ts`: scoring, `pickDataset`, `rankDatasets`.
  - `plan.ts`: OR merging, grouping, follow-ups, ignored words, count note.
  - `conditions/`, one file per parser: addresses, latest (count and sort note), time, comparison, between (ranges), negation, yes-no, values (example and index values), field-value, places, presence.
- **Negation is a module but not a pass.** It applies "not"/"except" to the condition being built: NOT for values, outside-the-range for "not between", flipped for yes/no. A separate pass would see a different set of free words and change plans.
- **Tests.** One test file per module in packages/ask/test/interpret/, 67 tests on small synthetic datasets. The question-set tests are unchanged.
- **Function length.** The longest function in packages/ask/src is 46 lines (`runAsk`, untouched); the longest in interpret is 42 (`yesNoField`).
- **Small cleanups, no behaviour change.** An unused `escape` helper is gone. One dead reassignment is gone. Exports are unchanged (`interpret`, `rankDatasets`, `stem`, `AskContext`, `NotUnderstood`).
- **Behaviour unchanged.** The recorded plans are byte-identical before and after, in all four contexts, as is the `rankDatasets` order. A second check ran the old and new code side by side on the real catalogue from the DB copy (753 datasets) and the real index lookup (`findValues`). It covered 460 questions (the four sets plus generated ones), each with and without the lookup as a chain of follow-ups, plus `rankDatasets`: 0 differences.

Tests: `pnpm test` 620/620 (67 new), typecheck clean, `pnpm build`, `PORT=3111 pnpm test:e2e` 21/21.
Next owner: Orchestrator (review/merge). T33 (B4) next.
