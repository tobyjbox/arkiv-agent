# T34 — B5 + B6: thin pages, price source in cost package, remove spike code

- **Persona:** coder · **Model tier:** fast · **Depends on:** T32, T33
- **Workspace:** <worktrees>/arkiv-agent-b5, branch refactor/b5-b6 (from local main)
- **Plan:** Part B, B5 and B6

## Acceptance criteria
- [ ] B5: chart geometry out of page files into components; GLM spot price and history move from apps/arkiv-agent/lib into @arkiv-agent/cost behind a PriceSource interface (CoinGecko, Binance), tested there
- [ ] B6: packages/indexer/src/spike and the spike:* scripts deleted (findings stay in arkiv/friction.md and T01)
- [ ] behaviour unchanged; tests, build, prod e2e pass; don't push

## Progress log

## Handoff
