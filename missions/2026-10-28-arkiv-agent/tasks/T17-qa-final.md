# T17 — QA final blind Ask check

- **Persona:** qa
- **Model tier:** fast
- **Depends on:** T16
- **Workspace:** review/qa-final from integration (created at release)
- **Port:** 3102

## Milestones
- [x] fresh blind set committed before running
- [x] run + R1-R6 confirm
- [x] report

## Acceptance criteria
- [x] new ~15-question blind set, committed pre-run, different from T06/T15; result reported; >= 80% or findings
- [x] R1-R6 confirmed

## Progress log
- 2026-10-28T23:11Z claimed; blind set committed pre-run (4962e22; the first push was rejected by GitHub with no reason, and the retry succeeded).
- 2026-10-28T23:15Z first run on review/qa-final: same compiled queries as below. A rerun then timed out on every /api/ask/run (direct RPC healthy; likely the anonymous 429 budget, then reported as a timeout). Stalled here with no log line (my miss) until the Orchestrator's 02:43Z check-in.
- 2026-10-29T02:47:01Z scored on integration head aea7b88 (read-only scratch clone, not merged into this branch: merging is outside my grant). Budget available; no question was budget-blocked. Handoff written; -> review.

## Handoff
Scored on **integration head aea7b88** (origin/mission/2026-10-28-arkiv-agent, with T08's 429 handling), in a read-only scratch clone with keyless .env and a snapshot of the shared index, on port 3102. I didn't merge it into review/qa-final, because my grant excludes merges. Fresh clone: 505/505 vitest, build OK. Evidence: tasks/T17-blind-questions.md (pre-run, 4962e22), T17-blind-results.txt, T17-t15-rerun.txt.

### Score: 13/15 (87%) on the pre-committed rule; 11/15 (73%) if a run error counts as a miss
Budget-blocked: 0 (the T08 429 message never fired on this run).
- Pass: Q2 Q3 Q4 Q7 Q8 Q9 Q10 Q11 Q12 Q13 Q15, plus Q1 and Q14 on the query rule (see N1).
- **Q5 fail:** "water quality observations in Purulia" gives tagwitness-v1/observation; all words are listed as Not used, but the dataset is unrelated (jalsaakshya/v1 obs has district=Purulia).
- **Q6 fail:** "penalty_inr is not between 1000 and 5000" gives the between range itself (`>=1000 AND <=5000`), with only "not" listed as Not used. The user gets the opposite set, flagged only by one word.
- Q12 passes by the rule, but "expiry_ym equal to 202701" is a plain equality on a known attribute and was entirely Not used.

### New findings
- **N1 medium: any plan with EXISTS fails at the RPC.** Q1 "x at most ten" falls back to `EXISTS(x)` and Q14 "v of exactly -1" to `EXISTS(v)`; T15-Q13 now compiles to `NOT EXISTS(parent_key)`. All three return `rpc: Query rejected (type, -32002): Requested resource not available`, reproducible across runs and restarts, while the same dataset without EXISTS returns rows. Either the SDK/RPC doesn't support EXISTS, or it is compiled wrongly. Fix: stop emitting EXISTS as a fallback (list the words as Not used instead) and handle explicit absence differently.
- **N2 medium: "not between" is inverted** (Q6).
- **N3 low: description-style dataset match** (Q5) picks an unrelated dataset when the words aren't in any name.
- **N4 low: the dataset-detail e2e test is flaky** in full-suite runs (failed 1 of 5 full runs; passed 3/3 when run alone). Not diagnosed.
- **N5 low:** the overflow error reads `"1e+23" is not a non-negative whole number`. It is safe (no wrapped number), but it shows the user's number in float form.

### R1-R6 (T15 set re-run on aea7b88)
- R1 fixed: `x > 10 AND y < 3`.
- R2 fixed: `expiry_known = true`.
- R3 fixed: a catch-all question now gets "No dataset in the catalogue matches…".
- R4 fixed: "latest" is listed as Not used; limit 5 still applies.
- R5 fixed: no spurious Not used.
- R6 fixed: the indicator separates stale ("The index is not updating.") from offline. The catalogue list e2e passed in all full runs against a static index.
- Side effect: T15-Q13 is now applied as NOT EXISTS, which hits N1.

Next owner: Orchestrator (decision against the 80% bar; N1/N2 to coder if pursued).
- 2026-10-29T02:47:01Z notify intent: T17 review candidate=43db1dd735cc718e0b207e415b9b3fbb8ebc55f1 to Orchestrator local_<session> via ccd send_message; attempt 1.
- 2026-10-29T02:47:14Z notify result: delivered (message_id <id>).
