# T23 — C1: quick fixes from T21/T22

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T21, T22
- **Workspace:** <worktrees>/arkiv-agent-c1, branch feat/c1-quick-fixes (from local main)
- **Port:** 3103
- **Plan:** docs/plan-rename-architecture.md, Part C

## Milestones
- [ ] fixes
- [ ] self-review

## Acceptance criteria
- [ ] QA H1: README feature table shows Pulse and Cost as built; documents `pnpm fees`, the USD view and its outbound price calls (CoinGecko, Binance)
- [ ] Security L1: `postcss>=8.5.23` override; `pnpm audit` clean of the postcss findings
- [ ] Security L2: heavy-page guard also checks `Sec-Fetch-Site`/`Sec-Fetch-Mode`; followed links still work
- [ ] QA L2: dataset detail title "<dataset> · ArkivAgent"
- [ ] QA L4: narrow sync indicator keeps its state text; nav doesn't wrap at 375 px
- [ ] tests, build, prod e2e pass. Do NOT rename "arkiv-agent" (Part A does that); do not push

## Progress log

## Handoff
