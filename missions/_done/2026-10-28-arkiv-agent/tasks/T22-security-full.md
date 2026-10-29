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
- [x] all routes, inputs, middleware, Claude path, indexer/RPC, outbound requests
- [x] publish readiness: secrets and personal data in tree and full history, fixtures, dependencies (pnpm audit)
- [x] report

## Acceptance criteria
- [x] severity-rated report in Handoff with evidence; clear go/no-go for making the repo public
- [x] static review plus targeted checks; no app changes

## Progress log
- 2026-10-29 claimed by arkiv-agent_security-whitehat_claude-code_opus-5.5-low on review/security-full (from local main d3b4fd7). Static review, plus read-only checks: full-history grep, `pnpm audit --prod`, and GitHub API reads of pre-rewrite SHAs. No app changes, no indexer run.
- 2026-10-29 review complete: NO-GO until H1 is resolved; 1 High, 2 Low, 4 Info. Moving to review.

## Handoff
Review of local main d3b4fd7 (app base 94b12a5), all 235 commits on every local ref, and the GitHub remote `tobyjbox/arkiv-agent` (private, 0 forks). No app changes.

## Go/no-go: NO-GO for flipping this GitHub repo to public as it stands
The code is fine to publish. The blocker is GitHub's copy of the old history (H1). Resolve H1, then it's a GO. L1 and L2 are optional before publishing.

### H1 (High, confidence high): GitHub still serves the commits from before the rewrite, with the personal data it removed
- Evidence: all 12 of 12 sampled old SHAs from `<checkpoints>/arkiv-agent/history-rewrite-2026-10-28-commit-map.txt` answer on `GET /repos/tobyjbox/arkiv-agent/commits/<sha>` (e.g. 0e42e3a). That commit's author email is the real address, not the noreply one. Its tree has home paths in 6 files and job-application terms in 4 files (counts only; contents not copied). The later T07/T19 SHAs (0f57bd0, 90551bf) also still resolve, with orchestrator session IDs and `<worktrees>` paths that the 10-29 rewrite removed.
- Failure: once the repo is public, anyone can open `github.com/tobyjbox/arkiv-agent/commit/<old sha>` and read or download that tree. The old SHAs aren't secret: this repo's own MISSION_LOG names some (e.g. "old key 6027a1c"), and GitHub accepts short prefixes. The force-push removed the commits from branches, not from GitHub's object store.
- Minimal fix (pick one before publishing): (a) **simplest:** create a new GitHub repo and push only the rewritten `main` (and any branches you want), then delete or keep private the old repo; or (b) keep this repo but ask GitHub Support to purge unreferenced objects and cached views (their "Removing sensitive data" process), then re-run this SHA check. Either way, check that no fork or open PR refs hold old commits (forks: 0 today).

### L1 (Low, confidence high): `pnpm audit --prod` reports 2 high and 2 moderate advisories, all in postcss bundled with next
- Evidence: `apps__arkiv-agent>next>postcss` is below 8.5.23 (GHSA-fxqj-rqcc-2cmp and three related advisories: source-map file read, path traversal, `</style>` XSS in stringify).
- Failure: these need attacker-controlled CSS or source maps going through PostCSS. ArkivAgent compiles only its own CSS at build time, so there is no path today. The audit badge on a public repo will still flag it, and a later dependency that feeds third-party CSS would make it live.
- Minimal fix: add `"pnpm": {"overrides": {"postcss": ">=8.5.23"}}` to the root package.json (or bump next once it ships the fix), then re-run `pnpm audit --prod`.

### L2 (Low, confidence medium): the T19 L1 fix depends on Sec-Fetch headers
- Evidence: `apps/arkiv-agent/middleware.ts` refuses cross-site loads of /pulse and /cost only when `sec-fetch-site` is present.
- Failure: a browser that doesn't send Fetch Metadata (Safari before 16.4, some embedded webviews) can still be made to hammer the heavy pages from another site. Local slowdown only, as in T19.
- Minimal fix: optional; cache the aggregates by index cursor so repeated loads are cheap. The middleware also has a leftover duplicate doc comment (cosmetic).

### Info
- I1, secrets: none. Every commit on all local refs has no Anthropic, GitHub or AWS keys, no private keys, and no `.env`, `.db`, `data/` or `.pem` files. All 235 commits use the GitHub noreply author email. `.env.example` has empty values.
- I2, personal data in the rewritten tree: no home paths, emails or job-application content. Remaining owner references are the intended public repo URL (`apps/arkiv-agent/app/layout.tsx`), the repo name in BRIEF.md, and one `<checkpoints>/...` path in T04's handoff (harmless, but you may want to trim it). `missions/` records agent workflow and owner quotes, so read it once and decide whether it belongs in the public repo. Fixtures are as in T19 (public testnet values only; "Recruitment" is a third-party attribute value).
- I3, outbound GLM price fetch (`apps/arkiv-agent/lib/glm-price.ts`): fixed CoinGecko/Binance URLs with no user input, 3 s timeout, results cached for 10 min (failures for 1 min), and the price must be a finite positive number. It is server-side, so visiting /cost sends the machine's IP to CoinGecko/Binance roughly every 10 min. A bad or hostile price API can only skew displayed USD figures (there's no upper sanity bound). Consider an env switch to turn it off and a README note.
- I4, earlier fixes still hold: T07 M1 (binds 127.0.0.1, host allow-list, `refuseCrossSite` on both POSTs, 20 Claude calls/min), L1 (names and labels clipped to 64 chars, `cleanModelText` strips links and hex from explain and summary), L2 (the Ask read is aborted through an AbortSignal), L3 (failure backoff) and T19 L1 (heavy-page cross-site refusal, `frame-ancestors 'none'`). The GET APIs send no CORS headers, so other sites can't read them.

### Deviations
- I didn't push review/security-full before writing this, because local main is unpushed. The branch push (done with this handoff) also uploads the local main commits up to d3b4fd7 to GitHub as part of this branch.
- I found no pre-10-28 history locally (pruned), so I checked H1 against GitHub through the commit map. I fetched one old commit into a scratch bare repo outside the project to count matches. I copied none of its contents.
