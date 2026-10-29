# T21 — Full QA review of ArkivAgent (pre-publish)

- **Persona:** qa
- **Model tier:** fast
- **Depends on:** T20 (base: local main 94b12a5)
- **Workspace:** worktrees/arkiv-agent-qa-full, branch review/qa-full (from main)
- **Port:** 3102 (3101 is the owner's running app)

## Inputs
- Whole app at main: catalogue, dataset detail, Ask Arkiv, Pulse, Cost (incl. new USD price view, 70472ea), indexer, README fresh-clone run, ArkivAgent rename
- Prior QA reports T06, T12, T15, T17 (re-check that earlier fixes still hold)

## Milestones
- [x] fresh-clone run per README (keyless) + full test suite, build, prod e2e x3
- [x] every page and flow, including 375 px width and empty/no-key/no-price states
- [x] report

## Acceptance criteria
- [x] severity-rated findings in Handoff with repro steps; regressions vs earlier QA called out
- [x] USD view checked: price source fallback, no-price state, figures consistent with GLM
- [x] use a read-only copy of the shared index (data/arkiv-agent.db is live under the owner's indexer); no app changes

## Progress log
- 2026-10-29T09:45Z claimed; worktree review/qa-full from local main d3b4fd7. Fresh clone in a scratch dir, keyless .env, DB = `sqlite3 .backup` of data/arkiv-agent.db, chmod 444.
- 2026-10-29T09:47Z install, typecheck, `pnpm test` 517/517, `pnpm build` OK. Prod e2e on PORT=3102: 2 of 3 full runs 11/11 (then 2 more green).
- 2026-10-29T10:00Z pages, flows, 375 px, USD/no-price/no-fee/no-index states, earlier-fix rechecks. Server stopped.

## Handoff
Branch review/qa-full (base d3b4fd7 = app 94b12a5). Report only; no app changes. Setup: fresh `git clone`, `cp .env.example .env` (no keys), read-only `.backup` snapshot of the shared index, production build on port 3102.

**Verdict: ready to publish after H1 (README) and M1. No high-severity runtime bugs. USD view is correct.**

### Passes
- install / typecheck / `pnpm test` 517/517 / `pnpm build`, all keyless. `pnpm index:verify --attrs 10`: 10/10 names, types and values.
- Prod e2e (`PORT=3102 pnpm test:e2e`): runs 11/11, 11/11, 10/11 (cost, see L3), then 11/11 twice.
- Every page renders keyless: /catalogue, /catalogue/[id], /ask, /pulse, /cost. /catalogue/zzz is 404. Bad params (`ownership=banana`, `period=13`, `load=banana`, `writes=1e23&payload=-1&lifetime=abc`) fall back to defaults with no NaN. Empty search shows "No datasets match" with Clear filters and Ask links.
- At 375 px: no horizontal scroll on catalogue, ask, pulse or cost. Ask works end to end on mobile.
- Security rechecks: cross-origin POST /api/ask is 403, text/plain is 415, foreign Host header is 421.
- **USD view (70472ea):**
  - Figures match GLM × price. Calculator: 4.716 GLM × $0.10701 = $0.50; range $0.44 to $0.53; per write $0.0000168. Spend: 11.11 GLM gives $1.19; bhaiyaplease 1.266 GLM gives $0.14.
  - Fallback is live-tested with a fetch stub: CoinGecko blocked gives "Binance GLM/USDT" $0.1071. Both blocked gives "No GLM price source answered, so amounts are shown in GLM only." The USD column and ≈ lines are hidden, and the copy-estimate summary drops USD.
  - The no-fee state (TxFee empty) says "Not enough observed fees… Run pnpm fees". Pulse's GLM tile reads "needs sampled fees (pnpm fees)".
- Earlier fixes still hold:
  - T06: F1, F2 and F3 (Pune, exp_ok=false). F5 (port refusal). F7 (verify checks values).
  - T12: S1 (no false "Synced 0 s ago"; the server renders "Checking sync"). S3 (out-of-range payload widens the range).
  - T15: R1 (x>10 AND y<3), R2, R3 (catch-all refused), R6 (stale vs offline).
  - T17: N2 ("not between" is now `<1000 OR >5000`), N3 (Purulia binds jalsaakshya/v1 obs). N1 is partly fixed, see M1.

### Findings
- **H1 high (publish blocker, docs): the README feature table says Pulse and Cost are "Planned".** README.md:38 still reads "Ecosystem pulse, cost view | Planned (specs in design/05…, design/06…)", but both are built and in the nav. The README also never mentions `pnpm fees`, which /cost and Pulse's GLM tile need on a fresh clone, or the new USD view and its outbound calls to CoinGecko and Binance. The README says "No keys" and "Read-only", which is true, but it doesn't say the server calls third-party price APIs.
- **M1 medium (N1 not fully fixed): every dataset grouped by schema shape is unqueryable.** 81 of 751 datasets (2,060 live records) are named by attribute shape (nameSource "schema"). Their base query is `project = … AND EXISTS(a) AND EXISTS(b)`, and the RPC rejects it. Repro: Ask "nazar-in-batch-alerts alerts". /api/ask/run returns `Query rejected (type, -32002): Requested resource not available`. Explicit comparisons no longer fall back to EXISTS ("x at most ten" gives `x <= 10` and runs). But these datasets' detail pages ship SDK code with `exists("alert_ym")` and a Data Explorer link with `EXISTS(...)`, so both hit the same RPC failure (e.g. /catalogue/3df6b51781a4).
- **M2 medium: with no index, every page returns a 500 with a blank body.** Repro: `DATABASE_URL=file:./missing.db pnpm start` gives 500 on /catalogue, /ask, /pulse and /cost (Prisma P2021, table missing). It also creates an empty DB file. This happens to a README user who starts `pnpm dev` before the first `pnpm index` finishes migrating. Expected: an "index not built yet, run pnpm index" page.
- **M3 medium: a slow price API blocks /cost.** glm-price.ts says "pages never wait on it", but cost/page.tsx awaits `glmPrice()`. On a cache miss with both sources hanging, the first /cost took **7.8 s** (with both refused, 4.8 s; normally 0.65 s). A failed lookup is cached for 60 s, so while the APIs are down, one request a minute pays this. Fix: render without USD and fill it in later, or use a lower total timeout.
- **L1 low: rename leftovers in user-visible text.** /pulse cohort source reads "Source: ArkivAgent index: …" (packages/pulse/src/aggregate.ts:142). Ask explanations say "values ArkivAgent has seen" / "ArkivAgent hasn't seen that value" (packages/ask/src/interpret.ts:596, 620). .env.example:14 says "ArkivAgent listens on 127.0.0.1".
- **L2 low: the dataset detail tab title is just "ArkivAgent".** /catalogue/473026c53192 has `<title>ArkivAgent</title>`. Other pages use "Name · ArkivAgent".
- **L3 low: e2e is still load-sensitive.** In 1 of 3 full runs the cost test failed on `errors toEqual([])`, so a pageerror fired. With `--repeat-each 4` (parallel load), pulse and catalogue URL-update asserts time out at 5 s. The cost test passed 15/15 when run alone. In the pane I also saw one React #418 (hydration text mismatch) on a cost/ask load, but I couldn't reproduce it in 36 scripted loads. The likely shared cause is time-dependent text, but I haven't confirmed it.
- **L4 low (S5 carry-over): on narrow screens the sync indicator is just "642s"** next to an amber dot. "index not updating" and "Retry" context are hidden below `sm`, and the nav wraps "Ask Arkiv" onto two lines.

Not covered: full `pnpm index` from block 1 (~2 h), Claude path (no key, A01), a real-world price outage (stubbed instead).
Next owner: Orchestrator (H1 and L1 are quick doc/text fixes; M1 is for the coder, e.g. a label-free base query or listing such datasets as browse-only; M2 and M3 are small coder fixes).

