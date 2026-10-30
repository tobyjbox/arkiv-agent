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
- [x] Table sits in a bounded pane (height fits the viewport below tiles/filters, sensible min height) with its own vertical scroll; header row sticky inside the pane; page itself no longer grows with row count
- [x] Live updates, filters, search, sort and row links unchanged; keyboard scroll/focus works; 375 px usable (no horizontal page scroll)
- [x] e2e: page height stays bounded with many rows; pane scrolls; header stays visible

## Acceptance criteria
- [ ] pnpm test, typecheck, build, prod e2e green
- [ ] refresh docs/screenshots/catalogue.png if the view changes visibly
- [ ] no session IDs (local_*) in task files or commits; use <session>

## Progress log
- 2026-10-30T11:00:39Z coder: all three milestones done on feat/catalogue-pane, candidate c6eb017. Page height at 1280 x 800 with 752 rows: 49,637 px on the owner's 3101 app (main, read-only page load), 1,408 px on this build (3118). Checks: pnpm test 637/637, typecheck, build, prod e2e 29/29 three of three on 3118.
- 2026-10-30T11:00:39Z notify intent: T02 review, candidate c6eb017, to the verified Orchestrator <session> (ak-orch.sh thread arkiv-agent) via ccd send_message; one attempt.

## Handoff
**Candidate:** c6eb017b82b4b538f7591ded61f6e81acbb7520a on `feat/catalogue-pane` (worktree ~/dev/worktrees/arkiv-agent-catalogue-pane, base main 1a30903, which includes T01). Not pushed.

**What changed**
- `components/catalogue/catalogue-view.tsx`: the table sits in a scroll pane, a focusable region named "Datasets".
  - Max height is `max(20rem, 100dvh - 7rem)`: one screen below the sticky top bar, never under 20rem. Short filtered lists shrink to fit.
  - The header cells are sticky inside the pane, with an inset bottom line instead of a row border, which doesn't stick with border-collapse.
  - The "N updates · Show" bar sits above the pane instead of inside it.
- `components/catalogue/use-live-rows.ts`: live updates are held while the pointer or focus is in the pane, or the pane is scrolled.
  - The old check was `window.scrollY > offsetTop`; it would have read the pane's offset inside its new frame and held updates on any page scroll.
  - Show now scrolls the pane to the top.
- `e2e/catalogue.e2e.ts`, two new tests:
  - 1280 x 800: the pane needs scrolling, the page stays under 2 screens, the header stays put while the pane scrolls to the last row, End scrolls the focused pane, and a row link opens the dataset.
  - 375 px: the pane scrolls sideways inside itself, with no page scroll.

**How to verify:** `pnpm test`, `pnpm typecheck`, `pnpm build`, then in apps/arkiv-agent `PORT=3118 pnpm exec playwright test`. Open /catalogue and scroll down: the list pane fills the screen under the top bar and scrolls on its own, with the header row fixed.

**Deviations, flagged**
1. **docs/screenshots/catalogue.png not refreshed:** from the top of the page the view is unchanged, because the pane runs past the fold just as the long table did. Checked at 1280 x 800 on 3118.
2. **Live-update hold rule changed** (pane scrolled instead of page scrolled past the list). This is needed so rows don't move under a reader in the pane.
