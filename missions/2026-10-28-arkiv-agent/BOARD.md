**Mission progress:** 34 tasks — 30 merged, 1 ready, 3 draft · updated 2026-10-29T16:40:00Z
**Monitoring:** notify=granted; mode=event · declared 2026-10-28T17:02:27Z

| ID | Task | Persona | Model tier | Status | Progress | Claimed-by (identity) | Depends | Updated |
|---|---|---|---|---|---|---|---|---|
| T01 | Spike: scaffold, read checks, history, fees, DB choice | coder | frontier | merged | 4/4 | arkiv-agent_coder_claude-code_opus-5.5-extra | — | 2026-10-28T17:31:20Z |
| T02 | Visual system + catalogue/Ask specs (dark, feels live) | ux_designer | fast | merged | 4/4 | arkiv-agent_ux_designer_claude-code_opus-5.5-med | — | 2026-10-28T17:08:33Z |
| T03 | Indexer + change feed | coder | frontier | merged | 4/4 | arkiv-agent_coder_claude-code_opus-5.5-extra | T01 | 2026-10-28T17:58:09Z |
| T04 | Data catalogue | coder | frontier | merged | 4/4 | arkiv-agent_coder_claude-code_opus-5.5-extra | T02, T03 | 2026-10-28T22:03:02Z |
| T05 | Ask Arkiv + eval | coder | frontier | merged | 4/4 | arkiv-agent_coder_claude-code_opus-5.5-extra | T04 | 2026-10-28T22:32:23Z |
| T06 | QA review of slice | qa | fast | merged | 3/3 | arkiv-agent_QA_claude-code_opus-5.5-low | T05 | 2026-10-28T22:37:00Z |
| T07 | Security review of slice | security_whitehat | alt-frontier | merged | 3/3 | arkiv-agent_security-whitehat_claude-code_opus-5.5-low | T05 | 2026-10-28T22:34:47Z |
| T08 | README, friction log, demo script | coder | fast | merged | 3/3 | arkiv-agent_coder_claude-code_opus-5.5-extra | T06, T07, T13, T16 | 2026-10-29T02:33:30Z |
| T09 | Stretch: pulse + cost specs | ux_designer | fast | merged | 3/3 | arkiv-agent_ux_designer_claude-code_opus-5.5-med | T02 | 2026-10-28T17:10:46Z |
| T10 | Stretch: ecosystem pulse | coder | frontier | merged | 4/4 | arkiv-agent_coder_claude-code_opus-5.5-extra | T08, T09 | 2026-10-29T02:43:06Z |
| T11 | Stretch: cost view | coder | frontier | merged | 4/4 | arkiv-agent_coder_claude-code_opus-5.5-extra | T10 | 2026-10-29T02:56:12Z |
| T12 | Stretch: QA review of T10/T11 (pulse, cost) | qa | fast | merged | 3/3 | arkiv-agent_QA_claude-code_opus-5.5-low | T11 | 2026-10-29T03:10:00Z |
| T13 | Fix T07 findings: M1 /api/ask origin+content-type check, bind 127.0.0.1; L1 untrusted-text framing; L2 abort chain read on timeout; L3 cache failed descriptions | coder | fast | merged | 3/3 | arkiv-agent_coder_claude-code_opus-5.5-extra | T07 | 2026-10-28T22:41:56Z |
| T14 | Fix T06 findings: F1 Ask rules drop conditions, F2 'is false' negation, F3 owner-only binds wrong project; F5 e2e port/reuse, F6 time-dependent e2e, F7 verify values | coder | frontier | merged | 3/3 | arkiv-agent_coder_claude-code_opus-5.5-extra | T06, T13 | 2026-10-28T22:55:53Z |
| T15 | QA re-check: fresh blind Ask set (>= 80%) + T13/T14 fixes | qa | fast | merged | 3/3 | arkiv-agent_QA_claude-code_opus-5.5-low | T14 | 2026-10-28T23:01:56Z |
| T16 | Fix T15 findings R1-R6 (multi-clause comparisons, 'is known', whole-chain questions, 'latest', Not-used duplicates, stale-index sync label) | coder | frontier | merged | 3/3 | arkiv-agent_coder_claude-code_opus-5.5-extra | T15 | 2026-10-28T23:11:09Z |
| T17 | QA final blind Ask check (>= 80%) + R1-R6 confirm | qa | fast | merged | 3/3 | arkiv-agent_QA_claude-code_opus-5.5-low | T16 | 2026-10-29T02:47:33Z |
| T18 | Fix T17 findings: N1 EXISTS plans rejected by RPC (-32002) - never emit EXISTS the RPC can't serve, list as Not used; Q6 'not between' negation; Q5 description words binding an unrelated dataset; N4 detail e2e flake | coder | frontier | merged | 3/3 | arkiv-agent_coder_claude-code_opus-5.5-extra | T17 | 2026-10-29T02:55:18Z |
| T19 | Stretch: Security review of T10/T11 (pulse, cost, fees sampler) | security_whitehat | alt-frontier | merged | 3/3 | arkiv-agent_security-whitehat_claude-code_opus-5.5-low | T11 | 2026-10-29T02:58:36Z |
| T20 | Fix T12 S1-S3 + T19 L1 (SSR sync label, deterministic hold-out, out-of-range widening, cross-site aggregation guard) | coder | fast | merged | 2/2 | arkiv-agent_coder_claude-code_opus-5.5-extra | T12, T19 | 2026-10-29T03:30:00Z |
| T21 | Full QA review of ArkivAgent (pre-publish) | qa | fast | merged | 3/3 | arkiv-agent_QA_claude-code_opus-5.5-low | T20 | 2026-10-29T11:00:00Z |
| T22 | Full security review of ArkivAgent (pre-publish) | security_whitehat | alt-frontier | merged | 3/3 | arkiv-agent_security-whitehat_claude-code_opus-5.5-low | T20 |  2026-10-29T10:40:00Z |
| T23 | C1: quick fixes (README, postcss, Sec-Fetch, detail title, narrow sync) | coder | fast | merged | 2/2 | arkiv-agent_coder_claude-code_opus-5.5-extra | T21, T22 | 2026-10-29T12:40:00Z |
| T24 | C2: code fixes (M1 schema-shape query, M2 no-index page, M3 non-blocking price, L3 e2e) | coder | frontier | merged | 3/3 | arkiv-agent_coder_claude-code_opus-5.5-extra | T21 | 2026-10-29T13:10:00Z |
| T25 | UX: decoding banner -> futuristic progress bar (spec) | ux_designer | fast | merged | 2/2 | arkiv-agent_ux_designer_claude-code_opus-5.5-med | — | 2026-10-29T12:10:00Z |
| T26 | Build decode progress bar (design/07) | coder | fast | merged | 1/1 | arkiv-agent_coder_claude-code_opus-5.5-extra | T25, T24 | 2026-10-29T14:00:00Z |
| T27 | GLM/USDT price chart on /financials | coder | fast | merged | 1/1 | arkiv-agent_coder_claude-code_opus-5.5-extra | T24 | 2026-10-29T14:40:00Z |
| T28 | Part A: remove arkiv-agent everywhere -> arkiv-agent (mechanical) | coder | fast | merged | 1/1 | arkiv-agent_coder_claude-code_opus-5.5-extra | T27 | 2026-10-29T15:20:00Z |
| T29 | Drop pre-rename compatibility; seed spot price from chart history | coder | fast | merged | 1/1 | arkiv-agent_coder_claude-code_opus-5.5-extra | T28 | 2026-10-29T16:00:00Z |
| T30 | B1: db package owns all database access | coder | frontier | merged | 1/1 | arkiv-agent_coder_claude-code_opus-5.5-extra | T29 | 2026-10-29T16:40:00Z |
| T31 | B2: shared projects module | coder | fast | merged | 1/1 | arkiv-agent_coder_claude-code_opus-5.5-extra | T30 | 2026-10-29T16:26:41Z |
| T32 | B3: Ask interpret() as a pipeline | coder | frontier | ready | 0/1 | | T31 | 2026-10-29T16:26:41Z |
| T33 | B4: indexer stores Insights/Financials aggregates | coder | frontier | ready | 0/1 | | T31 | 2026-10-29T16:26:41Z |
| T34 | B5+B6: thin pages, PriceSource in cost, remove spike code | coder | fast | draft | 0/1 | | T32, T33 | 2026-10-29T16:00:00Z |
