# T25 — UX: decoding banner -> futuristic progress bar

- **Persona:** ux_designer
- **Model tier:** fast
- **Depends on:** —
- **Workspace:** <worktrees>/arkiv-agent-decode-ux, branch design/decode-progress (from local main)
- **Owner request (2026-10-29):** the catalogue's amber banner "792 of 37,288 live records are still being decoded, so their datasets are not listed yet. They appear as the indexer catches up." should become a futuristic progress bar.

## Inputs
- apps/arkiv-agent/components/catalogue/catalogue-view.tsx (the banner); design/01-visual-system.md, 02-feels-live.md, 03-catalogue.md

## Milestones
- [ ] spec
- [ ] handoff

## Acceptance criteria
- [ ] spec (design/07-decode-progress.md, linked from design/README.md) for a progress bar that feels live and futuristic within the existing visual system: states (decoding, caught up/hidden, stalled, indexer offline, first run with 0 decoded), numbers shown (decoded/total, %, rate or ETA if derivable), motion with prefers-reduced-motion fallback, 375 px layout, accessibility (role=progressbar, aria values, live-region cadence)
- [ ] states which data the bar needs and whether it already exists (live feed / sync state), so the coder task is clear
- [ ] spec only; no app code. Do not push. Don't rename "arkiv-agent" (separate task)

## Progress log

## Handoff
