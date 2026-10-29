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
- [ ] model
- [ ] calculator
- [ ] UI

## Acceptance criteria
- [ ] calculator within its stated error of observed fees

## Progress log
- 2026-10-29T02:46:00Z Claimed and in-progress (fac4b42, 0603427).
- 2026-10-29T02:52:00Z Fee ingestion (8614013): TxFee table + migration 20261029030000_tx_fees; `pnpm fees [--limit N]` samples
  receipts (90/10 real/load-generator creates, plus 10% update-only), re-runnable. Applying the migration needed a brief
  restart of the shared watch indexer (Prisma's migrate can't wait on the indexer's write lock; the indexer applies
  pending migrations itself at start). Indexer now runs from this worktree. First sample of 1,500 running at 3 req/s.
  Plan: packages/cost: gas ~ a + b*calldata (all txs), per-write calldata ~ c0 + c1*payload (single-create txs),
  median gas price, range = holdout quantiles of observed/predicted fee (coverage reported), lifetime effect checked;
  /cost: calculator (URL state, range always shown, breakdown, fiat off), estimated spend per project, model chart.

## Handoff
