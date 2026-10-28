# T14 — Fix T06 QA findings (F06-1..3, F06-5..7)

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T06, T13 (same session; avoids /api/ask overlap)
- **Workspace:** worktrees/arkiv-agent-ask-fixes, branch feat/ask-fixes (created at release)
- **Port:** 3101

## Inputs
- tasks/T06-qa-slice.md Handoff, T06-blind-questions.md, T06-blind-results.txt

## Milestones
- [ ] F1-F3 parser fixes (general, not tuned to the T06 set)
- [ ] F5-F7 test hygiene
- [ ] self-review

## Acceptance criteria
- [ ] F1: a condition the rules can't parse is never silently dropped; the UI says what was ignored or refuses
- [ ] F2: negations ("is false", "not") compile correctly, with tests
- [ ] F3: owner-only questions aren't bound to an unrelated project
- [ ] F5: Playwright uses a configurable port and doesn't reuse a foreign server; F6: no wall-clock-dependent assertions; F7: verify compares values for sampled attributes
- [ ] all tests pass; QA re-measures blind accuracy in T15 (fixes must generalise, not fit the seen T06 set)

## Progress log

## Handoff
