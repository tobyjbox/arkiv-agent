# T03 — Indexer + change feed

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T01
- **Workspace:** worktrees/arkiv-agent-indexer, branch feat/indexer (created at release)
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] Prisma schema
- [x] backfill + incremental sync
- [x] live/expired/deleted + fixtures
- [x] watch mode + change feed

## Acceptance criteria
- [ ] index counts match chain; re-run safe
- [ ] pnpm index and pnpm index --watch work locally
- [ ] change feed (poll or SSE) the UI can subscribe to
- [ ] Vitest on recorded fixtures, no live-chain calls

## Progress log
- 2026-10-28T17:43:22Z Claimed on feat/indexer (d4dc1ce; branch board copy was stale, T03 showed draft while main's canonical row was ready), in-progress (30399eb). Schema, log replay, enrichment and 18 Vitest tests committed (5e15276). Node caps eth_getLogs at 20,000 results (not 5,000 blocks); reads now split on its retry hint. Full rebuild from genesis running.
- 2026-10-28T17:57:31Z Full replay from genesis done (two runs; the second resumed from block 725,000 after the node's 20,000-result cap and viem's 10 MB body cap stopped the first; both now handled). Index live 37,111 = chain arkiv_getEntityCount 37,111 at 2 blocks lag. Watch mode (sync + decode loops), lock file, /api/changes, index:verify, 19 tests. Attribute decode still running in watch (~45k queued at ~6.6/s, live first). All milestones 4/4; flipping to review, candidate 1e3c621.
- 2026-10-28T17:57:31Z Notification intent: key `2026-10-28-arkiv-agent:T03@1e3c621:review`; recipient Orchestrator (arkiv-agent) thread local_<session> (from `ak-orch.sh thread arkiv-agent`); route Claude Code session message; state: pending (send after this commit is pushed).

## Handoff

**Candidate:** `1e3c621` on `feat/indexer` (worktree `worktrees/arkiv-agent-indexer`). Not merged.

**What changed**
- `packages/db` (new): Prisma 7.10.1 SQLite schema (`Entity`, `Attribute`, `Patch`, `Change`, `SyncState`),
  init migration, `openSqlite()` (better-sqlite3, WAL) for the indexer's writes, `createPrisma()` for typed
  reads, `readFeed()` for the change feed, and `databasePath()` (`DATABASE_URL`, relative to the repo root).
- `packages/indexer`: `eth_getLogs` replay in 5,000-block spans that split on the node's 20,000-result
  cap and on oversize bodies; live/expired/deleted tracking (expiry is swept, since no event is emitted);
  calldata decoding into attributes, `$contentType`, payload size and a 256-byte preview, and a
  `schemaSig` for grouping into datasets; `pnpm index` (one-shot) and `pnpm index --watch` (sync and
  decode loops, status line every 30 s); one indexer per database (lock file); `pnpm index:verify`.
- `apps/arkiv-agent`: `GET /api/changes?since=<cursor>` for the 5 s poll in design/02-feels-live.md.
- `packages/core`: allow 32 MB responses. `arkiv/friction.md` item 4 corrected (20,000-result cap, viem cap).

**State of the index (local, `data/arkiv-agent.db`, gitignored, ~770 MB)**
- 1,625,786 entities since genesis: 37,103 live, 1,069,302 expired, 519,381 deleted. Replay of all
  ~1.18M blocks takes ~4 min.
- Counts match the chain: index live 37,111 = `arkiv_getEntityCount` 37,111 (2 blocks behind); during
  watch, difference 1 at 3 blocks behind.
- Attribute decode is still running in the background watch (live entities first). At handoff: 3,800
  decoded, 794 distinct live schemas so far, ~45k queued at ~6.6/s. The first full decode takes ~2 h
  without an access key. It is a one-time cost; after that, watch keeps up with new writes.

**How to verify**
- `pnpm install && pnpm build && pnpm test` (4 packages build; 19 tests on a recorded window plus synthetic
  transactions, no live-chain calls).
- `pnpm index` (first run builds from genesis; Ctrl-C is safe and a re-run resumes), or `pnpm index --watch`.
- `pnpm index:verify`: live count against `arkiv_getEntityCount` (read-only, runs beside watch).
  `pnpm index:verify --attrs 20` also spot-checks decoded attributes against `getEntity`.
- With watch running and the app on 3101: `curl localhost:3101/api/changes` gives a `cursor`; poll
  `?since=<cursor>` every 5 s. Tested: 14 changes (7 created, 2 deleted, 5 expired) in 6 s, 2 blocks lag.

**Deviations and decisions (flagged)**
- Attribute spot-check against the chain was **not run**: the anonymous `arkiv_query` budget was still
  exhausted from T01 (resets ~18:20Z). The decoder is covered by recorded load-generator fixtures and
  synthetic encodings that mirror the SDK codec. Next step for QA: `pnpm index:verify --attrs 20`.
- Decode scope: every live entity, plus 7 days of history from owners with ≤5,000 creates in that window.
  High-volume owners (Arkiv's two load generators) get a 1-in-16 sample of live entities by key, and
  lifecycle only for history. Decoding all of their history would take ~12 h at the public rate.
- The feed cursor is the change sequence number, not the block. Attributes arrive after their block is
  indexed (as `decoded` changes), so a block cursor would miss them. The response still carries
  `indexedBlock`, `chainHead`, `lagBlocks`, `isBehind` (over 15 blocks, i.e. 30 s), `syncedAt` and `liveCount`.
- No raw event table: entity lifecycle rows plus a `Patch` table. Feed rows are kept for ~1 h (1,800 blocks).
- Indexes to head minus 2 blocks, with no reorg handling. Expiries above i64 max are clamped (u64-max "never").
- Prisma pinned to 7.10.1; npm's `latest` tag points at an 8.0 RC.
- `pnpm index` now runs migrations itself (under the lock), so the root script no longer calls Prisma first.

**For T04 (catalogue)**
- Read with `createPrisma()` (singleton in `apps/arkiv-agent/lib/db.ts`). Dataset = `Entity.schemaSig`. `Attribute`
  holds name/type/value for schema, examples and presence. `decodedBlock` null means not decoded yet.
  Use `createdAtBlock`, `expiresAt` and `status` for activity and lifetime.
- Busy owners (load generators): owners with more than 5,000 creates in the last 7 days. Exclude by default.
- Poll `/api/changes`. `decoded` changes mean a row's attributes just arrived.

**Needs from the owner (optional):** `ARKIV_API_KEY` in `.env` cuts the first decode from ~2 h to well under
an hour (`ARKIV_RPS` sets the rate).
