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
- [ ] calculator within its stated error of observed fees

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

## Handoff
