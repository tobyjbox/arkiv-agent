# T01 — Ask Arkiv: example question chips from the live catalogue

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** — (base: main, current tip)
- **Workspace:** ~/dev/worktrees/arkiv-agent-ask-examples, branch feat/ask-examples (from main; never push)
- **Port:** 3117 (3101 is the owner's running app; don't stop it)

## Inputs
- BRIEF.md (owner: chips under the box, generated from the live catalogue, coder follows existing chip style)
- design/04-ask-arkiv.md; current /ask empty state

## Milestones
- [x] Example generator: 4–6 questions built from live catalogue datasets/attributes, each covering a different supported form (whole dataset, numeric comparison, string equality, by project/writer, recent/expiring, etc. — whatever the rules interpreter actually parses). Each must interpret without ANTHROPIC_API_KEY and return ≥1 result; skip forms with no fitting data
- [x] UI: "Try asking" chips under "Ask a new question", shown only before a question is asked; click fills and runs; keyboard accessible; works at 375 px; a short hint line on what kinds of questions work
- [x] Tests: unit test for the generator (every generated example interprets by rules); e2e for chips visible, click runs, hidden after a result

## Acceptance criteria
- [ ] pnpm test, typecheck, build, prod e2e green
- [ ] no regressions on /ask; no interpreter changes
- [ ] do not write session IDs (local_*) into task files or commits; use <session>

## Progress log
- 2026-10-30T10:54:30Z coder: all three milestones done on feat/ask-examples, candidate fac014b. Checks: pnpm test 637/637, typecheck, build, prod e2e 27/27 three of three on 3117. Live on 3117 (rules only): all 5 examples read back with no unused words and returned rows from Arkiv (4 to 50+).
- 2026-10-30T10:54:40Z notify intent: T01 review, candidate fac014b, to the verified Orchestrator <session> (ak-orch.sh thread arkiv-agent) via ccd send_message; one attempt.

## Handoff
**Candidate:** fac014b9e21306340091d0b9b1d2e649aed84abe on `feat/ask-examples` (worktree ~/dev/worktrees/arkiv-agent-ask-examples, base main 59eb07e). Not pushed.

**What changed**
- `packages/ask/src/examples.ts` (new; `exampleQuestions` moved here from `ask.ts`). It writes one question per kind the rules read, each from a different project, largest datasets first:
  - a stored text value ("claim-check listed records with city KRISHNA")
  - a whole dataset ("kharab alerts")
  - a number comparison ("dawa-alert alerts with severity over 1"; the threshold is the rounded median of live values)
  - a recent time window on the dataset's time field ("tankha votes from the last 30 days"; the shortest window that has a record)
  - an owner address ("sayso dlas owned by 0x822B…").
- An example is kept only if the rules (no key) read it back to its own dataset and the condition it shows, `ignored` is empty, and the condition matches at least one live record from the catalogue's members. `matches()` evaluates a query on a record the way Arkiv types values.
  - The check runs without the index lookup first, then confirms with it, as the API reads questions.
  - Each kind tries at most 8 datasets.
  - A kind with no fitting data is skipped.
- `apps/arkiv-agent/lib/ask.ts`: `askExamples(ctx)` keeps the list for 10 minutes, because the lookup confirm takes about 0.5 s on the live index. `/ask` uses it, and the not-understood reply uses its first two.
- `components/ask/ask-view.tsx`:
  - The "Try:" label is now a "Try asking" chip group (`role=group`), with a hint line under it.
  - Chips are shown only before the first question. Clicking a chip, or Enter on it, runs it.
  - Wallet addresses are shortened in the chip text; the full question is in `title` and is what runs.
  - At 375 px the chips sit in one scrolling row, as before.
- Tests:
  - `packages/ask/test/examples.test.ts`: every example interprets by rules with no key, uses every word, is its own kind (text, dataset, gt, gte, owner), and matches a record. Kinds without data are skipped. Also `matches()` cases.
  - `e2e/ask.e2e.ts`: 3 new tests (4 to 6 chips, each read back via /api/ask with no unused words, and when Arkiv answers it has rows; keyboard run plus scope reset plus chips hidden; 375 px). The existing tests now find the chips by the group name.

**How to verify:** `pnpm test`, `pnpm typecheck`, `pnpm build`, then in apps/arkiv-agent `PORT=3117 pnpm exec playwright test`. Open /ask: five chips under the box. Click one: chips and hint go, and results come in.

**Deviations, flagged**
1. **No expiry example.** The rules read "X expiring in the next 7 days" correctly ($expiresAt ≤ block) but report "expiring" as Not used, so the example would look like a misfire. Fixing that needs a one-line interpreter change (consume `expir*` in `timeWindows`), which this task excludes. If it is approved, add the form back (code was written and removed).
2. **Clicking an example resets Scope to "All datasets"** (not in the brief). Examples are built across all datasets, so under a dataset scope they would read against the wrong dataset.
3. **Examples are cached for 10 minutes** per server process, not rebuilt on every request. A record could expire in that window; each example was checked against the index when it was built.
4. **README Ask screenshot unchanged:** it shows an answered question, where the chips are hidden, so the empty state isn't in it.
