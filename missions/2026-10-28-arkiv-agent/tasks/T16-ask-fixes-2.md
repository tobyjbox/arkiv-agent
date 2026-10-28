# T16 — Fix T15 QA findings (R1-R6)

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T15
- **Workspace:** worktrees/arkiv-agent-ask-fixes-2, branch feat/ask-fixes-2
- **Port:** 3101

## Inputs
- tasks/T15-qa-recheck.md Handoff, T15-blind-results.txt

## Milestones
- [ ] R1-R3 (parser)
- [ ] R4-R6
- [ ] self-review

## Acceptance criteria
- [ ] R1: multi-clause comparisons joined by and/or keep every clause with its own attribute and value
- [ ] R2/R4: "is known", "latest" either applied or listed as Not used; never silently ignored
- [ ] R3: whole-chain questions aren't bound to a single dataset
- [ ] R5: an applied attribute is not also listed as Not used
- [ ] R6: a static (non-watching) index shows a truthful sync state, not "can't reach the index"; e2e list test passes
- [ ] fixes generalise (T17 measures on another unseen set); all tests pass

## Progress log

## Handoff
