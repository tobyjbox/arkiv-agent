# Plan: ArkivAgent

Mission `2026-10-28-arkiv-agent` · Status: **APPROVED by the owner 2026-10-28T17:02:27Z** · Orchestrator:
arkiv-agent_orchestrator_claude-code_opus-5.5-low

Technical design: `docs/PLAN.md` (Coder). This file is the mission decomposition; where they
differ on scope, this file and `BRIEF.md` win.

## Scope

Must ship (done criteria below): Phase 0 spike, indexer, data catalogue, Ask Arkiv, a stunning
dark-mode UI that feels live, QA + Security review of that slice, and a local-run README with a
demo script. Stretch, only if it fits before the target date next week: ecosystem pulse, then cost
view.

## Non-goals

- No deployment (no Vercel, no Neon, no GitHub Actions schedule). Runs locally only.
- No writes to Arkiv on users' behalf; no protocol changes.
- Making the repo public stays the owner's action.
- `docs/PLAN.md` "Later, in this repo" items.

## Deviations from docs/PLAN.md

- **Database:** local only, no Neon. T01 picks SQLite (via Prisma) or Postgres in Docker and
  records why; SQLite preferred unless the spike shows it can't handle the volume.
- **Indexer schedule:** a local CLI (`pnpm index` once, `pnpm index --watch` incremental) instead
  of GitHub Actions.
- **Test wallet:** not needed for reads. Only fee experiments (Phase 0 fee check, cost view) need
  writes. Without a wallet, T01 fits fees from observed receipts and notes the gap.
- **No-go rule (Q5):** if T01 shows a check fails, the orchestrator cuts scope to what T01 proves
  possible and records it as an amendment; no stop.
- **UX:** dark mode only, visually stunning, and it must feel fast: streamed/optimistic rendering,
  skeletons, live-updating counters and a visible "synced N s ago" pulse. Polling or SSE from the
  local indexer drives it. UX designer specs it; Coder builds it.

## Tasks

| ID | Task | Persona | Tier | Depends |
|---|---|---|---|---|
| T01 | Spike: scaffold pnpm workspace, `.gitignore`/`.env.example`, read checks, history depth, fee data, DB choice, go/no-go notes in `arkiv/friction.md` | coder | frontier | none |
| T02 | Visual system + catalogue and Ask Arkiv screen specs (dark mode, "feels live" patterns, motion, empty/loading states) | ux_designer | fast | none |
| T03 | Indexer: Prisma schema, backfill + incremental sync, live/expired/deleted, fixtures, watch mode + change feed for the UI | coder | frontier | T01 |
| T04 | Data catalogue: inference, pages, AI descriptions, live UI per T02 | coder | frontier | T02, T03 |
| T05 | Ask Arkiv: AskQuery, compiler, prompt, UI per T02, 20-question eval (>= 80%) | coder | frontier | T04 |
| T06 | QA review of slice (T04, T05) on integration branch | qa | fast | T05 |
| T07 | Security review of slice: secrets, prompt injection from on-chain data, PII exposure, read-only guarantee | security_whitehat | alt-frontier | T05 |
| T08 | README (local run, why Arkiv, feature tour), friction log tidy, 3-minute demo script | coder | fast | T06, T07 |
| T09 | *Stretch:* pulse + cost screen specs | ux_designer | fast | T02 |
| T10 | *Stretch:* ecosystem pulse | coder | frontier | T08, T09 |
| T11 | *Stretch:* cost view | coder | frontier | T10 |
| T12 | *Stretch:* QA + Security review of T10/T11 (two rows when released) | qa, security_whitehat | fast, alt-frontier | T11 |

T01 and T02 start in parallel. Coder is one session, so coding tasks run in series; the UX
designer works ahead of Coder. QA/Security finding rows are added as `draft` and triaged.

## Review lanes

QA and Security review every coding slice against its acceptance criteria (the owner, Q4). Findings
become new draft rows. Orchestrator is sole merger.

## Branches and workspaces

- Integration branch: `mission/2026-10-28-arkiv-agent` from `main`.
- One worktree per coding task: `worktrees/arkiv-agent-<task-slug>`, branch
  `feat/<task-slug>`. Dev-server ports: Coder 3101, QA 3102 (review runs).
- UX deliverables go in `design/` on their own branch `design/<slug>`; no code.

## Done criteria

1. T01 to T08 `merged` (or descoped by recorded amendment under the no-go rule).
2. `pnpm install && pnpm index && pnpm dev` runs ArkivAgent locally from the README with only
   `ANTHROPIC_API_KEY` in `.env`.
3. Catalogue lists every live dataset with schema and description; Ask Arkiv eval >= 80%.
4. UI is dark mode, matches T02 specs, and shows live updates without a manual refresh.
5. No open QA/Security findings rated high or above; no secrets in history.
6. Integration branch merged to `main` and pushed. Stretch rows either `merged` or `deferred`.

## Needs from the owner

- Approve this plan.
- `ANTHROPIC_API_KEY` in `.env` before T04 (AI descriptions).
- Optional: test wallet key in `.env` for fee experiments (T01, T11).
- Target date when known, to decide the stretch cut-off.
- Note: kit guidance runs the orchestrator at high effort; this session is opus-5.5-low.

## Amendments



- 2026-10-28T17:31:20Z (T01 findings, no-go rule): read-all and history are Go; history starts at Tiramisu genesis 2026-10-01, so T10 cohorts cover only Tiramisu-era events (pre-Oct hackathons out). DB is SQLite via Prisma (docs/PLAN.md still says Postgres; mission PLAN governs). Fees show no lifetime dependence; own controlled test needs a wallet (optional). Optional ARKIV_API_KEY speeds T03's first backfill (~1 h without).
- 2026-10-28T22:03:02Z A01 (owner: "We need to finish without this"): no ANTHROPIC_API_KEY. AI features behind the key, no-key states shown. T05 default path is deterministic (no LLM); Claude path optional. Done criterion 2: runs locally with no keys in .env.
