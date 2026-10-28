**Mission progress:** 12 tasks — 0 merged, 2 ready, 10 draft (T09-T12 stretch) · updated 2026-10-28T17:02:27Z
**Monitoring:** notify=granted; mode=event · declared 2026-10-28T17:02:27Z

| ID | Task | Persona | Model tier | Status | Progress | Claimed-by (identity) | Depends | Updated |
|---|---|---|---|---|---|---|---|---|
| T01 | Spike: scaffold, read checks, history, fees, DB choice | coder | frontier | ready | 0/4 | | — | 2026-10-28T17:02:27Z |
| T02 | Visual system + catalogue/Ask specs (dark, feels live) | ux_designer | fast | review | 4/4 | arkiv-agent_ux_designer_claude-code_opus-5.5-med | — | 2026-10-28T17:07:47Z |
| T03 | Indexer + change feed | coder | frontier | review | 4/4 | arkiv-agent_coder_claude-code_opus-5.5-extra | T01 | 2026-10-28T17:57:31Z |
| T04 | Data catalogue | coder | frontier | review | 4/4 | arkiv-agent_coder_claude-code_opus-5.5-extra | T02, T03 | 2026-10-28T20:02:29Z |
| T05 | Ask Arkiv + eval | coder | frontier | review | 4/4 | arkiv-agent_coder_claude-code_opus-5.5-extra | T04 | 2026-10-28T22:31:11Z |
| T06 | QA review of slice | qa | fast | draft | 0/3 | | T05 | 2026-10-28T17:02:27Z |
| T07 | Security review of slice | security_whitehat | alt-frontier | review | 3/3 | arkiv-agent_security-whitehat_claude-code_opus-5.5-low | T05 | 2026-10-28T22:34:11Z |
| T08 | README, friction log, demo script | coder | fast | draft | 0/3 | | T06, T07 | 2026-10-28T17:02:27Z |
| T09 | Stretch: pulse + cost specs | ux_designer | fast | review | 3/3 | arkiv-agent_ux_designer_claude-code_opus-5.5-med | T02 | 2026-10-28T17:10:26Z |
| T10 | Stretch: ecosystem pulse | coder | frontier | draft | 0/4 | | T08, T09 | 2026-10-28T17:02:27Z |
| T11 | Stretch: cost view | coder | frontier | draft | 0/4 | | T10 | 2026-10-28T17:02:27Z |
| T12 | Stretch: QA + Security review of T10/T11 | qa, security_whitehat | fast, alt-frontier | draft | 0/3 | | T11 | 2026-10-28T17:02:27Z |
| T13 | Fix T07 findings: M1 /api/ask origin+content-type check, bind 127.0.0.1; L1 untrusted-text framing; L2 abort chain read on timeout; L3 cache failed descriptions | coder | fast | in-progress | 0/3 | arkiv-agent_coder_claude-code_opus-5.5-extra | T07 | 2026-10-28T22:35:54Z |
