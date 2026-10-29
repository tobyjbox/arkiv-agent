# T02 — Insights chart: 'Before Tiramisu' label overlaps peak value label

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** — (base: main f373489 or later)
- **Workspace:** ~/dev/worktrees/arkiv-agent-t02, branch fix/insights-label-overlap (from main; never push)
- **Port:** 3116 (3101 is the owner's running app; don't stop it)

## Inputs
- Your T01 note: on /insights "Activity over time", the "Before Tiramisu (2026-10-01)" region label overlaps the "25,282" peak label (see docs/screenshots/insights.png).

## Milestones
- [ ] Fix the overlap so both labels are readable at 1280 px and 375 px, for every tab (Writes, Active wallets, Active projects, New projects) and range; re-take docs/screenshots/insights.png from the 3101 app after the fix lands in your build check (same 1280 px dark settings)

## Acceptance criteria
- [ ] test or e2e covering the label placement; pnpm test, typecheck, build, prod e2e green
- [ ] no other behaviour changes

## Progress log

## Handoff
