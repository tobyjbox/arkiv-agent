# T09 — Stretch: pulse + cost specs

- **Persona:** ux_designer
- **Model tier:** fast
- **Depends on:** T02
- **Workspace:** design/pulse-cost (created at release)
- **Port:** —

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] pulse screens
- [x] cost screens
- [x] states

## Acceptance criteria
- [ ] consistent with T02 system

## Progress log
- 2026-10-28T17:10:26Z claimed (6eeb77c); read docs/PLAN.md pulse and cost sections.
- 2026-10-28T17:10:26Z all 3 milestones reached: design/05-pulse.md, design/06-cost.md, README index updated.
- 2026-10-28T17:10:26Z -> review, candidate=f64c9adbef10e3e52a0448b1d00f0171d1dd5931. Notify intent: event=review, key=T09+f64c9ad+review, recipient=local_<session> (ak-orch.sh thread arkiv-agent), route=Claude Code session route send_message, attempt=pending.

## Handoff
- **What changed:** `design/05-pulse.md` (period and load-generator controls, weekly AI summary, stat tiles, hackathon retention D7/D14/D30 with cohort list, activity chart with event markers, most-active table, states, responsive); `design/06-cost.md` (calculator with number+log-slider inputs, mandatory error range, cost-driver breakdown, illustrative-only fiat toggle, observed spend, fee-vs-lifetime and fee-vs-payload scatter with model band, finding note, states, responsive); `design/README.md` index rows.
- **Branch:** `design/pulse-cost` (worktree worktrees/arkiv-agent-pulse-cost). No app code.
- **Consistency with T02:** reuses 01 tokens and series order, 02 patterns (sync indicator, number roll, streaming), 03 stat tile, row, AI card and error panel components. No new tokens added.
- **How to verify:** read 05 and 06; each component references the T02 file/pattern it reuses.
- **Deviations / flags:**
  - Fiat is off by default with a user-editable assumed price, never a fetched market price (PLAN says testnet GLM has no price).
  - Unfinished retention windows are drawn hatched with "in N days", not as low values.
  - Cost model formula in 06 (fee ≈ a + b·bytes + c·lifetime) is illustrative; the real form depends on T01/T11 findings.
  - The board copy on this branch showed T09 `draft` (branch cut from integration); claimed from main's `ready`.
