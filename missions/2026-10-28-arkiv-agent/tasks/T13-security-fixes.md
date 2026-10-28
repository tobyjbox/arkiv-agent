# T13 — Fix T07 security findings (F07-M1, F07-L1..L3)

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T07
- **Workspace:** worktrees/arkiv-agent-security-fixes, branch feat/security-fixes
- **Port:** 3101

## Inputs
- tasks/T07-security-slice.md Handoff (M1, L1, L2, L3 with minimal fixes)

## Milestones
- [ ] M1 fix + test
- [ ] L1-L3 fixes
- [ ] self-review

## Acceptance criteria
- [ ] /api/ask rejects cross-origin requests and non-JSON content types (test proves a text/plain cross-origin POST is refused); dev/start bind 127.0.0.1 by default
- [ ] L1: on-chain names/text passed to the model are framed as untrusted data; L2: Ask timeout aborts the chain read; L3: failed descriptions are cached with backoff
- [ ] all existing tests still pass; no behaviour change on the keyless path

## Progress log

## Handoff
