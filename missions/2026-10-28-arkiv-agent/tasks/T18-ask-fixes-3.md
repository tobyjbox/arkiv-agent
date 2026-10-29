# T18 — Fix T17 QA findings (N1, Q5, Q6, N4)

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T17
- **Workspace:** worktrees/arkiv-agent-ask-fixes-3, branch feat/ask-fixes-3
- **Port:** 3101
- **Priority:** before T11 (must-ship slice quality over stretch)

## Inputs
- tasks/T17-qa-final.md Handoff, T17-blind-results.txt, T17-t15-rerun.txt

## Milestones
- [x] N1
- [x] Q5, Q6, N4
- [x] self-review

## Acceptance criteria
- [x] N1: no plan the RPC rejects reaches the user as an error; EXISTS/NOT EXISTS used only if the RPC supports them (verify live), otherwise the condition is listed as Not used with a reason; unparsed numbers never become EXISTS(x)
- [x] Q6: "not between" negates the range
- [x] Q5: description words don't bind an unrelated dataset
- [x] N4: dataset-detail e2e stable over 5 runs
- [x] all tests pass; no re-tuning to T17 questions beyond these general fixes

## Progress log
- 2026-10-29T02:54:29Z Candidate c13296c. Checked live first: EXISTS, NOT EXISTS and EXISTS alone all fail on Tiramisu with -32002 (equality
  queries on the same dataset succeed). Vitest 506, Playwright 10 (catalogue tests 12/12 over 3 repeats). Live runs: the
  Purulia, parent_key, "at most ten" and "not between" questions all return rows. Question sets unchanged (20/20, 15/15,
  15/15, 10/10).

## Handoff


**Candidate:** `c13296c` on `feat/ask-fixes-3`. Not merged.

- **N1:** Tiramisu's node doesn't support EXISTS. The SDK builds it, but the node answers -32002 for EXISTS,
  NOT EXISTS, and EXISTS on its own (checked live 2026-10-29).
  - Ask no longer generates EXISTS. "With/without X" leaves those words as Not used, and the notes explain why.
  - `compile()` refuses an EXISTS plan before it is sent (for edited or Claude plans).
  - The fall-throughs QA saw were unread values ("ten", "exactly"). Those are now read.
  - Friction note to add in a later docs pass: "EXISTS is in the SDK but rejected by the node".
- **N2:** "not between A and B" becomes `< A OR > B`.
- **N3:** with the index lookup, candidates that only weakly match a name are rescored on stored values before
  the threshold, so the dataset holding the value wins.
- **N4:** the detail e2e opens the first row's href instead of clicking it (rows can reorder under live updates).
  12/12 over 3 repeats.
- Verify: `pnpm test` (506); `pnpm build`, then `PORT=3104 pnpm test:e2e`, or 3101 if it's free.
