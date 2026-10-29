# T30 — B1: @arkiv-agent/db owns all database access

- **Persona:** coder · **Model tier:** frontier · **Depends on:** T29
- **Workspace:** <worktrees>/arkiv-agent-b1, branch refactor/b1-db (from local main)
- **Plan:** docs/plan-rename-architecture.md, Part B, B1

## Acceptance criteria
- [ ] @arkiv-agent/db owns the read connection and typed query modules (entities, attributes, patches, fees, sync state, descriptions); catalogue, pulse and cost call them and contain no SQL
- [ ] only packages/db contains SQL (git grep for SELECT/INSERT outside packages/db is empty, tests aside)
- [ ] behaviour unchanged: same page output and numbers; tests, build, prod e2e pass; don't push

## Progress log

## Handoff
