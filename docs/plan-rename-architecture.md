# Plan: arkiv-agent rename, architecture, review fixes

Status: **draft**. Waiting on the QA (T21) and security (T22) review reports, which go into Part C.
Base: local `main` a09f1e6.

## Order

1. **Part C, high and medium fixes from QA and security**: these come first, because they may block publishing.
2. **Part A, the rename**: one mechanical pass, made before the refactors so they use the new names.
3. **Part B, architecture**: B1 → B2 → B3/B4 (B3 and B4 can run in parallel), then B5 and B6.
4. **QA re-check** of the whole app; owner publishes.

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
- **Git history:** past commits keep the old names. Changing them would mean a second history rewrite and force-push. Say if you want that.
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

### QA (T21)

_Pending._

---

## Owner decisions needed
1. Keep the old names in git history (planned), or rewrite history again?
2. Is B4 (storing results in the indexer) wanted now, or later?
