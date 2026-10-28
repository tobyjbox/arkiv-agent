# T03 — Indexer + change feed

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T01
- **Workspace:** worktrees/arkiv-agent-indexer, branch feat/indexer (created at release)
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [ ] Prisma schema
- [ ] backfill + incremental sync
- [ ] live/expired/deleted + fixtures
- [ ] watch mode + change feed

## Acceptance criteria
- [ ] index counts match chain; re-run safe
- [ ] pnpm index and pnpm index --watch work locally
- [ ] change feed (poll or SSE) the UI can subscribe to
- [ ] Vitest on recorded fixtures, no live-chain calls

## Progress log

## Handoff
