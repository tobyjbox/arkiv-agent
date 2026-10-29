# T12 — Stretch: QA review of T10/T11 (pulse, cost)

- **Persona:** qa
- **Model tier:** fast
- **Depends on:** T11
- **Workspace:** worktrees/arkiv-agent-qa-stretch, branch review/qa-stretch (from integration)
- **Port:** 3102

## Inputs
- tasks/T10-pulse.md, tasks/T11-cost.md Handoffs; design/05-pulse.md, design/06-cost.md

## Milestones
- [x] run /pulse and /cost keyless
- [x] check T10/T11 acceptance + design
- [x] report

## Acceptance criteria
- [x] report in Handoff: T10/T11 acceptance (cost calculator within its stated range on held-out fees), design fit, full e2e pass; each finding a concrete failure with repro

## Progress log
- 2026-10-29T02:56Z claimed (arkiv-agent_QA_claude-code_opus-5.5-low). Base d75929a.
- 2026-10-29T03:00Z fresh clone keyless: 510/510 vitest, build OK; sampled 300 NEW fee receipts into my scratch DB copy (shared index untouched) for an out-of-sample check.
- 2026-10-29T03:07:22Z design review in browser, full e2e on prod build; handoff written; -> review.

## Handoff
Branch review/qa-stretch (base d75929a = integration + T10, T11, T18). Setup: fresh clone, keyless .env, read-only `.backup` of the shared index, port 3102. Evidence: tasks/T12-holdout-check.ts.txt (the out-of-sample script).

**Verdict: T10 and T11 acceptance met. Full e2e passes on the production build. No high or medium findings. 6 low findings, mostly design gaps.**

### Acceptance
- **Keyless run:** /pulse and /cost render with no keys. Pulse shows "No weekly summary yet. (A weekly AI summary needs ANTHROPIC_API_KEY.)" (A01). `pnpm test` 510/510, `pnpm build` OK.
- **T10:** retention works on Tiramisu-era cohorts (weekly first-write cohorts). Unclosed windows are hatched "in N d", never a low number. Period and load filter live in the URL. Bad params (`period=13`, `load=banana`) fall back to defaults.
- **T11 cost range:** independently checked out of sample. I fitted the model on the original 1,500 receipts with the app's `fitFeeModel`. Then I sampled 300 new receipts with `pnpm fees --limit 300` into my scratch DB (none in the fit). **238 of 257 new single-record creates (92.6%) fell inside the stated band 0.863 to 1.057.** New-sample ratio p5/p50/p95 = 0.863/1.011/1.057. Misses are at small payloads (25 to 27 B, ratio 0.84 or 1.06) and payloads over 9 KB (0.79 to 0.80). 43 multi-record or update transactions are outside the claim, as stated.
- **Calculator:** inputs are in the URL. Invalid input shows "Enter a whole number from 1 to 1,000,000." and keeps the last value. Bad URL params fall back to defaults, with no NaN. Fiat is off by default and labelled illustrative. Out-of-range payloads show a warning.
- **Full e2e (`PORT=3102`, production build):** 11/11, three runs out of three. On `pnpm dev` the first run had 3 timeouts (ask, catalogue, pulse URL updates past 5 s; dev renders of /pulse up to 7.3 s), then 11/11 twice. Production renders /pulse in 0.6 to 1.6 s.

### Findings (all low)
- **S1: the server render always says "Synced 0 s ago".** `curl -s localhost:3102/pulse` shows "Synced 0 s ago" while the index's syncedAt is 3+ min old. It corrects only after hydration, so screenshots, no-JS views and the first paint claim freshness that isn't true. This is the shared sync indicator, so it affects every page. Fix: render the real age server-side, or render a placeholder until hydrated.
- **S2: the cost hold-out split depends on SQLite row order.** packages/cost/src/cost.ts:14 selects TxFee with no ORDER BY, and fitFeeModel holds out every 5th row. Refitting the same 1,500 rows ordered by (block, tx) gives 238/254 inside, against the handoff's 232/254, so the coverage figure on the page isn't reproducible. Fix: `ORDER BY block, tx`.
- **S3: out-of-range payloads don't widen the range.** design/06 says to show a warning and widen it. At payload=100000 the warning shows, but the range stays at the usual band (110.6 to 135.6 around 129.3), and the copy says "The range may be too narrow."
- **S4: /cost is missing parts of design/06** (not flagged in the T11 handoff):
  - Observed spend has no period selector (fixed at 30 d).
  - The load-generator control is a link ("Include load generators"), not the always-visible toggle.
  - There's no stacked area chart of spend by project.
  - It has 3 tiles, missing TXS, MEDIAN FEE and PROJECTS.
  - The fee model shows one scatter (gas vs calldata) instead of fee vs lifetime and fee vs payload.
  - Lifetime has no slider.
- **S5: /pulse differs from design/05:**
  - With load generators included, there is one banner, not a warn chip by each affected number.
  - Cohort marks use "—" where the design has "·".
  - Under 768 px, tables stay tables (scroll inside a container) instead of becoming cards.
  - At 375 px the header nav pushes the sync indicator off-screen (shared header).
- **S6: e2e on `pnpm dev` is timing-sensitive** (see above). It's reliable on the production build, which the Playwright config uses by default.

Next owner: Orchestrator (S1 and S2 are quick coder fixes; S3 to S5 are design calls).
