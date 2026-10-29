# T11 — Stretch: cost view

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T10
- **Workspace:** worktrees/arkiv-agent-cost, branch feat/cost
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] fee ingestion
- [x] model
- [x] calculator
- [x] UI

## Acceptance criteria
- [x] calculator within its stated error of observed fees (232 of 254 held-out fees, 91%, inside the stated range)

## Progress log
- 2026-10-29T02:44:13Z Claimed and in-progress (fac4b42, 0603427).
- 2026-10-29T02:46:08Z Fee ingestion (8614013): TxFee table + migration 20261029030000_tx_fees; `pnpm fees [--limit N]` samples
  receipts (90/10 real/load-generator creates, plus 10% update-only), re-runnable. Applying the migration needed a brief
  restart of the shared watch indexer (Prisma's migrate can't wait on the indexer's write lock; the indexer applies
  pending migrations itself at start). Indexer now runs from this worktree. First sample of 1,500 running at 3 req/s.
  Plan: packages/cost: gas ~ a + b*calldata (all txs), per-write calldata ~ c0 + c1*payload (single-create txs),
  median gas price, range = holdout quantiles of observed/predicted fee (coverage reported), lifetime effect checked;
  /cost: calculator (URL state, range always shown, breakdown, fiat off), estimated spend per project, model chart.
- 2026-10-29T02:50:31Z Model (9603e07) and page (cd71f52). On the first 296 receipts: gas = 17,075 + 45.9 x calldata (R2 0.97),
  calldata = 2,148 + 0.98 x payload (R2 0.996), 1 gwei; band 0.85-1.03x with 50/54 (93%) held-out creates inside; lifetime
  explains 7% of the residual over 0-365 days. /cost: calculator (1,000 writes/day x 200 B = 3.753 GLM / 30 d, range 3.185-3.854),
  estimated spend (30 d, load generators excluded: 12.65 GLM), model chart; pulse GLM tile. Vitest 509, Playwright 11.
  Waiting for the 1,500-receipt sample to finish before the handoff numbers.
- 2026-10-29T02:55:27Z Sample complete (1,500 stored, 0 failed); final model and coverage in the Handoff. Flipped to review, candidate cd71f52. Notification intent: key `2026-10-28-arkiv-agent:T11@cd71f52:review`; recipient Orchestrator thread local_<session>; route Claude Code SendMessage; send once.

## Handoff

**Candidate:** `cd71f52` on `feat/cost` (worktree `worktrees/arkiv-agent-cost`). Not merged. Increments: ingestion
(8614013), model (9603e07), page (cd71f52). Paused once for T18 at a clean commit (5b4f434); this handoff resumes it.

**Fee data:** `pnpm fees --limit 1500` stored 1,500 receipts with 0 failures: 90% of creates from real projects,
10% from load generators, plus some update-only transactions. TxFee is in the shared index. Re-runs add new
samples and skip known transactions.

**Model (fitted on the 1,500):**
- gas = 18,933 + 45.07 × calldata bytes (R² 0.97, 1,246 transactions).
- calldata = 2,084 + 0.99 × payload bytes (R² 0.99, 1,018 single-record creates).
- Median price 1 gwei.
- Range: observed fees are 0.86× to 1.06× the estimate. **Acceptance:** 232 of 254 held-out single-record creates
  (91%) fall inside the stated range.
- Lifetime explains 3% of the residual over 0–400 days (976 creates), so lifetime still doesn't change the fee.
- The intercept and slope differ from T01's spike fit (66,110 + 20.95 × calldata, 240 create-only transactions from
  6 senders). This fit covers more senders and transaction shapes; the page states its own.

**Page:**
- `/cost` calculator: a 1,000 writes/day × 200 B app is ~3.75 GLM per 30 days. About 77% of each write's fee is
  encoding and attributes, not payload.
- Estimated spend, last 30 days, load generators excluded: 11.0 GLM (9.5–11.7), with a per-project table.
- The model chart shows the formula, the fit, the held-out coverage and the lifetime finding.
- Pulse has a "GLM spent (est.)" tile.
- Fiat is off by default and labelled "illustrative"; ArkivAgent never fetches a price.

**Deviations:**
- Spend is estimated (model × each write's payload), not summed from receipts: exact fees would need one receipt
  per transaction (~1.6M). The page says so, with the range.
- Applying the TxFee migration needed a brief restart of the shared watch indexer (Prisma's migrate can't wait on
  its write lock). It now runs from this worktree.
- Lifetime is an input but doesn't change the estimate today. The calculator says so.

**Verify:** `pnpm test` (509), `pnpm build && pnpm test:e2e` with 3101 free (11), `pnpm fees --limit 100` (re-run safe).
