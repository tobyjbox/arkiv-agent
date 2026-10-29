# Plan: arkiv-agent rename, architecture, review fixes

Status: **ready for owner review**. Includes the QA (T21) and security (T22) findings in Part C.
Base: local `main` a09f1e6.

## Order

1. **Part C, C1 and C2**: the QA and security fixes come first (C1 and C2 can run in parallel; they touch different files).
2. **Part A, the rename**: one mechanical pass, made before the refactors so they use the new names.
3. **Part B, architecture**: B1 → B2 → B3/B4 (B3 and B4 can run in parallel), then B5 and B6.
4. **QA re-check** of the whole app, then **C3**: the owner publishes from a new repo (security H1).

Each numbered item becomes one coder task with its own branch. Tests, build and production e2e must stay green after each.

---

## Part A — Remove "arkiv-agent" everywhere, use "arkiv-agent"

About 330 references in about 100 tracked files (the lockfile is regenerated). User-visible text is already "ArkivAgent" (fa2d038).

| What | From | To |
|---|---|---|
| App folder | `apps/arkiv-agent` | `apps/arkiv-agent` |
| Package scope | `@arkiv-agent/core`, `db`, `catalogue`, `ask`, `pulse`, `cost`, `indexer`; app package `arkiv-agent` | `@arkiv-agent/*`; app package `arkiv-agent` |
| Code names | `ArkivClient`, `createArkivClient`, `ArkivAgentError`, `cache.arkivAgentPrisma` | `ArkivClient`, `createArkivClient`, `ArkivAgentError`, `cache.arkivAgentPrisma` |
| Environment variables | `ARKIV_AGENT_HOST`, `ARKIV_AGENT_ALLOWED_HOSTS`, `ARKIV_AGENT_ASK_MODEL`, `ARKIV_AGENT_DESCRIBE_MODEL` | `ARKIV_AGENT_*`; the old names are still read for one release, with a warning |
| Database file | `data/arkiv-agent.db` | `data/arkiv-agent.db`; on startup, an existing `arkiv-agent.db` is renamed once |
| Mission folder | `missions/2026-10-28-arkiv-agent` (and every path that points into it) | `missions/2026-10-28-arkiv-agent` |
| Docs | README, `docs/`, `design/`, `arkiv/`, mission files | text and paths updated |
| Local setup (not in git) | `.claude/launch.json` config name `arkiv-agent` | `arkiv-agent` |

**Not changed:**
- **Git history:** owner decided (2026-10-29) to rewrite it too: the old names are replaced in every commit, file paths included, in the same final rewrite as C3.
- **Historical log lines:** MISSION_LOG entries that quote old commit messages stay as written; paths in them are updated.

**Done when:** `git grep -i arkiv-agent` (excluding the lockfile) returns nothing; a fresh clone works from the README; tests, build and production e2e pass; the owner's local index keeps working after the database rename.

Do this as one task, with no other change mixed in, so the diff can be reviewed mechanically.

---

## Part B — Architecture: modules and abstraction

| # | Finding | Change | Done when |
|---|---|---|---|
| B1 | **The database has no single owner.** Prisma in `db` serves the schema and feed; catalogue opens its own raw read connection (`catalogueDb`) and shares it with the other packages. Raw SQL is spread across catalogue, pulse and cost. | `@arkiv-agent/db` owns the read connection and typed query modules (entities, attributes, patches, fees, sync state). Other packages call those queries and contain no SQL. | Only `packages/db` contains SQL; a schema change touches one package. |
| B2 | **Shared ideas live in the wrong packages.** Cost imports pulse (`projectsByWallet`) and catalogue (`loadGeneratorOwners`, `catalogueDb`). Pulse imports catalogue to get a database connection. | A new `@arkiv-agent/projects` module holds wallet-to-project assignment and load-generator detection. Cost and pulse depend on it, not on each other. | No dependency between pulse and cost; each depends only on db, projects and core. |
| B3 | **`interpret()` is one function of about 430 lines** (`packages/ask/src/interpret.ts:263-690`). | A pipeline: tokenize → pick the dataset → a list of small condition parsers (comparison, negation, between, presence, time, latest), each with its own tests → build the plan. | No function over about 80 lines; existing Ask question sets (eval, held-out, unseen, unseen16) give the same results. |
| B4 | **Heavy calculations run on every page request.** `/cost` and `/pulse` re-run the full calculations through synchronous SQLite calls (the root of T19 L1). | The indexer stores pulse and cost results after each sync; pages only read them. The fee model is refitted when new fee samples arrive. | Page response time doesn't depend on index size; the numbers match the current output. |
| B5 | **Page files mix layout with drawing code.** The GLM price lookup sits in the app. | Charts move into components; the price lookup moves into `@arkiv-agent/cost` behind a `PriceSource` interface (CoinGecko, Binance). | Page files only lay out components; the price lookup is tested in the cost package. |
| B6 | **Dead code.** `packages/indexer/src/spike/` and the `spike:*` commands. | Delete them; the findings are already recorded in `arkiv/friction.md` and T01. | No spike code left. |

---

## Part C — QA (T21) and security (T22) findings

### Security (T22, accepted): NO-GO to publish until H1 is fixed; the code itself is publishable

| # | Severity | Finding | Decision |
|---|---|---|---|
| H1 | High | GitHub still serves commits from before both rewrites by their hashes (orchestrator spot-check: `0194123` is still served, with the owner's real email). They hold home paths, the real email and job-application details, and MISSION_LOG names some old hashes. | **Fix before publishing, owner's action:** publish from a **new GitHub repo** that has only the rewritten `main` (recommended), or ask GitHub Support to purge the old commits. In the same change, remove the old hashes from MISSION_LOG. Re-check by fetching the old hashes from the public repo. |
| L1 | Low | `pnpm audit`: 2 high and 2 moderate in `postcss` pulled in by `next`; no exploit path today. | Fix in step C1: override to `postcss>=8.5.23`. |
| L2 | Low | The T19 guard on the heavy pages relies on Origin/Referer; it should also check `Sec-Fetch-Site`/`Sec-Fetch-Mode`. | Fix in C1; B4 removes the underlying cost. |
| Info | — | No secrets in any commit; the GLM price fetch is safe; the T07 and T19 fixes still hold. | — |

### QA (T21, accepted): ready to publish after H1 and M1; the USD view is correct

| # | Severity | Finding | Decision |
|---|---|---|---|
| H1 | High (docs) | README still lists Pulse and Cost as "Planned"; it doesn't mention `pnpm fees` or the outbound price calls (CoinGecko, Binance). | Fix in C1. |
| M1 | Medium | 81 datasets named by schema shape use `EXISTS` base queries, which the RPC rejects, so Ask, the SDK snippet and the Explorer link fail for them (T17 N1 was only partly fixed). | Fix in C2: a base query without `EXISTS`, or list these datasets as browse-only with a reason. |
| M2 | Medium | With no index (for example, before the first `pnpm index` finishes migrating), every page is a blank 500, and an empty DB file gets created. | Fix in C2: an "index not built yet, run `pnpm index`" page; don't create the file. |
| M3 | Medium | `/cost` waits for the price lookup; when both APIs hang it takes 7.8 s. | Fix in C2: render without USD when no price is cached, and refresh the price in the background. B5 moves this code to the cost package. |
| L1 | Low | Leftover "ArkivAgent" text: `pulse/aggregate.ts:142`, `ask/interpret.ts:596,620`, `.env.example:14`. | Covered by Part A. |
| L2 | Low | The dataset detail tab title is just "ArkivAgent". | Fix in C1: "<dataset> · ArkivAgent". |
| L3 | Low | e2e is still load-sensitive (one cost pageerror in 3 runs; timeouts under `--repeat-each 4`); one unreproduced React #418. | Fix in C2: wait on network idle or state, not timers; record #418 if it comes back. |
| L4 | Low | On narrow screens the sync indicator shows only "642s", and "Ask Arkiv" wraps. | Fix in C1. |

### Part C tasks
- **C1 (coder, fast):** README (QA H1), postcss override (security L1), Sec-Fetch check (security L2), detail-page title (QA L2), narrow sync indicator and nav (QA L4).
- **C2 (coder, frontier):** M1 schema-shape base query, M2 no-index page, M3 non-blocking price, L3 e2e stability.
- **C3 (owner):** security H1, publishing from a clean repo. Do it last, after Parts A and B, so the new repo starts from the final history.

---

## Owner decisions needed
1. ~~Keep old names in history?~~ Decided: rewrite history.
2. ~~B4 now or later?~~ Decided: now.
3. ~~Security H1 route?~~ Decided: new repo. Old repo renamed `tobyjbox/arkiv-agent-archive` (private; local `origin` now points there); new empty private `tobyjbox/arkiv-agent` created 2026-10-29. Only the final checked history is pushed to it.
