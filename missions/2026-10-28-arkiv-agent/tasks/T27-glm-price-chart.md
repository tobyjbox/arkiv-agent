# T27 — GLM/USDT price chart on /cost

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T24 (M3 changes the price code), T26 order: after T24
- **Workspace:** <worktrees>/arkiv-agent-price-chart, branch feat/glm-price-chart (from local main)
- **Port:** 3106
- **Owner request (2026-10-29):** add a GLM/USDT price graph somewhere on the Cost tab.

## Acceptance criteria
- [ ] small chart near the USD price note on /cost (or beside the calculator result): GLM in USD, 30 days default with 7/30/90 d toggle, current price + change %, source and time shown
- [ ] data from Binance klines GLMUSDT (1d / 4h) with CoinGecko market_chart fallback (both checked live 2026-10-29); same price module, cached, never blocks the page (render without the chart, fill it in later), behind the existing PriceSource shape
- [ ] chart follows design/01 tokens and the dataviz rules already used (sparkline, cost scatter); hover shows date + price; works at 375 px; accessible summary text
- [ ] no-price state: chart hidden with a one-line note
- [ ] unit tests for parsing/fallback; tests, build, prod e2e pass. Don't rename "arkiv-agent"; don't push

## Progress log

## Handoff
