# T02 — Catalogue: dataset table in its own scrolling pane

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** — (pick up after T01; base: main, current tip)
- **Workspace:** ~/dev/worktrees/arkiv-agent-catalogue-pane, branch feat/catalogue-pane (from main; never push)
- **Port:** 3118 (3101 is the owner's running app; don't stop it)

## Inputs
- Owner (A04): the /catalogue dataset table (752+ rows, live) grows the whole page without limit; it needs to be in a pane with its own scrollbar.
- design/03-catalogue.md

## Milestones
- [ ] Table sits in a bounded pane (height fits the viewport below tiles/filters, sensible min height) with its own vertical scroll; header row sticky inside the pane; page itself no longer grows with row count
- [ ] Live updates, filters, search, sort and row links unchanged; keyboard scroll/focus works; 375 px usable (no horizontal page scroll)
- [ ] e2e: page height stays bounded with many rows; pane scrolls; header stays visible

## Acceptance criteria
- [ ] pnpm test, typecheck, build, prod e2e green
- [ ] refresh docs/screenshots/catalogue.png if the view changes visibly
- [ ] no session IDs (local_*) in task files or commits; use <session>

## Progress log

## Handoff
