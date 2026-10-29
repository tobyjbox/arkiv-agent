# T35 — QA re-check after rename and architecture (pre-publish)

- **Persona:** qa
- **Model tier:** fast
- **Depends on:** T34 (base: local main 151cffc)
- **Workspace:** worktrees/arkiv-agent-qa-recheck, branch review/qa-recheck (from local main; never push)
- **Port:** 3102 (3101 is the owner's running app)

## Inputs
- Whole app at main after T23–T34: C1/C2 fixes, rename to arkiv-agent, decode progress bar, GLM price chart, Insights/Financials renames and redirects, Ask Arkiv Experimental note, footer links, (i) popover, LICENSE, db/projects packages, Ask pipeline, stored aggregates, PriceSource
- T21 report (re-check every finding is fixed and earlier fixes still hold)

## Milestones
- [ ] fresh-clone run per README (keyless) + full test suite, build, prod e2e x3
- [ ] every page and flow, incl. 375 px, no-key/no-price/no-index/aggregates-pending states, /pulse and /cost redirects
- [ ] report

## Acceptance criteria
- [ ] severity-rated findings in Handoff with repro steps; regressions vs T21 called out
- [ ] `git grep -i arkiv-agent` (excl. lockfile, docs/plan-rename-architecture.md, mission history) clean; no personal paths in tracked files
- [ ] read-only `.backup` copy of data/arkiv-agent.db; no app changes

## Progress log

## Handoff
