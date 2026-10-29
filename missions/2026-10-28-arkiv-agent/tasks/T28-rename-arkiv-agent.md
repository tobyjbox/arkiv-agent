# T28 — Part A: remove "arkiv-agent" everywhere, use "arkiv-agent"

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T27
- **Workspace:** <worktrees>/arkiv-agent-rename, branch feat/rename-arkiv-agent (from local main)
- **Plan:** docs/plan-rename-architecture.md, Part A (table is the spec)

## Acceptance criteria
- [ ] every row of the Part A table done: apps/arkiv-agent -> apps/arkiv-agent; @arkiv-agent/* -> @arkiv-agent/*; app package name; root package name (arkiv-agent); ArkivClient/createArkivClient/ArkivAgentError/cache.arkivAgentPrisma; ARKIV_AGENT_* env vars -> ARKIV_AGENT_* (old names still read for one release, with a warning); data/arkiv-agent.db -> data/arkiv-agent.db with a one-time rename of an existing arkiv-agent.db (+ -wal/-shm) on startup by whichever process opens it first, safe while the owner's indexer runs (document a one-line manual step if a live rename is unsafe); mission folder missions/2026-10-28-arkiv-agent -> missions/2026-10-28-arkiv-agent and every path into it; docs, design, arkiv/, README
- [ ] `git grep -i arkiv-agent -- ':!pnpm-lock.yaml'` empty except quoted historical log lines (list any you keep); lockfile regenerated
- [ ] mechanical diff only, no behaviour changes mixed in; tests, build, prod e2e pass; fresh-clone README run works
- [ ] don't push. Git history is rewritten by the orchestrator later (not part of this task)

## Progress log

## Handoff
