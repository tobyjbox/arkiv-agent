# T34 — B5 + B6: thin pages, price source in cost package, remove spike code

- **Persona:** coder · **Model tier:** fast · **Depends on:** T32, T33
- **Workspace:** <worktrees>/arkiv-agent-b5, branch refactor/b5-b6 (from local main)
- **Plan:** Part B, B5 and B6

## Acceptance criteria
- [x] B5: chart geometry out of page files into components; GLM spot price and history move from apps/arkiv-agent/lib into @arkiv-agent/cost behind a PriceSource interface (CoinGecko, Binance), tested there
- [x] B6: packages/indexer/src/spike and the spike:* scripts deleted (findings stay in arkiv/friction.md and T01)
- [x] behaviour unchanged; tests, build, prod e2e pass; don't push

## Progress log
- 2026-10-29T17:08Z claimed; worktree <worktrees>/arkiv-agent-b5, branch refactor/b5-b6 from local main 9286606. DB and candle store: `.backup` copies.
  - Saved the rendered `<main>` of /financials and other pages from the unchanged build:
    - prices on: the first request, whose price comes from the stored close, so it is deterministic;
    - prices off: both /financials variants and the /api/glm-history answers.
- 2026-10-29T17:15Z change (498ae65).
  - Every saved page and API answer is byte-identical after.
  - `pnpm test` 628/628, typecheck, build, prod e2e on 3114 21/21.
- 2026-10-29T17:15:34Z notify intent: T34 review candidate=498ae65 to Orchestrator local_<session> via ccd send_message; key 2026-10-28-arkiv-agent:T34@498ae65:review; attempt 1.

## Handoff
Branch refactor/b5-b6 (local only, not pushed), candidate 498ae65, base local main 9286606. One commit.

- **B5, charts out of pages.**
  - The Financials page drew the fee scatter itself (svg, log-scale geometry, band, fit line, caption) and the spend table's share bars. These now live in `components/cost/fee-scatter.tsx` and `components/cost/spend-table.tsx`.
  - No page file under apps/arkiv-agent/app has svg or chart geometry any more.
  - Insights already drew through components.
- **B5, GLM price lookup into `@arkiv-agent/cost`.** The new `packages/cost/src/price/` has:
  - `sources.ts`: the `PriceSource` interface (`name`, `spot()`, `candles()`), its implementations `coinGecko` and `binance`, the reply parsers, and the order each lookup tries them in. Spot: CoinGecko, then Binance. History: Binance, then CoinGecko. Both orders, the URLs and the source names are unchanged.
  - `spot.ts`: `fetchGlmPrice` and the cache that never makes a page wait (`priceCache`, `glmPrice`).
  - `history.ts`: candles, `historyCache`, `glmHistory`, `latestHistoryPrice`, and `glmPriceOrClose` (was the app's `financialsPrice`).
  - Both fetch functions take a list of sources, so any `PriceSource` can stand in.
  - apps/arkiv-agent/lib/glm-price.ts, glm-history.ts and financials-price.ts are gone. Their tests moved to packages/cost/test (price-spot, price-history), plus a new price-sources test that checks each source's URLs and parsing and that injected sources are tried in order.
  - `usd()` moved into the app's lib/glm.ts beside `glm()`, with a small test. The calculator is a client component, so it imports only types from cost.
- **B6, spike code.** packages/indexer/src/spike/ and the five `spike:*` scripts (root and indexer) are deleted.
  - `arkiv/friction.md` keeps every finding. Its intro now says the Phase 0 scripts were removed in T34, and that a **Steps** line names the script a finding came from.
  - The README layout row no longer lists the spike scripts.
  - Nothing else used the spike code. `PAGE_SIZE` and `allLive` in core are now used only by core's own test; I left them.
- **Behaviour unchanged.** Rendered pages and API answers are byte-identical before and after, with prices on and off.

Tests: `pnpm test` 628/628, typecheck clean, `pnpm build`, `PORT=3114 pnpm test:e2e` 21/21 (including the price chart tests).
Next owner: Orchestrator (review/merge). That completes Part B on my side.
