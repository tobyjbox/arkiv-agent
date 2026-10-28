# Building ArkivAgent on Arkiv: friction report

Versions: `@arkiv-network/sdk` **0.8.1**, `viem` **2.57.13**, Node **22.22.0**, pnpm **11.1.2**, Arkiv
**Tiramisu** (chain `7738577`), 28 October 2026, blocks ~1,178,500–1,179,300. All reads used the
public RPC with no access key. Nothing was written to the chain (no wallet).

Every number below comes from a script in `packages/indexer/src/spike/` (`pnpm spike:read`,
`spike:history`, `spike:logs`, `spike:decode`, `spike:fees`). Each writes its raw result to
`data/spike/*.json`, which is gitignored because it holds third-party chain data.

Items marked **Issue** cost us time or would mislead a builder; **Worked** items behaved as documented;
**Observation** items are findings either way.

---

## Phase 0 spike: go/no-go (T01)

| Check | Result | Verdict | Scope removed |
|---|---|---|---|
| Read every live entity in under ~5 min | `arkiv_query` read 5,000 entities in 7.96 s (25 pages of 200, ~0.32 s each), which extrapolates to ~60 s for all 37.1k. The walk did not finish: the anonymous query budget ran out (item 2). `eth_getLogs` replays every entity's lifecycle from genesis in ~1.7 min (236 calls, ~2.34M events), and calldata decodes to attributes (item 6). | **Go**, via logs + calldata | None. T03 backfills from `eth_*`, not `arkiv_query`. Without an access key, the first attribute backfill is rate-bound at about 1 hour (600 requests/min); with one, about 1 min of query time. |
| History depth | Full history back to block 1 (2026-10-01T10:10:04Z, 27.3 days): logs, receipts, blocks and `arkiv_query` with `atBlock: 1` all answer. No pruning seen. | **Go** | Pulse covers the Tiramisu era only (from 2026-10-01). Earlier networks (Braga, shut down Aug 2026) are not readable, so hackathon cohorts from before October are out of T10. |
| Do fees depend on lifetime? | No, on today's Tiramisu. gas = 66,110 + 20.95 × calldata bytes (R² 0.98, 240 create-only txs, 6 senders, blocks 679k–1.18M). Adding lifetime explains nothing (−0.3 gas/block, R² +0.0003). Receipts carry no `rentFee`. Gas price was 1,000,000,002 wei in every sample. | **Go** for the cost view, with the gap below | None. T11 models gas by bytes and presents rent as "arrives with UDC, not live on Tiramisu as of 2026-10-28". |

**Fee gap (no wallet).** The observed lifetimes span only 60–3,600 blocks (2 min–2 h), and each sender
used one lifetime, so lifetime and sender are confounded. A controlled test is still worth doing:
same payload, 1 h against 30 days. A third-party controlled test on Tiramisu (ChaseBP/claim-check
`arkiv/friction.md` item 4, 2026-10-18) found identical gas, 137,944 per entity, for 1 h and 400 days,
which agrees with our fit. Arkiv's own indexer docs say UDC nodes charge storage rent outside gas as
a receipt `rentFee` (item 7), so the answer will change when Tiramisu moves to UDC.

**DB choice: SQLite via Prisma** (no Neon, no Docker). Volume is small for SQLite: ~37k live entities,
~1.7M entity lifecycles and ~2.34M events since genesis, growing ~61k entities/day (mostly two load
generators, item 10). There is one writer (the indexer) and a few readers (the Next.js app); WAL mode
covers that. Docker is not installed on this machine, so Postgres in Docker would add a setup step for
every reader of the README. We store payload previews only (≤256 bytes), which bounds size and
personal-data exposure. Revisit if the file passes ~5 GB or a second writer appears.

**Data sources chosen.** Index: `eth_getLogs` (entity events) + `eth_getTransactionByHash` (calldata)
+ receipts for fees, all under the 600 requests/min limit. `arkiv_query` only for Ask Arkiv's live
queries and spot checks, because it has its own small anonymous budget.

---

## 1. Issue: `page.next()` fails on any walk longer than one page unless you pin `atBlock`

- **Expected:** `fetch()` then `page.next()` returns the next page, as in the SDK README.
- **Actual:** `Query rejected (cursor, -32005): Request exceeds defined limit..`. The node's own
  message is accurate: `cursor belongs to a different query, block or select — start a new page-through`.
  Over raw RPC, `cursor` alone fails; `cursor` plus `atBlock` = the first page's block works.
- **Steps:** `pnpm spike:read` without `.atBlock(head)` in `read-all.ts`.
- **Impact:** any multi-page read breaks on a 2-second chain. Also reported by ChaseBP/claim-check (item 2).
- **What would fix it:** carry the first page's `blockNumber` into every continuation as `atBlock`, and
  surface the node's message verbatim.

## 2. Issue: the anonymous `arkiv_query` budget is undocumented, invisible, and a single walk exhausts it

- **Expected:** the documented default rate limit applies; a key is optional for trying Arkiv.
- **Actual:** two separate limits. Every method shares `ratelimit: limit=600` per minute (JSON-RPC batch
  items count one each). `arkiv_query` also draws on a separate budget: after one partial walk (at least 5,000
  entities, light projection) and a few probes it returned HTTP 429 `{"error":"ANON_COST_LIMITED","message":"unauthenticated query budget
  exhausted; get an API key at https://hub.arkiv.network for a monthly quota"}`, `ratelimit: limit=10000,
  remaining=0, reset=3144`. Successful responses show only the 600/min bucket, so you cannot see the
  query budget until it is gone. `eth_*` calls kept working.
- **Steps:** `pnpm spike:read`, then any `arkiv_query`.
- **Impact:** a builder's first "list everything" script locks them out of queries for ~50 minutes, and
  the access-keys docs do not mention the budget or how a query's cost is computed.
- **What would fix it:** document per-method cost units and the anonymous budget; return the query
  budget's remaining units on every response.

## 3. Issue: no "match all", and the obvious workaround is slow

- **Expected:** a way to list every entity, or a fast always-true predicate.
- **Actual:** the SDK refuses an empty filter ("the language has no spelling for 'match every entity'").
  `$expiresAt > u64(0)` works but took ~7 s per 200-row page (raw RPC), and SDK walks timed out at 30 s.
  `$expiresAt > u64(<read block>)`, which means the same thing for live entities, took 1.6 s for the first
  page over raw RPC and averaged ~0.32 s per page over a 25-page SDK walk.
- **Steps:** `packages/core/src/client.ts` `allLive()`; timings in this report's go/no-go table.
- **What would fix it:** a documented `ALL` query, or a note that bounding `$expiresAt` at the read block
  is the fast form.

## 4. Mixed: `eth_getLogs` caps results, and viem's default response cap trips first

- **Actual:** the node caps a call at 20,000 results, not a block span. The raw error is helpful:
  `query exceeds max results 20000, retry with the range 725001-729209`. viem surfaces it as
  "Invalid parameters were provided to the RPC method" and keeps the node's text only in `cause`, which
  is why the T01 spike misread it as a span limit. Separately, a full 20,000-log page is ~10.5 MB, just
  over viem's default 10 MB `maxResponseBodySize`, so following the node's own hint fails with
  `ResponseBodyTooLargeError` unless the cap is raised.
- **Steps:** `pnpm index` on a fresh database (dense blocks around 725,000).
- **Impact:** a backfill stopped twice before the indexer learned to split on both errors.
- **What would fix it:** document the result cap in the RPC docs; keep the retry hint (it is good).
  In SDK docs, mention raising viem's response cap for log backfills.

## 5. Worked: full history from genesis

`eth_getLogs`, `eth_getTransactionReceipt`, `eth_getBlockByNumber` and `arkiv_query` with `atBlock: 1`
all answer at block 1. Tiramisu's block 1 is 2026-10-01T10:10:04Z. All five entity events appear
across history. **Steps:** `pnpm spike:history`.

## 6. Worked, with a gap: entity calldata is plain ABI

A create decodes with viem alone: `execute((uint8 operation, bytes operationData)[])`, and each create is
`(uint128 salt, uint64 expiresAt, uint64 minLifetime, uint8 creationFlags, (bytes32 name, uint8 typeId,
bytes value)[] attributes)`, with `$payload` and `$contentType` carried as attributes. Most writers set
`minLifetime` and leave `expiresAt` 0; the node derives expiry. **Gap:** the SDK does not export
`EXECUTE_ABI` or the operation payload ABIs, so an indexer has to copy them and track SDK changes.
**Steps:** `pnpm spike:decode`.

## 7. Observation: create cost does not depend on lifetime today; rent is coming

See the go/no-go table. Arkiv's `arkiv-chain-indexer` README says UDC nodes charge storage rent outside
gas and report it as the receipt's `rentFee`. Tiramisu receipts have no such field today
(`pnpm spike:history`, receipt fields).

## 8. Observation: SDK 0.9 changes the entity model

`@arkiv-network/sdk` `next` is 0.9.0. Arkiv's indexer docs describe the 0.9 "UDC" model as
schema-typed attributes with an indexed flag "and no payload or content type". ArkivAgent pins `~0.8.1`
and will need a model change if Tiramisu migrates.

## 9. Worked: clear error for removed operators

`&&` returns `symbol operators (&& || ~) were removed — use AND, OR, STARTSWITH`, with the position.

## 10. Observation: load generators dominate writes and pollute schemas

Two owners (`0x679B5Ab1…`, `0x6CB41094…`) wrote 235 of 240 sampled creates, all with a 900-block
lifetime. Their attribute names carry random suffixes (`random_number_0_<hex>`), so each entity
looks like a new schema. Arkiv's indexer repo runs "baseload" fleets, which fits. The catalogue and
pulse must detect and exclude them by default (`docs/PLAN.md` risk table). Some live entities expire
at `u64` max (`0xffffffffffffffff`).

## 11. Observation: some entities are patched thousands of times

Patches are deltas, so an off-chain replica rebuilds attributes by replaying the create and every
patch. 17 live entities have over 25 patches each (21,067 in all; the most, 3,045). Replaying those
from calldata exceeds the public rate limit, so ArkivAgent reads their current state with one `getEntity`
instead. **What would help:** a cheap "attributes at block N" read that does not draw on the small
anonymous query budget, or a snapshot event every N patches.

## 12. Friction: `$expiresAt` ranges are slow, and creation time can't be filtered

Ask Arkiv turns "expiring in the next 24 hours" into `$expiresAt <= u64(head + 43200)`. On Tiramisu
(2026-10-28, anonymous), `app = str('tideland') AND kind = str('sign')` returns in about 1 s; adding
that one-sided bound takes 6.5 to 7.5 s, whichever order the terms are in. A two-sided range
(`$expiresAt > head AND $expiresAt <= head + 43200`) did not return within 60 s. `$createdAt` is not
indexed at all, so "created today" only works on datasets that write their own timestamp
attribute, and ArkivAgent says so when one is missing. **What would help:** an indexed `$createdAt`
(or creation block), and a query planner that applies the cheap equality filters before a range.
