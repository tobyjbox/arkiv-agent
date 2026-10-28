# T02 — Visual system + catalogue and Ask Arkiv screen specs

- **Persona:** ux_designer
- **Model tier:** fast
- **Depends on:** —
- **Workspace:** worktrees/arkiv-agent-visual-system, branch design/visual-system; deliverables in design/ (no app code)
- **Port:** —

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] visual direction (dark palette, type, motion)
- [x] 'feels live' patterns
- [x] catalogue screens
- [x] Ask Arkiv screens

## Acceptance criteria
- [ ] dark-mode-only design tokens (colour, type, spacing, radius, motion) Coder can lift into code
- [ ] 'feels fast' patterns specified: skeletons, streamed/optimistic rendering, live counters, 'synced N s ago' pulse, update transitions
- [ ] /catalogue, /catalogue/[id], Ask Arkiv screens incl. empty, loading, error states
- [ ] visually stunning per the owner's direction (BRIEF.md); rationale short

## Progress log
- 2026-10-28T17:07:37Z claimed (a22acd1); read BRIEF, PLAN, docs/PLAN.md.
- 2026-10-28T17:07:37Z all 4 milestones reached: design/01..04 + README written; palette contrast checked against WCAG 2.1 AA.

## Handoff
- **What changed:** new `design/` folder: `README.md` (index + rationale), `01-visual-system.md` (dark tokens: colour, type, spacing, radius, elevation, motion, icons, a11y baseline), `02-feels-live.md` (sync indicator, skeletons, number roll, row transitions, streaming/optimistic UI, announcements, freshness), `03-catalogue.md` (app shell, /catalogue, /catalogue/[id], all states, responsive), `04-ask-arkiv.md` (flow, interpretation chips, result tabs, all states, responsive).
- **Branch:** `design/visual-system` (worktree worktrees/arkiv-agent-visual-system). No app code.
- **How to verify:** read design/README.md, then check each acceptance criterion against the file named in its row of the index. Contrast ratios are stated in 01 next to each token (computed with the WCAG relative-luminance formula).
- **Deviations / flags:**
  - Tokens are specified as tables (hex, px, ms, easing), not as a theme file: the UX persona does not write code. Coder lifts them.
  - Update transport (5 s poll vs SSE) and the indexer-lag threshold are left to Coder after T01/T03.
  - Footer copy "Not affiliated with Golem" is a suggestion; the owner may want other wording.
  - Policy choice: "feels live" never extrapolates or fakes numbers (honest-speed rule in 02). If the owner wants simulated motion, that is a spec change.
