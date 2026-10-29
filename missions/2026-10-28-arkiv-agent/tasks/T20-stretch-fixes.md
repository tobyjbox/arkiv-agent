# T20 — Fix T12 QA + T19 security findings (stretch)

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T12, T19
- **Workspace:** worktrees/arkiv-agent-stretch-fixes, branch feat/stretch-fixes (from mission/2026-10-28-arkiv-agent)
- **Port:** 3101

## Inputs
- tasks/T12-review-stretch.md Handoff (S1-S6), tasks/T19-security-stretch.md (L1)

## Milestones
- [ ] S1, S2, S3, L1
- [ ] self-review

## Acceptance criteria
- [ ] S1: SSR sync label doesn't claim "Synced 0 s ago" before hydration (neutral placeholder or real server-side age)
- [ ] S2: cost hold-out split deterministic (ORDER BY), coverage reproducible across runs; report the new figure
- [ ] S3: out-of-range payload widens the shown range (or clearly states extrapolation), not just a warning
- [ ] L1: cross-site requests can't trigger pulse/cost aggregation (same origin guard as /api/ask)
- [ ] all tests pass; prod e2e green
- Out of scope (orchestrator call): S4/S5 design gaps recorded as known gaps in README; S6 dev-mode timing documented only

## Progress log

## Handoff
