# T35 — QA re-check after rename and architecture (pre-publish)

- **Persona:** qa
- **Model tier:** fast
- **Depends on:** T34 (base: local main 151cffc)
- **Workspace:** <worktrees>/arkiv-agent-qa-recheck, branch review/qa-recheck (from local main; never push)
- **Port:** 3102 (3101 is the owner's running app)

## Inputs
- Whole app at main after T23–T34: C1/C2 fixes, rename to arkiv-agent, decode progress bar, GLM price chart, Insights/Financials renames and redirects, Ask Arkiv Experimental note, footer links, (i) popover, LICENSE, db/projects packages, Ask pipeline, stored aggregates, PriceSource
- T21 report (re-check every finding is fixed and earlier fixes still hold)

## Milestones
- [x] fresh-clone run per README (keyless) + full test suite, build, prod e2e x3
- [x] every page and flow, incl. 375 px, no-key/no-price/no-index/aggregates-pending states, /pulse and /cost redirects
- [x] report

## Acceptance criteria
- [x] severity-rated findings in Handoff with repro steps; regressions vs T21 called out
- [x] `git grep -i arkiv-agent` (excl. lockfile, docs/plan-rename-architecture.md, mission history) clean; no personal paths in tracked files
- [x] read-only `.backup` copy of data/arkiv-agent.db; no app changes

## Progress log
- 2026-10-29T19:45Z claimed; worktree review/qa-recheck from local main d7453b1. Fresh clone in a scratch dir, keyless .env, DB = `sqlite3 .backup` of data/arkiv-agent.db, chmod 444.
- 2026-10-29T19:47Z install, typecheck, `pnpm test` 628/628, `pnpm build` OK; prod e2e PORT=3102 21/21 x3.
- 2026-10-29T19:55Z T21 re-check, states (hang/off/no-fee/aggregates-pending/no-index), redirects, 375 px sweep, new features. Server stopped.

## Handoff
Branch review/qa-recheck (base d7453b1 = app 151cffc). Report only; no app changes; nothing pushed. Setup: fresh `git clone`, `cp .env.example .env` (no keys), read-only `.backup` of data/arkiv-agent.db, production build on port 3102.

**Verdict: ready to publish. All T21 findings (H1, M1–M3, L1–L4) are fixed. No regressions. Two new low findings.**

### Passes
- install / typecheck / `pnpm test` 628/628 (45 files) / `pnpm build`, all keyless. Prod e2e `PORT=3102 pnpm test:e2e`: **21/21 in three of three runs.**
- `git grep -i arkiv-agent` (excluding pnpm-lock.yaml, docs/plan-rename-architecture.md and missions/) returns nothing. Tracked files outside missions/ contain no `/Users/`, `USER` or `/private/tmp` paths.
- Redirects: /pulse and /cost return 308 to /insights and /financials, keeping the query string (`/cost?writes=5000` goes to `/financials?writes=5000`). / is a 307 to /catalogue. /catalogue/zzz is 404.
- Scripted sweep at 375 and 1280 px, 3 loads each, 48 loads in all: catalogue, two dataset pages, ask, insights, financials, and bad-param URLs. **No horizontal overflow, no page errors, no console errors, no hydration errors.**
- New features:
  - The GLM price chart badge is correct: ▼ 14.3% over 30 d (0.1267 to 0.1086). 90 d gives ▲ 17.7%. The source line reads "Binance GLM/USDT, daily closes · now CoinGecko".
  - The decode bar shows 97.8%, which equals 36,466/37,270. Its (i) popover says "The indexer isn't running. Start pnpm index --watch…".
  - Ask shows the Experimental note.
  - Footer links go to Data explorer, Block explorer, Source and the MIT License (github.com/tobyjbox/arkiv-agent). LICENSE is present.
- States:
  - **Price APIs hanging** (fetch stub): /financials renders in 0.21 s, using the stored latest daily close. The chart shows "Loading GLM/USDT history…".
  - **`GLM_PRICE=off`**: "USD amounts are off (GLM_PRICE=off)…" and the chart is off. No price calls are made.
  - **Aggregates pending** (Aggregate and TxFee empty): Insights and Financials say "The indexer works these numbers out after it syncs… or run pnpm aggregates". The `pnpm aggregates` script exists and is in the README.
  - **No index**: every page returns 200 with "The index isn't built yet… pnpm index --watch". /api/changes returns 503. No empty DB file is created.

### T21 re-check
- **H1 fixed.** The README feature table lists Insights and Financials as Built (stretch) and links to Known gaps. It documents `pnpm fees`, `GLM_PRICE`, `ARKIV_FEE_RPS` and `pnpm aggregates`, and has an Outbound calls section for CoinGecko and Binance.
- **M1 fixed.** "nazar-in-batch-alerts alerts" now compiles to presence tests without EXISTS (`plant STARTSWITH str('') AND mfg_ym >= i32(-2147483648) AND …`) and runs: 50 rows. /catalogue/3df6b51781a4 has no `EXISTS` or `exists(` in its snippet or Explorer link.
- **M2 fixed** (no-index page, above). **M3 fixed** (no blocking on price, above).
- **L1 fixed** (arkiv-agent grep clean). **L2 fixed**: dataset tabs read "listed · ArkivAgent" and "alert_ym · batch · batch_raw · ArkivAgent". **L3**: e2e is now 3/3 green, and the sweep found no hydration errors. **L4 fixed**: at 375 px the header has two rows, with "Not updating · 6 min ago" fully visible.
- Earlier fixes still hold:
  - Ask: R1 (`x > 10 AND y < 3`, 24 rows), N2 (`<1000 OR >5000`), F1 (Pune applied; "hospitals" now listed as Not used), R3 (catch-all refused).

### New findings (low)
- **Q1 low: the price chart range isn't kept in the URL.** Clicking 90d updates the chart, but the URL keeps only the calculator params, so a reload or a shared link goes back to 30d. Every other control on the page keeps its state in the URL.
- **Q2 low: the decode progress bar has no accessible name.** `role=progressbar` has aria-valuenow and aria-valuemax but no aria-label or aria-labelledby, so screen readers announce a bare number. The visible "DECODING" label isn't linked to it.

Note, not a finding: opening the chmod 444 snapshot creates empty -shm/-wal files beside it. The DB itself is unchanged. The price candle cache is written to data/glm-prices.db in the checkout running the app.
Not covered: full `pnpm index` from block 1, the Claude path (no key), a real price outage (stubbed instead).
Next owner: Orchestrator (Q1 and Q2 are optional polish).

- 2026-10-29T19:52:46Z notify intent: T35 review candidate=6aaf187 to Orchestrator local_<session> via ccd send_message; attempt 1.
- 2026-10-29T19:52:54Z notify result: delivered (message_id <id>).
