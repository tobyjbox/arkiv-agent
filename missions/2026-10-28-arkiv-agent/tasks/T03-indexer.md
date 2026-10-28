# T03 — Indexer + change feed

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T01
- **Workspace:** worktrees/arkiv-agent-indexer, branch feat/indexer (created at release)
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] Prisma schema
- [ ] backfill + incremental sync
- [x] live/expired/deleted + fixtures
- [ ] watch mode + change feed

## Acceptance criteria
- [ ] index counts match chain; re-run safe
- [ ] pnpm index and pnpm index --watch work locally
- [ ] change feed (poll or SSE) the UI can subscribe to
- [ ] Vitest on recorded fixtures, no live-chain calls

## Progress log
- 2026-10-28T17:43:22Z Claimed on feat/indexer (d4dc1ce; branch board copy was stale, T03 showed draft while main's canonical row was ready), in-progress (30399eb). Schema, log replay, enrichment and 18 Vitest tests committed (5e15276). Node caps eth_getLogs at 20,000 results (not 5,000 blocks); reads now split on its retry hint. Full rebuild from genesis running.

## Handoff
