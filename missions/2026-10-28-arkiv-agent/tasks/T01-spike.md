# T01 — Spike: scaffold, read checks, history, fees, DB choice

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** —
- **Workspace:** worktrees/arkiv-agent-spike, branch feat/spike
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [ ] scaffold (pnpm workspace, .gitignore with .env, .env.example)
- [ ] read checks (page all live entities, timing)
- [ ] history + fee data checks
- [ ] go/no-go notes + DB choice

## Acceptance criteria
- [ ] pnpm workspace per docs/PLAN.md layout builds; .env gitignored, .env.example present, no secrets committed
- [ ] arkiv/friction.md records: time to page all live entities, how far back events/receipts go, whether fees depend on lifetime (measured if a wallet is in .env, else from observed receipts, gap noted)
- [ ] DB choice (SQLite preferred, else Postgres in Docker; no Neon) with reason
- [ ] explicit go/no-go per check, and what scope a no-go removes

## Progress log

## Handoff
