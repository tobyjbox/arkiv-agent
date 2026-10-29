# T32 — B3: split Ask interpret() into a pipeline

- **Persona:** coder · **Model tier:** frontier · **Depends on:** T31
- **Workspace:** <worktrees>/arkiv-agent-b3, branch refactor/b3-interpret (from local main)
- **Plan:** Part B, B3

## Acceptance criteria
- [ ] tokenize -> pick dataset -> list of condition parsers (comparison, negation, between, presence, time, latest), each with its own tests -> build plan
- [ ] no function over ~80 lines in packages/ask/src
- [ ] every existing Ask question set (eval, held-out, unseen, unseen16) gives identical plans; tests, build, prod e2e pass; don't push

## Progress log

## Handoff
