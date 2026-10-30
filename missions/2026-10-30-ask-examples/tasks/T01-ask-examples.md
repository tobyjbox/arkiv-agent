# T01 — Ask Arkiv: example question chips from the live catalogue

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** — (base: main, current tip)
- **Workspace:** ~/dev/worktrees/arkiv-agent-ask-examples, branch feat/ask-examples (from main; never push)
- **Port:** 3117 (3101 is the owner's running app; don't stop it)

## Inputs
- BRIEF.md (owner: chips under the box, generated from the live catalogue, coder follows existing chip style)
- design/04-ask-arkiv.md; current /ask empty state

## Milestones
- [ ] Example generator: 4–6 questions built from live catalogue datasets/attributes, each covering a different supported form (whole dataset, numeric comparison, string equality, by project/writer, recent/expiring, etc. — whatever the rules interpreter actually parses). Each must interpret without ANTHROPIC_API_KEY and return ≥1 result; skip forms with no fitting data
- [ ] UI: "Try asking" chips under "Ask a new question", shown only before a question is asked; click fills and runs; keyboard accessible; works at 375 px; a short hint line on what kinds of questions work
- [ ] Tests: unit test for the generator (every generated example interprets by rules); e2e for chips visible, click runs, hidden after a result

## Acceptance criteria
- [ ] pnpm test, typecheck, build, prod e2e green
- [ ] no regressions on /ask; no interpreter changes
- [ ] do not write session IDs (local_*) into task files or commits; use <session>

## Progress log

## Handoff
