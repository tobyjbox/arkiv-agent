# T10 — Stretch: ecosystem pulse

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T08, T09
- **Workspace:** worktrees/arkiv-agent-pulse, branch feat/pulse
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] series
- [x] cohorts + retention
- [x] load-generator filter
- [x] UI

## Acceptance criteria
- [x] retention chart for Tiramisu-era cohorts (from 2026-10-01; PLAN amendment), per design/05-pulse.md; works with no keys (A01: AI weekly summary behind the key)

## Progress log
- 2026-10-29T02:34:55Z Claimed and in-progress (653b14f, 138c4e6).
- 2026-10-29T02:38:20Z Increment 1 (4856add): pulse data from the index. Daily writes (creates + patches), active
  wallets, labelled projects, new projects, previous-period totals, most active, retention cohorts; load generators
  excluded unless asked. Unit tests for windows, closed-window retention, exclusion and missing days. First build
  ~2 s, then cached (30 s).
- 2026-10-29T02:41:58Z Increment 2, candidate f443c0e: /pulse per design/05, nav link, Playwright smoke (10 pass).
  Checked at 1280 and 375 px (no sideways scroll). Vitest 505.
- 2026-10-29T02:42:21Z Flipped to review, candidate f443c0e. Notification intent: key `2026-10-28-arkiv-agent:T10@f443c0e:review`; recipient Orchestrator thread local_<session>; route Claude Code SendMessage; send once.

## Handoff

**Candidate:** `f443c0e` on `feat/pulse` (worktree `worktrees/arkiv-agent-pulse`). Not merged.
Two increments: data (4856add), then page (f443c0e). Either can be reviewed alone.

**What's there**
- `packages/pulse`:
  - Activity per UTC day and wallet across all of Tiramisu (creates by creator, updates by owner), with block
    times from the last sync (2 s blocks; block 0 is about 1 Oct). Cached 30 s.
  - Wallets map to projects through the catalogue: a wallet counts for the label on most of its decoded records.
  - Load generators (the catalogue's set: over 5,000 creates in 7 days) are left out unless the toggle is off.
- `/pulse`:
  - Period 7/30/90 d and "Exclude load generators" (on by default, always visible), both in the URL.
  - Four tiles with change against the previous period: active wallets, active projects, writes, new projects.
  - Retention: D7 is days 7–13, D14 days 14–29, D30 days 30–59. Counted only over projects whose window has
    closed, with hatched "in N d" bars until a window closes. A cohort selector, and per-project ✓/✗/– marks.
  - Daily activity, one series at a time, with a "Before Tiramisu" band, today drawn as partial, and a data table.
  - Most active projects, with sparklines, active days, datasets and last write.
  - Refreshes when the index changes (at most every 30 s).

**Deviations (flagged)**
- **No hackathon cohorts.** The repo has no list of event projects (e.g. Global Tour Stop), and I didn't invent
  one. Retention uses cohorts derived from data instead: labelled projects grouped by the week of their first write
  on Tiramisu, which matches the Tiramisu-era amendment. An event registry, `packages/pulse/src/event-cohorts.json`
  (`{id, label, day, source, projects}`, scored from the event day), is empty until someone supplies a public,
  cited list. The page says so.
- **No "GLM spent" tile.** The index has no fee data, and the cost view (T11) isn't built.
- **No weekly AI summary.** Only the design's no-key line ("No weekly summary yet."). Generating summaries behind
  ANTHROPIC_API_KEY isn't built.
- **Simplified chart interaction.** Hover tooltips per point, with no crosshair or arrow-key navigation (the data
  table is the text equivalent). No "compare cohorts" overlay, and no cohort tag in the table.
- "Active projects" counts labelled projects only (117 in 30 d), matching the catalogue. Wallets without a label are
  counted under "Active wallets" and appear in the table as addresses.

**How to verify**
- `pnpm test` (Vitest 505). Then, with 3101 free, `pnpm build && pnpm test:e2e` (Playwright 10).
- Open /pulse; toggle the load generators (writes go from ~97k to ~1.67M in 30 d); switch the period and the cohort.
