# T25 — UX: decoding banner -> futuristic progress bar

- **Persona:** ux_designer
- **Model tier:** fast
- **Depends on:** —
- **Workspace:** <worktrees>/arkiv-agent-decode-ux, branch design/decode-progress (from local main)
- **Owner request (2026-10-29):** the catalogue's amber banner "792 of 37,288 live records are still being decoded, so their datasets are not listed yet. They appear as the indexer catches up." should become a futuristic progress bar.

## Inputs
- apps/arkiv-agent/components/catalogue/catalogue-view.tsx (the banner); design/01-visual-system.md, 02-feels-live.md, 03-catalogue.md

## Milestones
- [x] spec
- [x] handoff

## Acceptance criteria
- [ ] spec (design/07-decode-progress.md, linked from design/README.md) for a progress bar that feels live and futuristic within the existing visual system: states (decoding, caught up/hidden, stalled, indexer offline, first run with 0 decoded), numbers shown (decoded/total, %, rate or ETA if derivable), motion with prefers-reduced-motion fallback, 375 px layout, accessibility (role=progressbar, aria values, live-region cadence)
- [ ] states which data the bar needs and whether it already exists (live feed / sync state), so the coder task is clear
- [ ] spec only; no app code. Do not push. Don't rename "arkiv-agent" (separate task)

## Progress log
- 2026-10-29T11:06:12Z claimed (89d064b, local only); read catalogue-view.tsx banner, load.ts summary counts, db/src/feed.ts, live-provider and use-live-rows.
- 2026-10-29T11:06:12Z spec written: design/07-decode-progress.md, linked from design/README.md.

## Handoff
- **What changed:** `design/07-decode-progress.md` (new), `design/README.md` (index row). Spec only, no app code.
- **Branch:** `design/decode-progress` (worktree <worktrees>/arkiv-agent-decode-ux), from local main 9709a66. **Not pushed** (per task).
- **How to verify:** check each acceptance criterion against its section in 07: States table (decoding, keeping pace, nearly done, caught up/hidden, stalled, indexer offline, first run with 0 decoded), Numbers (decoded/total, %, rate, ETA rules), Motion (with reduced-motion column), 375 px layout, Accessibility (progressbar role, aria values, live-region cadence), and "Data needed, and whether it exists".
- **Data summary for Coder:** everything needed exists (`summary.undecodedLive`, `summary.liveRecords`, `summary.indexedBlock`, `useLive()` sync state); rate/ETA/stalled are derived client-side from recent samples. Optional backend change: add `undecodedLive` to `FeedResponse` if the bar lags between feed moves.
- **Deviations / flags:**
  - Added two states beyond the list (Keeping pace, Nearly done) and a "Total unknown" rule that defers to the existing index-building state.
  - Bar is neutral (not amber): decoding is normal work. Amber only for Stalled.
  - Delayed sync does not change the bar, to avoid a second warning for one cause.
  - Did not view the running app at :3101; spec is based on the code and T02 specs.
