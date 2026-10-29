# T22 — Full security review of ArkivAgent (pre-publish)

- **Persona:** security_whitehat
- **Model tier:** alt-frontier
- **Depends on:** T20 (base: local main 94b12a5)
- **Workspace:** worktrees/arkiv-agent-security-full, branch review/security-full (from main)

## Inputs
- Whole repo at main; prior reports T07, T19 (confirm M1, L1-L3, T19 L1 fixes hold)
- New since T19: outbound GLM price fetch (apps/arkiv-agent/lib/glm-price.ts; CoinGecko, Binance fallback)
- Repo is about to go public: history was rewritten 2026-10-29 to remove local paths

## Milestones
- [ ] all routes, inputs, middleware, Claude path, indexer/RPC, outbound requests
- [ ] publish readiness: secrets and personal data in tree and full history, fixtures, dependencies (pnpm audit)
- [ ] report

## Acceptance criteria
- [ ] severity-rated report in Handoff with evidence; clear go/no-go for making the repo public
- [ ] static review plus targeted checks; no app changes

## Progress log

## Handoff
