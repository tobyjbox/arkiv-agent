# T31 — B2: shared projects module (wallet attribution, load generators)

- **Persona:** coder · **Model tier:** fast · **Depends on:** T30
- **Workspace:** <worktrees>/arkiv-agent-b2, branch refactor/b2-projects (from local main)
- **Plan:** Part B, B2

## Acceptance criteria
- [ ] new @arkiv-agent/projects holds wallet-to-project assignment and load-generator detection; cost and pulse depend on it, not on each other or on catalogue for these
- [ ] no dependency between pulse and cost; each depends only on db, projects, core
- [ ] behaviour unchanged; tests, build, prod e2e pass; don't push

## Progress log

## Handoff
