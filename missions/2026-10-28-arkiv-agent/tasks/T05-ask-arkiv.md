# T05 — Ask Arkiv + eval

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T04
- **Workspace:** worktrees/arkiv-agent-ask-arkiv, branch feat/ask-arkiv (created at release)
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] AskQuery + Zod + compiler
- [x] prompt + live read (Claude path behind ANTHROPIC_API_KEY, tested with a fake client; rules path default)
- [ ] UI per T02
- [x] 20-question eval (no-key path, per A01)

## Acceptance criteria
- [ ] eval >= 80% correct queries (Vitest, fixtures)
- [ ] read-only, limit + timeout enforced
- [ ] shows results, query, TS snippet, Data Explorer link

## Progress log
- 2026-10-28T22:03:47Z Claimed and in-progress (c7f5b22, 4aef88d). Amendment A01: works with no key; deterministic
  question-to-query path is the default, Claude behind ANTHROPIC_API_KEY; eval runs on the no-key path.
- 2026-10-28T22:07:29Z Eval set (20 questions with expected queries) and a recorded catalogue fixture (73 datasets, block
  1,187,658) committed before the parser (87dcf3f), so the set is not fitted to it.
- 2026-10-28T22:17:41Z Milestones 1 and 4: `packages/ask` (AskQuery/AskPlan + Zod, compiler to SDK builders reusing the
  catalogue snippet, catalogue-driven interpreter, live runner). Eval 20/20. Caveat: the interpreter was designed while
  reading those 20 questions, so a 15-question held-out set was written and committed before running (20ebc8b): first
  run 11/15 (73%); misses were inflections ("withdrawals"/"withdraw", "challenge"/"challenges"), a compound
  ("downvotes") and "shift 2". After general fixes 15/15 (no longer held out). Live checks on Tiramisu: tankha/noida
  262 ms, bijlilog cuts > 3 h 303 ms; `$expiresAt` bounds take ~7 s (friction.md item 12). Vitest 11/11 in the package.
- 2026-10-28T22:20:25Z Milestone 2: Claude path (`claude.ts`) behind the key: Opus 5.5 at low effort with server-side
  fallback (same request shape as T04 descriptions, which is known-good; PLAN said Sonnet 5.5, ARKIV_AGENT_ASK_MODEL overrides),
  flat structured output, 12 candidate datasets from the catalogue ranker, on-chain text framed as data; attribute types
  always taken from the catalogue and every plan validated and compiled before running. API unreachable -> rules answer
  with a note. Example questions are generated from live datasets and checked to interpret back to them. 51 tests pass (17 in packages/ask).

## Handoff
