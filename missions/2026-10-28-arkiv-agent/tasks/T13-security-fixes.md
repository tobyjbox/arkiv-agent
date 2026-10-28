# T13 — Fix T07 security findings (F07-M1, F07-L1..L3)

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T07
- **Workspace:** worktrees/arkiv-agent-security-fixes, branch feat/security-fixes
- **Port:** 3101

## Inputs
- tasks/T07-security-slice.md Handoff (M1, L1, L2, L3 with minimal fixes)

## Milestones
- [x] M1 fix + test
- [x] L1-L3 fixes
- [x] self-review

## Acceptance criteria
- [x] /api/ask rejects cross-origin requests and non-JSON content types (test proves a text/plain cross-origin POST is refused); dev/start bind 127.0.0.1 by default
- [x] L1: on-chain names/text passed to the model are framed as untrusted data; L2: Ask timeout aborts the chain read; L3: failed descriptions are cached with backoff
- [x] all existing tests still pass; no behaviour change on the keyless path

## Progress log
- 2026-10-28T22:35:54Z Claimed and in-progress (4bf0f81, 8643707). The branch copy predated T13, so the task file and
  the T13 row were brought over from origin/main; no other rows touched.
- 2026-10-28T22:40:47Z All three milestones. Candidate acccb24. Vitest 62 (was 52), Playwright 8 (was 7). Checked on the
  running build: LAN address refuses connections, a foreign Host gets 421, a text/plain cross-origin POST gets 415;
  ARKIV_AGENT_ALLOWED_HOSTS checked on a temporary server (listed host 200, other 421).
- 2026-10-28T22:41:16Z Flipped to review (3d29106), candidate acccb24. Notification intent: key `2026-10-28-arkiv-agent:T13@acccb24:review`; recipient Orchestrator thread local_<session>; route Claude Code SendMessage; send once.

## Handoff

**Candidate:** `acccb24` on `feat/security-fixes` (worktree `worktrees/arkiv-agent-security-fixes`). Not merged.

**What changed, by finding**
- **M1:** `apps/arkiv-agent/lib/guard.ts` `refuseCrossSite` on both POST routes:
  - application/json only (415): a web page's preflight-free "simple" POST is refused.
  - `Sec-Fetch-Site` must be same-origin or none, and `Origin` (when sent) must match the Host (403).
  - `middleware.ts` refuses any Host that isn't localhost, 127.0.0.1 or [::1] (421) on every route, so a
    DNS-rebinding page can't pass the Origin check under its own name. `ARKIV_AGENT_ALLOWED_HOSTS` adds names.
  - `dev`/`start` bind `${ARKIV_AGENT_HOST:-127.0.0.1}`. ARKIV_AGENT_HOST rather than HOST, because zsh sets HOST to the
    machine name.
  - The Claude path on `/api/ask` is limited to 20 calls a minute per process (429). The keyless path has
    no limit.
  - Beyond the finding: a dataset page loaded from another site (`Sec-Fetch-Site: cross-site`) shows only
    a cached AI summary and never calls the model.
- **L1:**
  - Dataset names and project labels are clipped to 64 characters before they reach the model, in both the
    Ask candidate list and the describe input. Attribute names are at most 32 bytes on Arkiv, so they are
    sent unchanged (Ask must match them exactly).
  - `cleanModelText` removes URLs and long hex from Ask's `explain` notes and from the describe
    `summary`/`likelyUse` before they are stored or shown.
  - Ask now marks Claude's notes as model output. The existing "Model output" caption on AI summaries stays.
- **L2:** `runAsk(connect, …)` builds one client per read, with an AbortSignal passed through viem's
  `fetchOptions` (`createArkivClient(…, { signal, retryCount })`). The 15 s timeout aborts the read.
  Ask reads retry once; the indexer keeps 5.
- **L3:** `createFailureBackoff` in `describe-store.ts` waits 1 h after a failed description (refusal or
  error), doubling to a day per dataset and schema hash. A schema change or a success resets it.

**How to verify**
- `pnpm test`: 62 tests, including `apps/arkiv-agent/lib/guard.test.ts` (text/plain cross-origin 415, cross-origin
  and same-site 403, DNS rebinding 421), `packages/ask/test/run.test.ts` (the timeout aborts the read) and the
  L1/L3 tests in `packages/catalogue/test/describe.test.ts`.
- `pnpm build`, then with the app on 3101: `pnpm test:e2e` (8). The new e2e test sends the text/plain
  cross-origin POST to the running server.
- `curl -X POST -H 'Content-Type: text/plain' -H 'Origin: https://evil.example' -d '{"question":"x"}' http://localhost:3101/api/ask` returns 415.

**Deviations and notes**
- The failure backoff is in memory, so a restart allows one more try per failing dataset. Persisting it
  would need a migration while the app holds the DB.
- Binding to 127.0.0.1 changes how ArkivAgent is reached: from another device, use
  `ARKIV_AGENT_HOST=0.0.0.0 ARKIV_AGENT_ALLOWED_HOSTS=<name> pnpm start` (documented in `.env.example`). The keyless Ask
  and catalogue behave as before (all e2e tests pass unchanged).
- QA (T06) on port 3102: `localhost:3102` passes the Host check. A reviewer opening the app by LAN IP needs
  ARKIV_AGENT_ALLOWED_HOSTS.
