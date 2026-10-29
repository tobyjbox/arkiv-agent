# T24 — C2: code fixes from T21

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T21
- **Workspace:** <worktrees>/arkiv-agent-c2, branch feat/c2-code-fixes (from local main)
- **Port:** 3104
- **Plan:** docs/plan-rename-architecture.md, Part C

## Milestones
- [ ] M1
- [ ] M2, M3, L3
- [ ] self-review

## Acceptance criteria
- [ ] M1: datasets named by schema shape (81 of 751) are queryable via a base query the RPC accepts, or listed as browse-only with a reason; Ask, SDK snippet and Explorer link never emit EXISTS (verify live)
- [ ] M2: with no index, pages show "index not built yet, run pnpm index" (not a blank 500); starting the app doesn't create an empty DB file
- [ ] M3: /cost never waits on the price APIs; without a cached price it renders GLM-only and refreshes the price in the background
- [ ] L3: e2e waits on state, not timers; full suite green 3 runs in a row and under `--repeat-each 2`
- [ ] tests, build pass. Do NOT rename "arkiv-agent"; do not push

## Progress log

## Handoff
