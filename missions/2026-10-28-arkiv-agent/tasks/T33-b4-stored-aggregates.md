# T33 — B4: indexer stores Insights and Financials results

- **Persona:** coder · **Model tier:** frontier · **Depends on:** T31
- **Workspace:** <worktrees>/arkiv-agent-b4, branch refactor/b4-aggregates (from local main)
- **Plan:** Part B, B4 (owner: do now)

## Acceptance criteria
- [ ] the indexer computes and stores the Insights (pulse) and Financials (cost) aggregates after each sync; fee model refitted when new fee samples arrive; pages only read stored results
- [ ] page response time independent of index size (measure before/after); numbers match current output
- [ ] safe with the owner's running indexer: schema change via migration with a documented restart step if needed
- [ ] tests, build, prod e2e pass; don't push. Runs in parallel with T32 (different packages)

## Progress log

## Handoff
