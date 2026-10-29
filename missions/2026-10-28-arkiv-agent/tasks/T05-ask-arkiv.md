# T05 — Ask Arkiv + eval

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T04
- **Workspace:** worktrees/arkiv-agent-ask-arkiv, branch feat/ask-arkiv (created at release)
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] AskQuery + Zod + compiler
- [x] prompt + live read (Claude path behind ANTHROPIC_API_KEY, tested with a fake client; rules path default)
- [x] UI per T02
- [x] 20-question eval (no-key path, per A01)

## Acceptance criteria
- [x] eval >= 80% correct queries (Vitest, fixtures): 20/20 on the no-key path; held-out 11/15 first run
- [x] read-only, limit + timeout enforced (public client, no wallet; 50 per page; 15 s)
- [x] shows results, query, TS snippet, Data Explorer link (`?q=` deep link runs the same query)

## Progress log
- 2026-10-28T22:03:47Z Claimed and in-progress (c7f5b22, 4aef88d). Amendment A01: works with no key; deterministic
  question-to-query path is the default, Claude behind ANTHROPIC_API_KEY; eval runs on the no-key path.
- 2026-10-28T22:07:29Z Eval set (20 questions with expected queries) and a recorded catalogue fixture (73 datasets, block
  1,187,658) committed before the parser (87dcf3f), so the set is not fitted to it.
- 2026-10-28T22:17:41Z Milestones 1 and 4: `packages/ask` (AskQuery/AskPlan + Zod, compiler to SDK builders reusing the
  catalogue snippet, catalogue-driven interpreter, live runner). Eval 20/20. Caveat: the interpreter was designed while
  reading those 20 questions, so a 15-question held-out set was written and committed before running (20ebc8b): first
  run 11/15 (73%); misses were inflections ("withdrawals"/"withdraw", "challenge"/"challenges"), a compound
  ("downvotes") and "shift 2". After general fixes 15/15 (no longer held out). Live checks on Tiramisu: tankha/noida
  262 ms, bijlilog cuts > 3 h 303 ms; `$expiresAt` bounds take ~7 s (friction.md item 12). Vitest 11/11 in the package.
- 2026-10-28T22:20:25Z Milestone 2: Claude path (`claude.ts`) behind the key: Opus 5.5 at low effort with server-side
  fallback (same request shape as T04 descriptions, which is known-good; PLAN said Sonnet 5.5, ARKIV_AGENT_ASK_MODEL overrides),
  flat structured output, 12 candidate datasets from the catalogue ranker, on-chain text framed as data; attribute types
  always taken from the catalogue and every plan validated and compiled before running. API unreachable -> rules answer
  with a note. Example questions are generated from live datasets and checked to interpret back to them. 51 tests pass (17 in packages/ask).
- 2026-10-28T22:31:11Z Milestone 3: `/ask` per design/04 (interpretation card with editable chips, live results with
  table/cards, Query and TypeScript tabs, Data Explorer deep link, load more, follow-ups, history, `/` shortcut,
  not-understood/invalid/no-results/timeout states), `/api/ask` + `/api/ask/run`, nav link, "Ask about this dataset"
  on dataset pages, ⌘K "Ask Arkiv:" and the catalogue's "Ask Arkiv instead". Checked in the browser at 1280 and 375
  px (no sideways scroll). Vitest 52, Playwright 7. Candidate 12bdf9c.
- 2026-10-28T22:31:42Z Flipped to review (60d217b), candidate 12bdf9c. Notification intent: key `2026-10-28-arkiv-agent:T05@12bdf9c:review`; recipient Orchestrator thread local_<session>; route Claude Code SendMessage; send once.
- 2026-10-28T22:32:00Z Notification result for `2026-10-28-arkiv-agent:T05@12bdf9c:review`: sent once via SendMessage to local_<session>; tool reported delivered, message_id <id>. Do not resend.

## Handoff

**Candidate:** `12bdf9c` on `feat/ask-arkiv` (worktree `worktrees/arkiv-agent-ask-arkiv`). Not merged.
Works with no keys in `.env` (amendment A01): questions are read by catalogue rules; Claude reads them when
ANTHROPIC_API_KEY is set.

**What changed**
- `packages/ask` (new): `AskQuery`/`AskPlan` with Zod; compiler to the SDK query builders (reuses the
  catalogue's snippet builder, now `querySnippet`); the no-key interpreter (`interpret.ts`): picks the dataset
  from project labels, record kinds, attribute names and stored example values, then reads comparisons,
  units (hours to `duration_min`, `_x100` scales), time windows on the dataset's own timestamp, expiry
  windows on `$expiresAt`, owner/creator addresses, negation, OR of values, top-N; the Claude path
  (`claude.ts`, behind the key); `runAsk` (one page at a pinned block, 15 s timeout); example questions
  generated from live datasets and checked to interpret back to them.
- `apps/arkiv-agent`: `/ask`, `/api/ask` (interpret only), `/api/ask/run` (validated plan in, page out), nav link,
  "Ask about this dataset" on dataset pages (scoped), ⌘K "Ask Arkiv:", catalogue "Ask Arkiv instead", Data
  Explorer links now carry the query (`?q=`, also on dataset pages). Playwright smoke for /ask.
- `arkiv/friction.md` item 12 (slow `$expiresAt` ranges; `$createdAt` not indexed). README section and screenshot.

**How to verify**
- `pnpm install && pnpm test` (Vitest 52; the eval prints its score), then `pnpm build` and, with the app on
  3101, `pnpm test:e2e` (Playwright 7).
- Open `/ask`, click an example, edit a chip, ask a follow-up ("only with ctc over 1500000" after "tankha
  salaries in noida"), open the Query tab and the Data Explorer link.

**Eval**
- Main set (`packages/ask/test/eval-set.ts`, 20 questions over a recorded catalogue of 73 datasets): 20/20.
  It was committed before the parser (87dcf3f), but the parser was designed while reading it, so it is
  not a blind measure.
- Held-out set (15 questions, committed before running, 20ebc8b): 11/15 (73%) on its first run. The four
  misses were inflections, a compound word and "shift 2"; after general fixes it scores 15/15, so it is no
  longer held out. A fresh held-out set is the honest next measure (QA, T06).

**Deviations and limits (flagged)**
- No-key path is the default (A01). The Claude path is tested with a fake client only (no key here). It uses
  claude-opus-5-5 at low effort with server-side fallback, the request shape already used for T04
  descriptions; PLAN said Sonnet 5.5 (`ARKIV_AGENT_ASK_MODEL` overrides).
- The design's "No API key" state (input disabled) does not apply: Ask works without a key, and the page
  says which engine read the question.
- The rules need the question to name the project or the record kind, or a stored value; they don't know
  synonyms ("temperature" for `temp`). Typed values not seen among a field's examples are only read after
  "is", "=", ":" or in quotes.
- `$createdAt` is not indexed, so "from the last 7 days" works only on datasets with their own timestamp
  attribute; otherwise the explain line says it was not applied.
- `$expiresAt` bounds take ~7 s on the public node; a two-sided range did not finish in 60 s, so Ask never
  writes one (friction item 12).
- Results show the first 50 with "more available" and Load more; there is no total count (Arkiv has no count
  for a query).
- Without a dataset, only `$owner`/`$creator`/`$key` equality runs, so the server can't be used for
  chain-wide scans.
