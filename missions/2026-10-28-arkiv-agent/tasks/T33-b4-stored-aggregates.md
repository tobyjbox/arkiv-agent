# T33 — B4: indexer stores Insights and Financials results

- **Persona:** coder · **Model tier:** frontier · **Depends on:** T31
- **Workspace:** <worktrees>/arkiv-agent-b4, branch refactor/b4-aggregates (from local main)
- **Plan:** Part B, B4 (owner: do now)

## Acceptance criteria
- [x] the indexer computes and stores the Insights (pulse) and Financials (cost) aggregates after each sync; fee model refitted when new fee samples arrive; pages only read stored results
- [x] page response time independent of index size (measure before/after); numbers match current output
- [x] safe with the owner's running indexer: schema change via migration with a documented restart step if needed
- [x] tests, build, prod e2e pass; don't push. Runs in parallel with T32 (different packages)

## Progress log
- 2026-10-29T16:55Z claimed; worktree <worktrees>/arkiv-agent-b4, branch refactor/b4-aggregates from local main fd83a3c (T32 merged). DB: `.backup` copy.
  - Before changing anything: timed both pages on the prod build (port 3112, GLM_PRICE=off).
  - Saved every number the two pages show: pulse for 7/30/90 d with and without load; spend for 7/30/90 d with and without load; fee model; scatter points. Deterministic.
  - Saved the rendered HTML of 8 page variants.
- 2026-10-29T17:06Z change (9b86d20).
  - Stored numbers identical to the old ones. Insights HTML byte-identical; Financials differs only in the "Fitted" time (the model was refit).
  - Pages ~30 ms.
  - Checked on the copy:
    - the migration applies with `prisma migrate deploy`;
    - `pnpm aggregates` stores the results in 4.5 s;
    - `pnpm fees --limit 3` refits (1,500 → 1,502 receipts, new fit time);
    - `pnpm index --watch` (ARKIV_RPS=2) stores them at start and 30 s later while sync keeps up.
  - Pending state checked in the browser.
  - `pnpm test` 624/624, typecheck, build, prod e2e on 3113 21/21.
- 2026-10-29T17:07:07Z notify intent: T33 review candidate=9b86d20 to Orchestrator local_<session> via ccd send_message; key 2026-10-28-arkiv-agent:T33@9b86d20:review; attempt 1.

## Handoff
Branch refactor/b4-aggregates (local only, not pushed), candidate 9b86d20, base local main fd83a3c. One commit.

- **Storage.** A new `Aggregate` table (migration `20261029170000_aggregates`, SQL checked against `prisma migrate diff`): key, JSON value, index block, computedAtMs. `@arkiv-agent/db` has `readAggregate`, which returns null when the row or table is missing, and `writeAggregates`, which writes one refresh in a single transaction.
- **What's stored.** 13 keys:
  - `pulse:{7,30,90}:{apps,all}`: the full `Pulse` objects.
  - `spend:{7,30,90}:{apps,all}`.
  - `fees`: the model, fittedAt, receipt count, up to 2,000 scatter points and the axis maxima. The page used to pick these itself.
- **Who computes it.**
  - pulse: `pulseAggregates()`, one scan of history shared by all 6 combinations; the old 30 s row cache is gone.
  - cost: `costAggregates()`, with one `createsByWallet`/`updatesByWallet` query per period instead of per page view.
  - The indexer's `storeAggregates(db)` writes both:
    - at the end of `pnpm index`;
    - every 30 s with `--watch`, as a third loop with its own error backoff, so a failure never holds up sync or decode;
    - after `pnpm fees`;
    - on `pnpm aggregates` (new: stores once without syncing, safe beside the indexer).
  - The indexer now depends on pulse and cost. Pulse and cost still depend only on db and projects.
- **Fee model.** Refitted only when the TxFee count changes (`whenChanged`, tested). So `fittedAt` is now when samples last changed or the indexer started, not "within the last minute".
- **Pages.** Insights and Financials only read: `getPulse`, `estimatedSpend` and `feeSummary` read stored rows.
  - Until the indexer has stored them once, both pages show a short note: start the indexer, or run `pnpm aggregates`. The note refreshes when the index moves.
  - `indexStatus` is unchanged, so the other pages never wait on this table.
- **Timing** (prod build, same DB copy; first request / warm requests):

  | Page | Before | After |
  |---|---|---|
  | /insights | 4.4 s / 0.68–0.74 s | 67 ms / 27–35 ms |
  | /insights?period=90&load=1 | 0.69 s (1.6 s spikes) | 27–30 ms |
  | /insights?period=7 | 0.19 s | 26 ms |
  | /financials | 0.68–0.71 s (spikes to 1.6 s) | 38–46 ms |

  Pages now read one ~30 KB row by key, so their time no longer depends on index size. The indexer pays about 3.6–4.5 s every 30 s instead.
- **Numbers.** Identical to the old output for every combination. The Insights HTML (6 variants) is byte-identical; Financials differs only in the fit time.
- **Restart step (owner).** The new table needs the new indexer:
  1. Stop the app and the indexer.
  2. Start `pnpm index --watch`. It applies the migration (Prisma needs the database to itself for that moment, as before) and stores the results within seconds.
  3. `pnpm build`, then start the app.
  - If the app comes up first, the two pages show the pending note until then.
  - The README now describes the stored results and `pnpm aggregates`.
- **Tests.** 4 new (db store: missing table, round trip and replace, all-or-nothing; cost `whenChanged`). `pnpm test` 624/624, typecheck clean, `pnpm build`, `PORT=3113 pnpm test:e2e` 21/21.

Next owner: Orchestrator (review/merge). Then T34 (B5+B6).
