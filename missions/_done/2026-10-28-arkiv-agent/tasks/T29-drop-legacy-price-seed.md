# T29 — Drop pre-rename compatibility; seed spot price from chart history

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T28
- **Workspace:** <worktrees>/arkiv-agent-t29, branch feat/drop-legacy (from local main)

## Acceptance criteria
- [ ] the owner is the only user and has already migrated (data/arkiv-agent.db in place, launch config renamed), so remove the one-release compatibility: ARKIV_AGENT_* env fallbacks and warnings, the arkiv-agent.db move logic and its test, the legacy Ask history key, the ARKIV_AGENT_HOST shell fallback in package.json scripts
- [ ] `git grep -i arkiv-agent -- ':!pnpm-lock.yaml' ':!docs/plan-rename-architecture.md'` returns nothing
- [ ] Financials: when no live spot price is cached but the price history has a latest candle, use it (labelled with its source and time) so the USD figures and the chart never disagree; the live spot price replaces it when it arrives
- [ ] tests, build, prod e2e pass; don't push

## Progress log

## Handoff
