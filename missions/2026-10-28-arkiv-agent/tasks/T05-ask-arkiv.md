# T05 — Ask Arkiv + eval

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T04
- **Workspace:** worktrees/arkiv-agent-ask-arkiv, branch feat/ask-arkiv (created at release)
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [ ] AskQuery + Zod + compiler
- [ ] prompt + live read
- [ ] UI per T02
- [ ] 20-question eval

## Acceptance criteria
- [ ] works with no API key (deterministic question-to-query, A01); Claude path behind ANTHROPIC_API_KEY
- [ ] eval >= 80% correct queries on the no-key path (Vitest, fixtures)
- [ ] read-only, limit + timeout enforced
- [ ] shows results, query, TS snippet, Data Explorer link

## Progress log

## Handoff
