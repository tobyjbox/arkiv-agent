# T01 — Spike: scaffold, read checks, history, fees, DB choice

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** —
- **Workspace:** worktrees/arkiv-agent-spike, branch feat/spike
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] scaffold (pnpm workspace, .gitignore with .env, .env.example)
- [x] read checks (page all live entities, timing)
- [x] history + fee data checks
- [x] go/no-go notes + DB choice

## Acceptance criteria
- [ ] pnpm workspace per docs/PLAN.md layout builds; .env gitignored, .env.example present, no secrets committed
- [ ] arkiv/friction.md records: time to page all live entities, how far back events/receipts go, whether fees depend on lifetime (measured if a wallet is in .env, else from observed receipts, gap noted)
- [ ] DB choice (SQLite preferred, else Postgres in Docker; no Neon) with reason
- [ ] explicit go/no-go per check, and what scope a no-go removes

## Progress log
- 2026-10-28T17:22:14Z claimed (a058638), in-progress (e80676e). Scaffold done (099f29e): `pnpm build` builds core, indexer and the Next.js app; app serves a live entity count on 3101. Spike scripts written; history check run (full history from block 1); read walk and fee fit running.
- 2026-10-28T17:30:13Z Read, history, logs, decode and fee checks run; findings, go/no-go and DB choice in arkiv/friction.md (736a733). Anonymous `arkiv_query` budget exhausted during the read walk (HTTP 429 ANON_COST_LIMITED, resets ~18:20Z); `eth_*` unaffected. All milestones 4/4; flipping to review, candidate 736a733.
- 2026-10-28T17:30:13Z Notification intent: key `2026-10-28-arkiv-agent:T01@736a733:review`; recipient Orchestrator (arkiv-agent) thread local_<session> (from `ak-orch.sh thread arkiv-agent`); route Claude Code session message; state: pending (send after this commit is pushed).

## Handoff

**Candidate:** `736a733` on `feat/spike` (worktree `worktrees/arkiv-agent-spike`). Not merged.

**What changed**
- pnpm workspace per `docs/PLAN.md` layout: `apps/arkiv-agent` (Next.js 15 placeholder that reads the live
  entity count through core), `packages/core` (read-only Tiramisu client, `Result` type, `allLive()`,
  `ARKIV_ADDRESS`, optional `ARKIV_API_KEY` header), `packages/indexer` (spike scripts only).
- `.gitignore` covers `.env*` (except `.env.example`), `data/` and `*.db`; `.env.example` lists
  `ARKIV_RPC_URL`, optional `ARKIV_API_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, optional
  `ARKIV_TEST_PRIVATE_KEY`. No `.env` exists; no secrets committed (staged diff scanned).
- `arkiv/friction.md`: go/no-go table, fee gap, DB choice, data sources, 10 friction items.
  `arkiv/schema.md`: what ArkivAgent reads (read-only).

**Results (details and caveats in `arkiv/friction.md`)**
- Read all live entities: **Go** via `eth_getLogs` replay (~1.7 min for all ~2.34M events) plus calldata
  decoding. `arkiv_query` itself is fast (5,000 entities in 7.96 s, ~60 s extrapolated for 37.1k) but its
  anonymous budget ran out mid-walk, so the full `arkiv_query` walk was **not completed**.
- History: **Go**, full from genesis (block 1, 2026-10-01). Pulse limited to the Tiramisu era.
- Fees vs lifetime: no dependence on today's Tiramisu (observed receipts, plus a third-party controlled
  test). No wallet, so our own controlled test is the stated gap. No `rentFee` yet; rent arrives with UDC.
- DB: **SQLite via Prisma** (Docker isn't installed here; volume fits; one writer).

**How to verify**
- `pnpm install && pnpm build && pnpm test` (3 packages build; 2 tests pass).
- `PORT=3101 pnpm --filter arkiv-agent start` after build: page shows "N live entities on Tiramisu".
- `pnpm spike:history`, `spike:logs`, `spike:decode`, `spike:fees` reproduce the numbers (eth_* only).
  `pnpm spike:read` uses `arkiv_query` and may hit the anonymous budget; it stops and records that.

**Deviations from the task spec (flagged)**
- The full `arkiv_query` walk has a measured partial plus an extrapolation, not one full timed run,
  because the anonymous budget ran out. The go/no-go rests on the `eth_getLogs` path, which was timed.
- `docs/PLAN.md` still says Postgres; the mission PLAN deviation (SQLite) governs, and friction.md
  records the choice. I did not edit `docs/PLAN.md`.
- Added `ARKIV_API_KEY` (optional) beyond the spec's env list, because of friction item 2.
- No Tailwind or UI system yet in `apps/arkiv-agent`; T04 brings the T02 visual system.

**For T03 and the Orchestrator**
- Backfill from `eth_getLogs` (5,000-block spans) and calldata; use `arkiv_query` only for Ask Arkiv.
  Without an Arkiv Hub key, the first attribute backfill is rate-bound to ~1 h (600 requests/min).
- Needs from the owner (optional, recommended): an Arkiv Hub access key for Tiramisu in `.env` as
  `ARKIV_API_KEY` (hub.arkiv.network/api-keys; wallet sign-in and captcha, so the owner's action).
  It speeds the first backfill and protects Ask Arkiv's live queries from the anonymous budget.
- Scope note under the no-go rule: hackathon cohorts from before 2026-10-01 (earlier networks) can't be
  read, which narrows T10's cohort retention to the Tiramisu era.
