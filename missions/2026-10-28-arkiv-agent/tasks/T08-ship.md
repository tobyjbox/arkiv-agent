# T08 — README, friction log, demo script

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T06, T07
- **Workspace:** worktrees/arkiv-agent-ship, branch feat/ship (created at release)
- **Port:** —

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] README local run
- [x] friction log tidy
- [x] 3-minute demo script

## Acceptance criteria
- [x] fresh clone runs with only ANTHROPIC_API_KEY in .env following README
- [x] no deploy steps; repo stays private

## Progress log
- 2026-10-28T23:11:36Z Claimed and in-progress (88ff94e, b6dc4fc).
- 2026-10-28T23:15:00Z Fresh-clone check in a scratch dir, `cp .env.example .env` (no keys), own scratch DB: install,
  `pnpm test` 500/500 and `pnpm build` pass; `pnpm index --watch` migrates and replays (block 70,000 within a minute);
  the app serves /catalogue (honest "867 of 867 live records are still being decoded"), /ask and the APIs.
- 2026-10-29T02:32:28Z Candidate 24d7146: README, friction log, docs/demo.md. While checking the demo live, the public
  RPC's anonymous `arkiv_query` budget ran out (HTTP 429 ANON_COST_LIMITED; QA's T17 was running at the same time) and
  Ask showed a misleading 15 s timeout; Ask reads now stop at the first 429 and say so (runner only, not the parser).
  After the budget recovered, all demo questions returned rows (0.2-1.3 s). Vitest 501, Playwright 9.
- 2026-10-29T02:32:49Z Flipped to review, candidate 24d7146. Notification intent: key `2026-10-28-arkiv-agent:T08@24d7146:review`; recipient Orchestrator thread local_<session>; route Claude Code SendMessage; send once.

## Handoff

**Candidate:** `24d7146` on `feat/ship` (worktree `worktrees/arkiv-agent-ship`). Not merged. No deploy
steps anywhere; the repo stays private.

**What changed**
- **README:**
  - What ArkivAgent is, and a two-terminal local run (`pnpm index --watch`, `pnpm dev`) with honest timings:
    replay ~4 min, first decode ~2 h on the public RPC.
  - A settings table that says what `ANTHROPIC_API_KEY` switches on: Claude reads Ask questions, and dataset
    pages get AI summaries. Without it everything works.
  - Commands, how Ask reads a question, the limits it states (exact values, no sort, no count, no `$createdAt`),
    safety, and the project layout.
  - Root `pnpm start` added (`.env.example` already told people to run it).
- **arkiv/friction.md:**
  - A summary table. Its "what would help" column only repeats what each item says.
  - Item 12 relabelled "Issue", to match the legend.
  - New item 13: no sort or count.
  - A note under item 2 on the 429 behaviour.
- **docs/demo.md:**
  - Preflight, including the anonymous query budget, and a 3-minute timed script: live catalogue and sync
    indicator, dataset page, Ask chips, chip edit, follow-up, "Not used" honesty, and the refusal.
  - A table of what to do when something goes wrong. Every question was checked live.
- **Ask runner (outside the brief, flagged):** a 429 from Arkiv now aborts the read and shows "Arkiv's free query
  budget is used up… set ARKIV_API_KEY", instead of a 15 s "didn't respond". Unit-tested. The parser is unchanged.

**How to verify**
- Fresh clone: `cp .env.example .env && pnpm install && pnpm test && pnpm build`. Then `pnpm index --watch` in one
  terminal and `pnpm dev` in another; open http://localhost:3101.
- `pnpm test` (Vitest 501), then with 3101 free `pnpm test:e2e` (Playwright 9).

**Not covered**
- A full first decode from a fresh clone (~2 h). The fresh clone was checked through replay start, with pages
  serving the partial index. The shared index is the decoded result.
- README screenshots are from T04/T05. The current Ask card also shows the "Not used" row.
