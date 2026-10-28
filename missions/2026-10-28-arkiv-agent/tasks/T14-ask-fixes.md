# T14 — Fix T06 QA findings (F06-1..3, F06-5..7)

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T06, T13 (same session; avoids /api/ask overlap)
- **Workspace:** worktrees/arkiv-agent-ask-fixes, branch feat/ask-fixes (created at release)
- **Port:** 3101

## Inputs
- tasks/T06-qa-slice.md Handoff, T06-blind-questions.md, T06-blind-results.txt

## Milestones
- [x] F1-F3 parser fixes (general, not tuned to the T06 set)
- [x] F5-F7 test hygiene
- [x] self-review

## Acceptance criteria
- [x] F1: a condition the rules can't parse is never silently dropped; the UI says what was ignored or refuses
- [x] F2: negations ("is false", "not") compile correctly, with tests
- [x] F3: owner-only questions aren't bound to an unrelated project
- [x] F5: Playwright uses a configurable port and doesn't reuse a foreign server; F6: no wall-clock-dependent assertions; F7: verify compares values for sampled attributes
- [x] all tests pass; QA re-measures blind accuracy in T15 (fixes must generalise, not fit the seen T06 set)

## Progress log
- 2026-10-28T22:44:34Z Claimed and in-progress (63426c8, 67fd9f3); task file brought from origin/main to the branch copy.
- 2026-10-28T22:45:36Z Before changing the parser: index value lookup (`findValues`), a recorded values fixture, and a
  15-question unseen set written without using QA's T06 questions (578c8f7). Baseline on the old parser: 4/15.
- 2026-10-28T22:54:40Z Candidate c260c44. Unseen set first run after the changes: 14/15 (the miss: a sibling dataset won
  on its three examples; fixed generally by scoring the top candidates on index values), then 15/15. Main eval 20/20,
  held-out 15/15 (unchanged). Vitest 487 (415 of them a robustness test), Playwright 9. A trailing comparator
  ("lag_d 30 or more") crashed the rules (index past the end); fixed and covered by the robustness test.
- 2026-10-28T22:55:13Z Flipped to review, candidate c260c44. Notification intent: key `2026-10-28-arkiv-agent:T14@c260c44:review`; recipient Orchestrator thread local_<session>; route Claude Code SendMessage; send once.

## Handoff

**Candidate:** `c260c44` on `feat/ask-fixes` (worktree `worktrees/arkiv-agent-ask-fixes`). Not merged.

**What changed, by finding**
- **F1 (conditions dropped):** the rules now cover values beyond the catalogue's three examples, and never drop
  a word silently.
  - `findValues` (packages/catalogue/src/values.ts) looks a question's words up in the whole index: exact match,
    ignoring case, within the dataset's own records. The rules use it in three places:
    - Field-then-value: "district Doda", "asset BTC", "lender type NBFC". The longest field name wins, and a
      field's own words are never taken as a value.
    - Place phrases: "in/at/from/near X" fills a city/district/state-type field. The index decides which field;
      with no hit and one place field, the value is taken as typed and the page says so.
    - Choosing between sibling datasets: the top 6 candidates are scored on index values, so three lucky examples
      no longer decide.
  - A value after a field name that ArkivAgent has never seen is still applied, with a note that it may match nothing.
  - Every word the plan doesn't use goes into `plan.ignored`, which the page shows as a warning row ("Not used: …
    The results are not filtered by it") and the API returns. Filler words ("show", "how many") are not reported;
    "how many" adds a note that Arkiv has no count.
- **F2 (negation):** yes/no fields read "is false", "is not true", "not X", "no", "isn't" and "un-". The stemmer
  no longer cuts "exceed" to "exce", so "exceed limits" reaches `exceeds`. `emergency = false` compiles (tested).
- **F3 (owner bound to a project):** generic words such as "records" no longer name a project (the
  `arkiv-records-app…` label). With an owner/creator address, a dataset narrows the query only when it is clearly
  named. "owned"/"by" count as part of the owner condition.
- **Also:** after/before/since/until, "N or more"/"N or less", "between A and B", ≥/≤.
- **F5:** Playwright takes PORT (default 3101), starts its own server, and refuses one already on the port
  (checked: "…already used"). `E2E_REUSE_SERVER=1` opts in to reuse.
- **F6:** the sync label assertion accepts any age ("Synced 3 min ago").
- **F7:** `index:verify --attrs` compares names, types and values. Values are normalized as the indexer stores
  them (`attributeDiff`, unit-tested with a corrupted value). Live run: 5/5 match, index count equal to chain.

**How to verify**
- `pnpm test`: Vitest 487. The Ask tests print main 20/20, held-out 15/15 and T14 unseen 15/15. The
  robustness test runs 415 generated questions; none may throw, and every plan must validate.
- `pnpm build`, then `pnpm test:e2e` with nothing on 3101 (Playwright 9; it starts its own server), or
  `PORT=3104 pnpm test:e2e`.
- `pnpm index:verify --attrs 20` (spends the anonymous arkiv_query budget).

**Measurement, honestly**
- QA's T06 questions are seen, so they were not used as tests. Run once against the final build (informational):
  all 15 now give the expected conditions, with "limits" reported as unused in Q6.
- The T14 unseen set was written knowing which kinds of failure this task fixes, so it is not blind. It went from
  4/15 on the old parser to 14/15 on the first run after the changes, then 15/15. QA's fresh set in T15 is the
  real measure.

**Limits and deviations**
- Index lookups are exact (ignoring case). Misspellings and synonyms are reported as unused, not guessed.
- A place word with no stored match, in a dataset with several place fields, is reported as unused (ambiguous).
- The values fixture (`packages/ask/test/fixtures/values.json`) holds up to 40 common text values per field from
  public chain data, for the 73 fixture datasets. Check it with the catalogue fixture before publishing (T07 I2).
- Lookups add 10 to 600 ms to interpreting a question (measured on the T06 questions).
- Not in scope: F4 (keyless descriptions, the Orchestrator's decision).
