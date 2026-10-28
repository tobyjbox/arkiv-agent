# T16 — Fix T15 QA findings (R1-R6)

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T15
- **Workspace:** worktrees/arkiv-agent-ask-fixes-2, branch feat/ask-fixes-2
- **Port:** 3101

## Inputs
- tasks/T15-qa-recheck.md Handoff, T15-blind-results.txt

## Milestones
- [x] R1-R3 (parser)
- [x] R4-R6
- [x] self-review

## Acceptance criteria
- [x] R1: multi-clause comparisons joined by and/or keep every clause with its own attribute and value
- [x] R2/R4: "is known", "latest" either applied or listed as Not used; never silently ignored
- [x] R3: whole-chain questions aren't bound to a single dataset
- [x] R5: an applied attribute is not also listed as Not used
- [x] R6: a static (non-watching) index shows a truthful sync state, not "can't reach the index"; e2e list test passes
- [x] fixes generalise (T17 measures on another unseen set); all tests pass

## Progress log
- 2026-10-28T23:02:20Z Claimed and in-progress (85792ab, 21f7fa8).
- 2026-10-28T23:04:37Z R6 (sync state) and a 10-question T16 check set, committed before the parser changes and written
  without QA's T15 questions (a4e9a01). Baseline on the old parser: 3/10.
- 2026-10-28T23:10:07Z Candidate 9127e8a. Check set first run after the R1-R5 changes: 10/10. Main 20/20, held-out 15/15,
  T14 unseen 15/15. T15 questions run once on the build (seen; informational): three more general bugs found and
  fixed ("up" refused as a value because it starts "up to"; "arkiv" in a record kind named the dataset; presence not
  expressible); presence ("without a parent_key") added as Arkiv EXISTS. Vitest 500, Playwright 9.

## Handoff

**Candidate:** `9127e8a` on `feat/ask-fixes-2` (worktree `worktrees/arkiv-agent-ask-fixes-2`). Not merged.

**What changed, by finding**
- **R1:** a comparison binds the field just before it ("x greater than 10"), with only "is", "of" or "the"
  allowed between. Failing that, the field just after the number ("more than 10000 events"), then further back.
  The search never crosses "and", "or" or a comma. Clauses joined by "or" become an OR group ("x over 20 or y
  under 5"); "and" keeps all of them. The same applies to "N or more" and "between".
- **R2:** multi-word yes/no fields read across "is" and "not" ("expiry is known", "quote is not checked"), and
  "unknown"/"non-…" negate.
- **R3:**
  - Generic words (arkiv, golem, chain, data, everything) no longer name a project or a record kind. A label or
    kind made only of them can't be chosen.
  - Whole-chain questions ("every record", "all data") with no clearly named dataset are refused with a reason:
    "Ask reads one dataset at a time … or finds records by owner or creator address."
- **R4:** "latest", "newest" and "recent" are reported as Not used, with a note that Arkiv can't sort, so these
  are the first records it returns. "first/top N" is still read as a count.
- **R5:** a field with a condition is never Not used, and binding a value also claims the field name just
  before it. A field named without any condition is reported as Not used, so no word is ignored silently.
- **R6:** `syncState()` (apps/arkiv-agent/lib/sync-state.ts, unit-tested):
  - ArkivAgent's own API not answering shows "Sync paused · Retry".
  - An API that answers while the index stays still shows "Synced 5 min ago · index not updating", with an
    amber dot and a tooltip saying to start `pnpm index --watch`.
  - The e2e list test matches both.
- **Also:**
  - "with/has X" becomes `exists(X)` and "without/no/missing X" becomes `NOT exists(X)` (Arkiv's EXISTS). The
    chip shows "has X" / "no X" and can be removed.
  - A short value that begins a comparison phrase ("up" in "dir is up") is read as a value.

**How to verify**
- `pnpm test` (Vitest 500). It prints main 20/20, held-out 15/15, T14 unseen 15/15 and T16 check 10/10, and
  includes regression tests built from the R1–R5 repros.
- `pnpm build`, then `pnpm test:e2e` with 3101 free (Playwright 9).

**Measurement, honestly**
- The T16 check set targets the T15 failure kinds on other datasets, so it is not blind: 3/10 on the old parser,
  10/10 on the first run after the R1–R5 changes.
- QA's T15 questions were not used as tests. On the final build, all 15 give the intended conditions, or a
  refusal for Q15; Q14's "delete" is listed as Not used, and the query is read-only.
- T17's fresh set is the real measure.

**Limits**
- Synonyms and misspellings are still reported as unused, not guessed.
- An OR across different fields is only built when the clauses are joined by "or" with no "and" between them.
- Sorting ("latest") can't be applied on Arkiv.
