# T02 — Insights chart: 'Before Tiramisu' label overlaps peak value label

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** — (base: main f373489 or later)
- **Workspace:** ~/dev/worktrees/arkiv-agent-t02, branch fix/insights-label-overlap (from main; never push)
- **Port:** 3116 (3101 is the owner's running app; don't stop it)

## Inputs
- Your T01 note: on /insights "Activity over time", the "Before Tiramisu (2026-10-01)" region label overlaps the "25,282" peak label (see docs/screenshots/insights.png).

## Milestones
- [x] Fix the overlap so both labels are readable at 1280 px and 375 px, for every tab (Writes, Active wallets, Active projects, New projects) and range; re-take docs/screenshots/insights.png from the 3101 app after the fix lands in your build check (same 1280 px dark settings)

## Acceptance criteria
- [ ] test or e2e covering the label placement; pnpm test, typecheck, build, prod e2e green
- [ ] no other behaviour changes

## Progress log
- 2026-10-29T21:02:37Z claimed; worktree ~/dev/worktrees/arkiv-agent-t02 on fix/insights-label-overlap from main 8a7f5c6; port 3116.
- 2026-10-29T21:07:35Z cause: band label centred at x(0)/2 on the top line, so a narrow band pushes it past the left edge and onto the max label. Fixed by moving it to the empty left axis slot. New e2e failed on the old build (3101, 30d, both widths), passes now. Candidate afb3d4f. 632/632, typecheck, build, prod e2e 24/24 x3 on 3116.

## Handoff
Branch fix/insights-label-overlap, candidate afb3d4faf5e2610057ae41afaffef14436a20803 (base main 8a7f5c6). Worktree ~/dev/worktrees/arkiv-agent-t02. Nothing pushed.

**Cause.** In components/pulse/activity.tsx the "Before Tiramisu (date)" label was centred at half the hatched band's width on the top line (y 14), while the max value label sits at the top left (x 4, y 22). With a narrow band (30d now has one day before Tiramisu) the centred label ran past the chart's left edge (clipped at 375 px, outside the drawing at 1280 px) and over the max label.

**Fix.** The label moved to the left axis slot under the chart (x 0, y H+14, start-anchored). That slot was already left empty whenever the band is drawn, so nothing else moves: the max label, the line, the end-date label and the band are unchanged, and the text and style are the same. Start-anchored at the edge it can't clip, and the end-date label is anchored at the far right, so the two can't meet (about 150 + 110 of 600 units).

**Tests.** e2e/insights.e2e.ts, two new tests (1280 and 375 px): for periods 7, 30 and 90 and all four series, every chart label lies inside the drawing and clear of every other, and the band label appears exactly when the period reaches back before the index's first day (read from the page's own caption, so the test doesn't depend on today's date). Before: run against the owner's 3101 app (main's unfixed build), both tests failed at 30d ("Before Tiramisu (2026-10-01)" outside the chart). After: pass.

**Checks.** pnpm test 632/632, typecheck, build, prod e2e `PORT=3116 pnpm test:e2e` 24/24 in three of three runs.

**Screenshot.** docs/screenshots/insights.png re-taken with T01's settings (1280 x 1215, 2x, dark, reduced motion), 468 KB.

**Deviations, flagged.**
- The task said to re-take it from the 3101 app; that app runs main without this fix, so the shot comes from this branch's build on 3116 against a `.backup` copy of the owner's DB (same data, a few minutes later). Re-take from 3101 after merge and restart if you want it byte-for-byte from the owner's app.
- The "before" e2e run used `E2E_REUSE_SERVER=1 PORT=3101` (read-only page loads on the owner's app; nothing restarted).

Next owner: Orchestrator (review and merge).
- 2026-10-29T21:07:38Z notify intent: T02 review candidate=afb3d4f to Orchestrator <session> via ccd send_message; attempt 1.
