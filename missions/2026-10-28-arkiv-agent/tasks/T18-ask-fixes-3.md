# T18 — Fix T17 QA findings (N1, Q5, Q6, N4)

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T17
- **Workspace:** worktrees/arkiv-agent-ask-fixes-3, branch feat/ask-fixes-3
- **Port:** 3101
- **Priority:** before T11 (must-ship slice quality over stretch)

## Inputs
- tasks/T17-qa-final.md Handoff, T17-blind-results.txt, T17-t15-rerun.txt

## Milestones
- [ ] N1
- [ ] Q5, Q6, N4
- [ ] self-review

## Acceptance criteria
- [ ] N1: no plan the RPC rejects reaches the user as an error; EXISTS/NOT EXISTS used only if the RPC supports them (verify live), otherwise the condition is listed as Not used with a reason; unparsed numbers never become EXISTS(x)
- [ ] Q6: "not between" negates the range
- [ ] Q5: description words don't bind an unrelated dataset
- [ ] N4: dataset-detail e2e stable over 5 runs
- [ ] all tests pass; no re-tuning to T17 questions beyond these general fixes

## Progress log

## Handoff
