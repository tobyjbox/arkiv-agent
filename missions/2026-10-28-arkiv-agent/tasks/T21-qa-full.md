# T21 — Full QA review of ArkivAgent (pre-publish)

- **Persona:** qa
- **Model tier:** fast
- **Depends on:** T20 (base: local main 94b12a5)
- **Workspace:** worktrees/arkiv-agent-qa-full, branch review/qa-full (from main)
- **Port:** 3102 (3101 is the owner's running app)

## Inputs
- Whole app at main: catalogue, dataset detail, Ask Arkiv, Pulse, Cost (incl. new USD price view, 70472ea), indexer, README fresh-clone run, ArkivAgent rename
- Prior QA reports T06, T12, T15, T17 (re-check that earlier fixes still hold)

## Milestones
- [ ] fresh-clone run per README (keyless) + full test suite, build, prod e2e x3
- [ ] every page and flow, including 375 px width and empty/no-key/no-price states
- [ ] report

## Acceptance criteria
- [ ] severity-rated findings in Handoff with repro steps; regressions vs earlier QA called out
- [ ] USD view checked: price source fallback, no-price state, figures consistent with GLM
- [ ] use a read-only copy of the shared index (data/arkiv-agent.db is live under the owner's indexer); no app changes

## Progress log

## Handoff
