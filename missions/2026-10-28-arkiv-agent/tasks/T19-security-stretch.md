# T19 — Stretch: Security review of T10/T11

- **Persona:** security_whitehat
- **Model tier:** alt-frontier
- **Depends on:** T11
- **Workspace:** worktrees/arkiv-agent-security-stretch, branch review/security-stretch (from integration)

## Milestones
- [x] new routes and inputs (/pulse, /cost URL params, pnpm fees)
- [x] data exposure (public-chain only, fixtures)
- [x] report

## Acceptance criteria
- [x] severity-rated report in Handoff covering the new routes, URL inputs, fee sampler RPC use, and anything new in fixtures before the repo goes public

## Progress log
- 2026-10-29 claimed by arkiv-agent_security-whitehat_claude-code_opus-5.5-low on review/security-stretch (base d75929a). Static review only; no indexer, sampler, dev server or tests run.
- 2026-10-29 review complete: 0 High/Medium, 1 Low, 3 Info. T13 hardening holds. Moving to review.
- 2026-10-29 notify intent: T19 review candidate=90551bfbf722d61a02b1452d5fd12ada1d4df7f0 -> Orchestrator via Claude Code session route (send_message); attempt 1, result pending.

## Handoff
Static review of review/security-stretch at d75929a (T10, T11, T13, T14, T16, T18 merged). Nothing in the app was changed. Only this task file and the T19 board row were edited.

**Verdict:** no new High or Medium issues. Pulse, cost and the fee sampler only read data, and nothing new is unsafe to publish.

### L1 (Low, confidence medium): another website can make /pulse and /cost do heavy work on your machine
- Evidence: `apps/arkiv-agent/middleware.ts` checks only the Host header, which a cross-site `<img>` or `fetch(..., {mode:"no-cors"})` to `http://localhost:3101/pulse?period=90&load=1` passes. `app/pulse/page.tsx` and `app/cost/page.tsx` are `force-dynamic` and run the full `getPulse` / `feeModel` / `estimatedSpend` aggregation on every request.
- Failure: a page open in the developer's browser loops those requests and keeps the local server and SQLite busy, so ArkivAgent (and `pnpm index --watch` sharing the DB) slows down while the page stays open. It costs no money or Claude calls (the pulse AI summary is not built) and exposes no data. I did not measure the slowdown.
- Minimal fix: in middleware, refuse requests whose `sec-fetch-site` is `cross-site` unless `sec-fetch-dest` is `document` (a top-level link still works). Or cache the pulse/cost aggregates for the index cursor.

### Info
- I1, URL inputs: `/pulse` accepts only `period` in {7,30,90} and `load=1`. `/cost` clamps `writes`, `payload` and `lifetime` to bounded integers, and `unit` is allow-listed. Values reach React only as numbers or text. Project labels are rendered as escaped text with `encodeURIComponent` links. No injection path.
- I2, `pnpm fees` (`packages/indexer/src/fees.ts`): read-only. It only calls `getTransaction` and `getTransactionReceipt` through the wallet-less client, defaults to 3 req/s (ARKIV_FEE_RPS) beside the indexer, uses parameterised SQL (interpolated only for the constant `I64_MAX` and the `load` boolean) and `INSERT OR IGNORE`. `ARKIV_API_KEY` goes only to `ARKIV_RPC_URL`, as before. A non-numeric `--limit` makes LIMIT NaN, which is a usability bug, not a security one.
- I3, fixtures before going public: `packages/ask/test/fixtures/values.json` (94 KB) holds distinct attribute values per dataset taken from public Tiramisu records: hospital names, cities and insurers, drug names and batches, fintech app names, and `synthetic_*` handles. It has no emails, phone numbers, personal names, URLs or key material. The 64-hex values are `rule`/`corrects`/`lease` hashes, and the 10-digit matches in catalogue.json are dataset IDs. `packages/pulse/src/event-cohorts.json` is empty (`[]`). `packages/indexer/test/fixtures/tiramisu-window.json` has no emails or phones. Because values are stored per attribute, nothing links a person to a record. Safe to publish; mention in the README that fixtures are third-party testnet data.
- I4, T13 hardening still holds: dev/start bind to `${ARKIV_AGENT_HOST:-127.0.0.1}`. The middleware host check covers every route, including /pulse and /cost. Both POST routes call `refuseCrossSite` (JSON-only, Sec-Fetch-Site, Origin). `/api/ask` limits Claude to 20 calls/min. The AI summary calls the model only for same-origin or direct visits, and failures back off from 1 h up to 24 h. /pulse and /cost add no new POST route or model call. Note: setting `ARKIV_AGENT_HOST=0.0.0.0` opens ArkivAgent to the LAN, and `ARKIV_AGENT_ALLOWED_HOSTS` would then let those peers through, so document both as advanced, local-only settings.

### Deviations
- Static review only. I did not run the fee sampler, the indexer (as instructed), a dev server or tests. L1 is reasoned from the code.
