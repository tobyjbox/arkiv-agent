# T36 — QA polish: chart range in URL, progress bar name

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T35 (base: local main b80823f)
- **Workspace:** worktrees/arkiv-agent-t36, branch fix/q1-q2 (from local main; never push)
- **Port:** 3115 (3101 is the owner's running app)

## Inputs
- T35 Handoff, findings Q1 and Q2

## Milestones
- [x] Q1: the Financials price chart range (e.g. 7d/30d/90d) is kept in the URL like the page's other controls; reload and shared links restore it; default range keeps a clean URL
- [x] Q2: the decode progressbar has an accessible name, linked to the visible "DECODING" label (aria-labelledby)

## Acceptance criteria
- [ ] tests for both; pnpm test, typecheck, build, prod e2e green
- [ ] no other changes

## Progress log
- 2026-10-29T19:54:23Z claimed; worktree worktrees/arkiv-agent-t36 on fix/q1-q2 from local main 39e2a5e; port 3115.
- 2026-10-29T20:01:04Z Q1 done, Q2 found already met (no app change; test added). Candidate 7038622. pnpm test 632/632, typecheck, build, prod e2e 22/22 three of three on 3115.

## Handoff
Branch fix/q1-q2, candidate 70386228908f761744937fb9849eb8dcafb0d90b (base local main 39e2a5e). Worktree worktrees/arkiv-agent-t36. Nothing pushed.

**Q1 (fixed).** The price chart range is kept in the URL as `?range=7` or `?range=90`; 30 d, the default, adds no param (clicking 30d removes it). /financials reads it on the server, so a reload or a shared link renders that range straight away (no flash, and the first history request is for that range).
- `lib/price-range.ts`: the range list, `parseRange` (anything but 7, 30 or 90 reads as 30) and `rangeParam`.
- `lib/url-query.ts`: `withQuery` / `replaceQuery` merge params into the current query. The calculator used to replace the whole query with its four inputs, which would drop `range` on every load and every edit; it and the chart now both merge.
- Files: app/financials/page.tsx, components/cost/price-chart.tsx, components/cost/calculator.tsx, plus the two lib files and their tests.

**Q2 (already met; no app change).** The progressbar in components/catalogue/decode-progress.tsx already has `aria-labelledby` pointing at the visible label (unchanged since cf9c661, before T35's base). On a real build with the real feed, Chrome's accessibility tree names it "DECODING RECORDS" at 1280 px and "DECODING" at 375 px (text-transform shows in the name), with aria-valuenow 36461 of 37268. The existing desktop e2e already asserted the name; the 375 px e2e now asserts it too.

**Tests.** lib/url-query.test.ts and lib/price-range.test.ts (4 tests). e2e/price-chart.e2e.ts: a shared link `?range=7` survives the calculator's write on load; 90d plus a calculator edit keeps both; reload restores 90d and the writes value; 30d leaves no `range` param (fixture now also answers 90). e2e/decode.e2e.ts: progressbar name at 375 px.

**Checks.** pnpm test 632/632 (47 files), pnpm typecheck, pnpm build, prod e2e `PORT=3115 pnpm test:e2e` 22/22 in three of three runs. Real-data probe (temporary, deleted): `/financials?range=90` became `/financials?range=90&writes=1000&payload=200&lifetime=7&unit=days`, 90d pressed, badge "▲ 18.8% over 90 d"; after 30d: `/financials?writes=1000&payload=200&lifetime=7&unit=days`.

**Deviations, flagged.**
- Q2 needed no code change (see above), so "tests for both" is met by an added assertion, not a fix.
- Side effect of the merge: `load=1` on /financials now survives the calculator's URL writes (before, the calculator dropped it on load, so a reload lost "Include load generators"). Nothing else reads the query differently.
- Not changed: the "Include/Exclude load generators" link still navigates to a fixed `/financials` or `/financials?load=1`, dropping calculator inputs and the range, as it did before for the calculator inputs.
- Build prints Next's "inferred your workspace root" warning because this worktree sits inside the main checkout (two lockfiles); harmless for `next start`.

Next owner: Orchestrator (review and merge).
