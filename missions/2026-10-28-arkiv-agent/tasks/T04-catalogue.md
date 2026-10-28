# T04 — Data catalogue

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T02, T03
- **Workspace:** worktrees/arkiv-agent-catalogue, branch feat/catalogue (created at release)
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] inference + grouping
- [x] pages per T02
- [ ] AI descriptions (cached)
- [ ] live updates + tests

## Acceptance criteria
- [ ] every live dataset listed with schema, stats, description
- [ ] UI matches T02 specs, dark mode, updates live without refresh
- [ ] Vitest for inference/ownership; Playwright smoke per page

## Progress log
- 2026-10-28T18:03:18Z Claimed on feat/catalogue (847b6d0), in-progress (cf7cbce). Inference + grouping in @arkiv-agent/catalogue with Vitest (28 tests total). Reads the shared T03 index via DATABASE_URL (absolute path, local .env). On the live index: 188 datasets, 76 projects (load generators excluded); 30k live records still awaiting T03 decode.
- 2026-10-28T18:14:36Z List and detail pages per T02 (d7e87b8); production build serves both in ~0.2-0.3 s. At the owner's request: README with a catalogue screenshot and how to run (7c2bbee; T08 expands it). Next: AI descriptions behind ANTHROPIC_API_KEY, Playwright smoke.

## Handoff
