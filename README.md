# ArkivAgent

A live map of what is stored on [Arkiv](https://arkiv.network): which projects write data, what their
datasets look like, who owns them, and how fresh they are. Ask questions in plain English and get the
query, the results and the SDK code.

![ArkivAgent data catalogue: stat tiles, filters and a live list of datasets on Arkiv's Tiramisu testnet](docs/screenshots/catalogue.png)

## What it is

Arkiv is Golem's queryable data layer: apps write records (entities) with typed attributes, a payload
and an expiry. Golem's Block Explorer and Data Explorer show blocks, wallets and single records. ArkivAgent
shows the level above that: **projects and datasets**.

- **Data catalogue.** Groups records into datasets by project label and record kind, infers each schema
  (types, examples, how often each attribute is set), and shows live counts, writers, ownership (app,
  user or mixed), lifetimes and recent activity. It flags labels used by unrelated wallets, and hides
  Arkiv's own load generators by default. Each dataset page has the SDK code to read it back and a
  Data Explorer link that runs the same query.
- **Ask Arkiv.** Turns a question ("tideland parcels with x greater than 20") into a typed Arkiv query
  from the catalogue's schema, runs it live, and shows the query, the results, the TypeScript and a Data
  Explorer link. Each condition is a chip you can edit or remove without asking again.
  - **No guessing.** Words it couldn't use are listed as "Not used". Questions it can't ground ("every
    record on Arkiv") are refused with the reason.
  - **No unchecked queries.** Every query is validated and built with the SDK's own builders before it runs.
- **Feels live.** A local indexer follows the chain head and the UI updates within seconds, without a
  refresh. A sync indicator always says how fresh the data is ("Synced 3 s ago · block 1,188,342"), and
  says so when the index stops moving.
- **Read-only.** ArkivAgent holds no wallet and writes nothing to Arkiv. It runs on your machine against
  Arkiv's public Tiramisu testnet.

![Ask Arkiv: a question becomes editable query chips, then live results from Arkiv](docs/screenshots/ask.png)

| Feature | Status |
|---|---|
| Data catalogue | Built |
| Ask Arkiv | Built |
| Ecosystem pulse, cost view | Planned (specs in `design/05-pulse.md`, `design/06-cost.md`) |

## Run it locally

Needs Node 22.10+, pnpm 11 (`corepack enable`), and about 1 GB of disk for the index. No keys.

```bash
cp .env.example .env
pnpm install
```

Then, in one terminal, build the index and keep it following the chain:

```bash
pnpm index --watch
```

In a second terminal, start the app at http://localhost:3101:

```bash
pnpm dev
```

The first run replays Arkiv from block 1 (about 4 minutes), then decodes every live record's attributes
(about 2 hours on the public RPC). The catalogue fills in as decoding progresses, and says how many
records are still waiting. Stop the indexer whenever you like: it resumes where it left off.

`pnpm index` without `--watch` syncs once and exits. The app still works, and the sync indicator says
"index not updating" until the indexer runs again.

For a production build: `pnpm build`, then `pnpm start`.

## Settings

All optional. ArkivAgent runs with the `.env.example` defaults.

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Switches on Claude. Ask Arkiv reads questions with Claude (still checked against the catalogue) instead of the built-in rules, and each dataset page gets a short AI summary, cached per schema. `pnpm describe --limit 20` writes summaries ahead of time. Without the key, every feature works; dataset pages say "No AI summary yet". |
| `ARKIV_API_KEY` | Arkiv Hub access key (hub.arkiv.network/api-keys). Raises the public RPC limits, so the first decode is much faster. |
| `ARKIV_RPS` | Indexer decode rate in requests per second (default 8, or 25 with `ARKIV_API_KEY`). |
| `DATABASE_URL` | Where the SQLite index lives (default `file:./data/arkiv-agent.db`). |
| `PORT` | App port (default 3101). |
| `ARKIV_AGENT_HOST`, `ARKIV_AGENT_ALLOWED_HOSTS` | Shell variables, not `.env`. ArkivAgent listens on 127.0.0.1 and answers to localhost names only. To open it to your network: `ARKIV_AGENT_HOST=0.0.0.0 ARKIV_AGENT_ALLOWED_HOSTS=my-laptop.local pnpm start`. |

## Commands

| Command | What it does |
|---|---|
| `pnpm index` / `pnpm index --watch` | Sync the index once / keep following the chain. |
| `pnpm index:verify --attrs 20` | Compare the index with the chain: live count, plus names, types and values of 20 random records. |
| `pnpm dev` | App with hot reload on http://localhost:3101. |
| `pnpm build`, `pnpm start` | Production build and server. |
| `pnpm test` | Unit tests and the Ask Arkiv question sets (no network, no keys). |
| `pnpm test:e2e` | Browser smoke tests. Run `pnpm build` first, and leave the port free: Playwright starts its own server and refuses to test one it didn't start (`E2E_REUSE_SERVER=1` overrides). The first time, run `pnpm --filter arkiv-agent exec playwright install chromium`. |
| `pnpm describe --limit 20` | Pre-generate AI summaries (needs `ANTHROPIC_API_KEY`). |

## How Ask Arkiv reads a question

Without a key, rules read the question against the catalogue:

- **Dataset.** The project label and record kind it names, then the stored values it mentions. Values are
  looked up in the whole index, not just the three examples per attribute the catalogue shows.
- **Conditions.** Comparisons ("over", "between", "at least"), units ("3 hours" against a `duration_min`
  attribute), yes/no attributes ("is false", "not historical"), presence ("without a parent_key"), places
  ("in Pune"), time windows on a dataset's own timestamp, expiry windows, and owner or creator addresses.
- **Anything else** is listed as "Not used" instead of dropped.

With `ANTHROPIC_API_KEY`, Claude does the reading. In both cases the attribute types come from the
catalogue, and the plan is validated and compiled with the SDK's query builders before anything runs.

Arkiv's query language has limits that Ask states rather than hides:

- Values are exact and case-sensitive.
- Creation time can't be filtered.
- There is no sort ("latest" is reported as not applied) and no count.
- Across all datasets, only owner, creator or key lookups run.

Accuracy is measured by the question sets in `packages/ask/test` (`pnpm test` prints the scores). Blind
checks by a separate reviewer are in the mission records (`missions/2026-10-28-arkiv-agent/tasks/T06…`, `T15…`).

## Safety

- **Read-only:** a public client with no wallet. The run API accepts a validated plan, never a query string.
- **Local by default:** binds 127.0.0.1. The APIs refuse cross-site and non-JSON requests, and every route
  refuses host names that aren't local (DNS rebinding).
- **On-chain text is data.** Names and values written by third parties are clipped before they reach the
  model. Links and addresses are removed from model output before it is shown. The model gets no keys
  and no wallet access.
- **Public data.** ArkivAgent shows records exactly as Arkiv stores them, attributes plus a 120-character
  payload preview. It adds nothing that isn't public on the chain.

## Project layout

| Path | What it holds |
|---|---|
| `apps/arkiv-agent` | Next.js app: catalogue, dataset pages, Ask Arkiv, APIs, Playwright tests. |
| `packages/core` | Arkiv client (retries, optional access key, abortable reads). |
| `packages/db` | Prisma schema and migrations for the SQLite index. |
| `packages/indexer` | Event sync, attribute decoding, change feed, `index:verify`, Phase 0 spike scripts. |
| `packages/catalogue` | Dataset inference, schemas, ownership, SDK snippets, AI summaries, index value lookup. |
| `packages/ask` | Question to query: rules, Claude path, compiler, live runner, question sets. |
| `arkiv/schema.md`, `arkiv/friction.md` | What ArkivAgent reads from Arkiv, and what was hard. |
| `docs/PLAN.md`, `design/` | Technical design and UX specs. |
| `docs/demo.md` | A 3-minute demo script. |

ArkivAgent reads Arkiv's public testnet. Not affiliated with Golem.
