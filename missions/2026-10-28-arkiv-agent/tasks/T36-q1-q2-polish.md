# T36 — QA polish: chart range in URL, progress bar name

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T35 (base: local main b80823f)
- **Workspace:** worktrees/arkiv-agent-t36, branch fix/q1-q2 (from local main; never push)
- **Port:** 3115 (3101 is the owner's running app)

## Inputs
- T35 Handoff, findings Q1 and Q2

## Milestones
- [ ] Q1: the Financials price chart range (e.g. 7d/30d/90d) is kept in the URL like the page's other controls; reload and shared links restore it; default range keeps a clean URL
- [ ] Q2: the decode progressbar has an accessible name, linked to the visible "DECODING" label (aria-labelledby)

## Acceptance criteria
- [ ] tests for both; pnpm test, typecheck, build, prod e2e green
- [ ] no other changes

## Progress log

## Handoff
