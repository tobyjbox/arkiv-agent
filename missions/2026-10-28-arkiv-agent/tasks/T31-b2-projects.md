# T31 — B2: shared projects module (wallet attribution, load generators)

- **Persona:** coder · **Model tier:** fast · **Depends on:** T30
- **Workspace:** <worktrees>/arkiv-agent-b2, branch refactor/b2-projects (from local main)
- **Plan:** Part B, B2

## Acceptance criteria
- [x] new @arkiv-agent/projects holds wallet-to-project assignment and load-generator detection; cost and pulse depend on it, not on each other or on catalogue for these
- [x] no dependency between pulse and cost; each depends only on db, projects, core
- [x] behaviour unchanged; tests, build, prod e2e pass; don't push

## Progress log
- 2026-10-29T16:18Z claimed; worktree <worktrees>/arkiv-agent-b2, branch refactor/b2-projects from local main 960e227. DB: `.backup` copy. Took the page-value snapshot (catalogue, details, value lookup, pulse 7/30/90 d with and without load, fee model, spend 7/30 d with and without load, wallet projects, load wallets, datasets per project) from the unchanged code; checked it's deterministic.
- 2026-10-29T16:25Z refactor (2d91abc). Snapshot byte-identical after. `pnpm test` 553/553, typecheck, build, prod e2e on 3110 21/21.
- 2026-10-29T16:25:31Z notify intent: T31 review candidate=2d91abc to Orchestrator local_<session> via ccd send_message; key 2026-10-28-arkiv-agent:T31@2d91abc:review; attempt 1.

## Handoff
Branch refactor/b2-projects (local only, not pushed), candidate 2d91abc, base local main 960e227. One commit.

- **New `@arkiv-agent/projects`** (packages/projects):
  - `projectsByWallet()`: each wallet's project, moved from pulse. The logic is unchanged and now a pure `assignProjects(datasets, membersById)` with tests.
  - `datasetsByProject()`: datasets per project, excluding load generators, moved out of `getPulse` (pure `countDatasetsByProject`, tested).
  - `loadGeneratorOwners()`: moved from catalogue. It now returns the wallets lowercased, which both callers did themselves before.
- **Dependencies now:**
  - pulse → db, projects.
  - cost → db, projects.
  - projects → catalogue.
  - No pulse↔cost dependency. Neither pulse nor cost imports catalogue. Lockfile updated.
- **One design point to review:**
  - projects has to sit above catalogue: wallet projects and dataset counts come from the catalogue's build.
  - So the busy-owner rule itself (over 5,000 creates in 7 days, 5-minute cache) stays inside the catalogue build, which needs it to mark datasets as load generators.
  - The build now returns the set it used (`Loaded.busyOwners`) instead of a getter reaching into its cache. projects is the one place everything else reads it from.
  - Moving the rule into projects would make catalogue and projects depend on each other.
- Next config lists projects in `transpilePackages`; the README layout table has a row for it.
- **Behaviour unchanged.** The page-value snapshot is byte-identical before and after.

Tests: `pnpm test` 553/553 (4 new), typecheck clean, `pnpm build`, `PORT=3110 pnpm test:e2e` 21/21.
Next owner: Orchestrator (review/merge). Ready for T32/T33 when released.
