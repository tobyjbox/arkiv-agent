# T04 — Data catalogue

- **Persona:** coder
- **Model tier:** frontier
- **Depends on:** T02, T03
- **Workspace:** worktrees/arkiv-agent-catalogue, branch feat/catalogue (created at release)
- **Port:** 3101

## Inputs
- ../BRIEF.md, ../PLAN.md, docs/PLAN.md (technical design)

## Milestones
- [x] inference + grouping
- [x] pages per T02
- [x] AI descriptions (cached) — built and tested with a fake client; live generation off (no API key, the owner's call)
- [x] live updates + tests

## Acceptance criteria
- [ ] every live dataset listed with schema, stats, description
- [ ] UI matches T02 specs, dark mode, updates live without refresh
- [ ] Vitest for inference/ownership; Playwright smoke per page

## Progress log
- 2026-10-28T18:03:18Z Claimed on feat/catalogue (847b6d0), in-progress (cf7cbce). Inference + grouping in @arkiv-agent/catalogue with Vitest (28 tests total). Reads the shared T03 index via DATABASE_URL (absolute path, local .env). On the live index: 188 datasets, 76 projects (load generators excluded); 30k live records still awaiting T03 decode.
- 2026-10-28T18:14:36Z List and detail pages per T02 (d7e87b8); production build serves both in ~0.2-0.3 s. At the owner's request: README with a catalogue screenshot and how to run (7c2bbee; T08 expands it). Next: AI descriptions behind ANTHROPIC_API_KEY, Playwright smoke.
- 2026-10-28T18:37:57Z AI descriptions built and tested with a fake client (aeefaaa): claude-opus-5-5, low effort, fallbacks "default", Zod output, untrusted-data framing, cached per schema hash; detail page streams the card, list and search use cached summaries; `pnpm describe` pre-generates. Not verified against the real API: ANTHROPIC_API_KEY is not in .env.
- 2026-10-28T18:37:57Z Live updates verified in the browser (feed cursor advances, list refetches every change); Playwright smoke 4/4 (173f51b); Vitest 34/34. Fixed a silent decode stall from entities with thousands of patches (6027a1c); watch indexer now runs from this worktree against the shared index, decoding ~10/s (~37.6k left, about 1 h).
- 2026-10-28T18:37:57Z BLOCKED on milestone 3: real AI descriptions need ANTHROPIC_API_KEY in .env. Owner of next action: the owner (add the key). Then Coder runs `pnpm describe`, checks the AI cards on list and detail pages, ticks milestone 3 and flips to review. Everything else in T04 is done and pushed (feat/catalogue @ 6027a1c).
- 2026-10-28T18:38:06Z Notification intent: key `2026-10-28-arkiv-agent:T04@0e42e3a:blocked`; recipient Orchestrator (arkiv-agent) thread local_<session> (from `ak-orch.sh thread arkiv-agent`); route Claude Code session message; state: pending.
- 2026-10-28T18:38:26Z Notification result for `2026-10-28-arkiv-agent:T04@0e42e3a:blocked`: sent once via SendMessage to local_<session>; tool reported delivery: delivered (turn started), message_id <id>; read not confirmed. Do not resend.
- 2026-10-28T20:02:12Z The owner, directly: "no I am not doing that now. We need to finish without this." (re adding ANTHROPIC_API_KEY). Finishing T04 without live AI descriptions: the code stays in, off without a key; pages show the design's no-key state. Flipping blocked -> review, candidate 6027a1c.
- 2026-10-28T20:02:29Z Decode complete (738 datasets, 288 projects). Flipped to review, candidate 6027a1c. Notification intent: key `2026-10-28-arkiv-agent:T04@6027a1c:review`; recipient Orchestrator thread local_<session>; route Claude Code session message; state: pending.
- 2026-10-28T21:31:50Z Notification result for `2026-10-28-arkiv-agent:T04@6027a1c:review`: sent once via SendMessage to local_<session>; tool reported delivery: delivered (turn started), message_id <id>; read not confirmed. Do not resend.
- 2026-10-28T22:00:00Z History rewrite, at the owner's direct request: personal references and job-application
  details removed from every commit on all 7 branches (git filter-repo; names -> "the owner", local home paths -> `~`,
  author email -> GitHub noreply). Force-pushed atomically with leases; local branches and worktrees realigned; old
  objects pruned locally. All SHAs changed: T04 candidate 6027a1c is now 8b764dd (same tree content apart from the
  cleaned docs). Old -> new map and a local backup bundle: `<checkpoints>/arkiv-agent/history-rewrite-2026-10-28-*`.

## Handoff

**Candidate:** `8b764dd` (was `6027a1c` before the history rewrite) on `feat/catalogue` (worktree `worktrees/arkiv-agent-catalogue`). Not merged.
Finished without live AI descriptions at the owner's direction (no ANTHROPIC_API_KEY): see the first deviation.

**What changed**
- `packages/catalogue` (new): dataset inference (project label or writer, then kind/type, else
  normalized shape), schema with presence and examples, ownership (app/user/mixed), label conflicts,
  load-generator flag; cached loader (stale-while-revalidate, 10 s); SDK snippets rendered by the SDK;
  AI descriptions with a schema-hash cache (`DatasetDescription` table + migration); `pnpm describe`.
- `apps/arkiv-agent`: T02 visual system as Tailwind v4 tokens, self-hosted Inter and JetBrains Mono, app shell
  (nav, sync indicator, ⌘K palette, footer), `/catalogue` (stat tiles, search, filters and sort in the
  URL, live rows with flashes and held reorders, decoding banner), `/catalogue/[id]` (attribution and
  conflict flag, live stats, schema, 7-day activity, live recent records, SDK snippet, streamed AI card),
  `/api/catalogue`, `/api/datasets/[id]`, Playwright smoke tests, screenshot script.
- `packages/indexer`: heavily patched entities read live; re-decode throttle; migrations only when
  pending; decode-rate logging and batch time limit. `arkiv/friction.md` item 11.
- `README.md` with a catalogue screenshot, at the owner's request (T08 expands it).

**How to verify**
- `pnpm install && pnpm build && pnpm test` (Vitest 34), then with the app on 3101: `pnpm test:e2e` (Playwright 4).
- `pnpm index --watch` beside `pnpm start` (or `pnpm dev`); the list and detail pages update without refresh.
- With ANTHROPIC_API_KEY set: `pnpm describe --limit 20`, then check the AI cards.

**Deviations from the specs (flagged)**
- **Acceptance "every live dataset listed with schema, stats, description": descriptions are not
  generated.** The owner chose to finish without an API key. The description pipeline is built and tested
  with a fake client and turns on when ANTHROPIC_API_KEY is set (`pnpm describe` fills the cache).
  Without it, rows show schema chips only and the detail card says "No AI summary yet. The schema below
  is read directly from Arkiv." (the design's no-key state). T05 (Ask Arkiv) also calls Claude, so it
  hits the same gap.
- Activity chart offers 24h and 7d, not 30d: only 7 days of history carry decoded attributes.
- "Open Data Explorer" links to data.arkiv.network's home page (no deep-link format known).
- Not built yet: Ask Arkiv entries (⌘K "Ask:", "Ask Arkiv instead" in no-results; T05), the
  announcement on/off setting (Pattern 6), skeleton min-time rules (Pattern 2), streaming rows into the
  "Building the index" panel (it is a static panel).
- AI model is claude-opus-5-5 (the design caption said Haiku as an example), configurable with
  ARKIV_AGENT_DESCRIBE_MODEL. Descriptions send the schema and 5 truncated samples only.
- Patched entities' attributes refresh within ~5 min (re-decode throttle); the feed shows the patch at once.
- Decode finished: 738 datasets from 288 projects (load generators excluded); 790 of 37,186 live records are undecoded (recent creates the watch indexer picks up within seconds).

**Pre-publication note (from the owner, 2026-10-28):** keep the repo private until the mission is complete.
History rewritten 2026-10-28T22:00Z at the owner's request (see the progress log). Commits made after that can
reintroduce personal references, so re-check before the repo goes public. No secrets were found in history (checked all branches).
