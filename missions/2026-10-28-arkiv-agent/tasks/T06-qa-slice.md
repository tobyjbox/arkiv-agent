# T06 — QA review of slice

- **Persona:** qa
- **Model tier:** fast
- **Depends on:** T05
- **Workspace:** integration branch mission/2026-10-28-arkiv-agent (read-only); findings as draft rows
- **Port:** 3102

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] run locally from scratch
- [x] check acceptance of T01-T05
- [x] file findings

## Acceptance criteria
- [x] report in task Handoff; each finding a concrete failure with repro

## Progress log
- 2026-10-28T22:32Z claimed (arkiv-agent_QA_claude-code_opus-5.5-low). Base 3141fd3.
- 2026-10-28T22:34Z fresh clone keyless: install, typecheck, 52/52 vitest, next build all pass. index:verify --attrs 20: 20/20, count diff -2 within lag.
- 2026-10-28T22:34Z blind set committed (d967b1b) before running; 8/15 pass.
- 2026-10-28T22:36Z handoff written; -> review.

## Handoff
Branch review/qa-slice (base 3141fd3 = mission with T01-T05). Evidence: tasks/T06-blind-questions.md (pre-run, d967b1b), tasks/T06-blind-results.txt.
Setup: fresh `git clone` of review/qa-slice in a scratch dir, `cp .env.example .env` (no keys), DB = `sqlite3 .backup` snapshot of the shared index (read-only, no second indexer), `PORT=3102 pnpm dev`.

**Passes:** pnpm install / typecheck / `pnpm test` 52/52 / `pnpm build` all keyless. `pnpm index:verify --attrs 20`: chain 37172 vs index 37170 (5 blocks behind), 20/20 attributes match. /catalogue, /catalogue/[id], /ask, /api/changes serve on 3102. Playwright 6/7 (see F6).
**Not covered:** full `pnpm index` from block 1 (README: ~2 h decode); used the shared snapshot per assignment. Claude path (key) not tested, by A01.

### Findings (each a concrete failure)
- **F1 high: Ask (keyless rules) silently drops conditions; blind set 8/15 (53%) vs 80% bar.** Repro: POST /api/ask `{"question":"claim-check listed hospitals in Pune"}` returns `app='claim-check' AND kind='listed'` with `where:null, note:null` (city dropped, no warning). Same for Q3 "expiry_ym after 202612" (comparison dropped), Q6 "exceed limits" (exceeds=true dropped), Q7 "in district Jaipur" (dropped), Q10 "for asset BTC" (dropped). User sees a superset as the answer. Expected: apply the condition, or say which words were not understood. T05's 20/20 eval does not generalise.
- **F2 high: negation inverted.** Repro: `{"question":"kharab alerts where exp_ok is false"}` gives `exp_ok = true`. Returns the opposite set with no note.
- **F3 medium: owner-only question bound to an unrelated dataset.** Repro: `records owned by 0x0000000000000000000000000000000000000001` gives `project = str('arkiv-records-appgprj-6ac5f4bf') AND $owner = addr(0x…01)`. Owner results outside that one project are hidden. Expected: owner filter across all records, or "no dataset matches".
- **F4 medium: keyless catalogue has no descriptions; T04 AC conflicts with A01.** 736/736 datasets `description:null`; dataset page reads "No AI summary yet". T04 AC requires a description. A01 (keyless) is cited by the Orchestrator but PLAN.md `## Amendments` still reads "(none)" on mission/2026-10-28-arkiv-agent. Next: Orchestrator records A01 and decides whether keyless needs a rule-based description or the AC is amended.
- **F5 medium: e2e can test the wrong server.** apps/arkiv-agent/playwright.config.ts hardcodes baseURL/port 3101 with `reuseExistingServer:true`. Right now another agent's server is listening on 3101 (node pid 71790), so `pnpm test:e2e` from this checkout would run against that build and pass or fail for the wrong code. Expected: honour `PORT` (as `pnpm dev` does).
- **F6 low: catalogue e2e is time-dependent.** `e2e/catalogue.e2e.ts:20` asserts `/Synced \d+ s ago/`; with no `index --watch` running the label is "Synced 1 min ago" and the test fails. Repro: run e2e against a static DB copy (config port changed to 3102 in a scratch copy only).
- **F7 low: `index:verify --attrs` compares names and types only, not values** (packages/indexer/src/verify.ts:29-30), so a decode bug that keeps types but corrupts values passes the spot-check.

Deviations: blind Q2/Q6 expectation is my reading of plain English; I judged results on the compiled query. Q5 returned 0 rows with a correct query (not counted as a failure). Q11 ("how many") counted a pass: correct dataset; no count shown.
Next owner: Orchestrator (add finding rows; F1/F2 to coder via T05 follow-up; F4 decision).
- 2026-10-28T22:36:27Z notify intent: T06 review candidate=7e89549057c54fa06af78cb745c754eb50323b6b to Orchestrator local_<session> via ccd send_message; attempt 1. (Progress-log times above corrected to actual UTC.)
