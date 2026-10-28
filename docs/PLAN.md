# ArkivAgent: build plan

*Working name. Written 28 Oct 2026.*

Four tools that show how Arkiv is being used. Golem's Block Explorer shows blocks and wallets,
and its Data Explorer shows single records. ArkivAgent shows **projects and datasets**.

## Scope

| # | Feature | Question it answers | Main user |
| --- | --- | --- | --- |
| 1 | Data catalogue | What data is on Arkiv, who writes it, how fresh is it, how long does it live? | Developers looking for data to build on |
| 2 | Ask Arkiv | "Find X" in plain English, with the query and SDK code shown | New developers |
| 3 | Ecosystem pulse | Which projects are active? Are hackathon projects still writing after the prize? | Golem product and growth |
| 4 | Cost view | What has each project spent in GLM, and what would my app cost? | Developers budgeting; Golem pricing |

**Build order (the owner, 28 Oct):** catalogue, then Ask Arkiv, then pulse, then cost, as in the
table and the phases below.

**Out of scope for now:** writing on users' behalf and protocol changes. The friction analyser and
the customer example apps come later, in this same repo.

## Architecture

```
Tiramisu RPC --> indexer (Node, scheduled) --> Postgres (Prisma) --> Next.js app (server components)
                  events, receipts,                                  Catalogue, Pulse, Cost read the index
                  entity reads                                       Ask Arkiv queries Arkiv live (public client)
Claude API: dataset descriptions (cached by schema hash), question -> query
```

**Why an index:** Arkiv returns records newest first, has no counting or grouping, and expired
records disappear. Catalogue, pulse and cost all need aggregation and history, so we keep our own
store. Arkiv stays the source of truth, and the index can be rebuilt from it. This also goes in
the friction log.

### Repo layout (pnpm workspace)

```
apps/arkiv-agent/          Next.js 15 App Router UI: catalogue, ask, pulse, cost
packages/core/       typed Arkiv client, Result type, Zod schemas, query compiler
packages/indexer/    chain -> Postgres sync; CLI plus scheduled job
arkiv/schema.md      what we read (and write, if we publish snapshots)
arkiv/friction.md    running log of what was hard, in Arkiv's own rubric format
docs/PLAN.md         this file
```

A workspace now means later apps (customer examples, MCP server) reuse `packages/core`.

## Contracts (sketch)

```ts
type Result<T, E = ArkivAgentError> = { ok: true; value: T } | { ok: false; error: E };

type AttrType = "str" | "i32" | "u64" | "u256" | "dec" | "bool" | "addr" | "key" | "bytes32";

interface IndexedEntity {
  key: Hex; owner: Address; creator: Address;
  attributes: Record<string, { type: AttrType; value: string }>;
  contentType: string; payloadBytes: number;
  createdAtBlock: bigint; expiresAtBlock: bigint;
  status: "live" | "expired" | "deleted";
}

interface Dataset {                 // an inferred "table"
  id: string;                       // hash of project + attribute signature
  project: { id: string; method: "label" | "creator" | "registry"; confidence: number };
  schema: { key: string; type: AttrType; examples: string[] }[];
  liveCount: number; writers: number; ownership: "app" | "user" | "mixed";
  medianLifetimeBlocks: bigint; lastWriteBlock: bigint;
  description?: { text: string; model: string; schemaHash: string };
}

type AskQuery =                     // what the model must return; validated with Zod
  | { op: "eq" | "gt" | "gte" | "lt" | "lte"; attr: string; type: AttrType; value: string }
  | { op: "startsWith"; attr: string; value: string }
  | { op: "and" | "or"; terms: AskQuery[] }
  | { op: "not"; term: AskQuery };
```

## Feature design

### 1. Data catalogue
- **Grouping:** by the `project` attribute where present, otherwise by creator wallet. A dataset
  is a project plus its attribute signature (or its `type` attribute).
- **Per dataset:** inferred schema with types and examples, live count, number of writers,
  ownership model (app, user or mixed), freshness, median lifetime, content types, payload size.
- **Flags:** the same project label written by unrelated wallets (labels are not locks).
- **AI:** a short description and likely use case per dataset, generated from the schema and a few
  sample attributes, cached by schema hash (Claude Haiku 5.5).
- **Pages:** `/catalogue` (search, filters) and `/catalogue/[id]` (schema, stats, samples, SDK
  snippet, deep link into Golem's Data Explorer).

### 2. Ask Arkiv
- The model turns a question into an `AskQuery`, restricted to attributes and types from the
  catalogue (Claude Sonnet 5.5, structured output). Arkiv's filters are type-strict and a wrong
  type silently returns nothing, so the catalogue's type information is what makes this reliable.
- Validate with Zod, compile to the SDK query builder, run live on Tiramisu with a limit and
  timeout. Read-only.
- Show results, the query string, the TypeScript snippet and a Data Explorer link.
- Eval set: 20 questions with expected queries, run in Vitest against recorded catalogue fixtures.

### 3. Ecosystem pulse
- **Daily series:** active wallets, active projects, writes, new projects, GLM spent.
- **Hackathon cohorts:** projects from the Global Tour Stop (Oct 2026) and earlier events, seeded
  from their public repos (`arkiv/schema.md` and READMEs list Tiramisu wallets). Retention: still
  writing 7, 14 and 30 days after the event.
- **Load generators:** wallets with very high, uniform write rates are flagged and excluded by
  default, with a toggle. (Two wallets made about 1,665 transactions an hour each on 28 Oct.)
- **AI:** a weekly "what builders are doing" summary from new datasets.

### 4. Cost view
- Fee per transaction from receipts (gas used times price, paid in GLM), totalled per project per day.
- A cost model fitted from observed writes: fee against payload bytes and lifetime. Controlled
  test writes in Phase 0 confirm how lifetime affects fees.
- Calculator: writes per day, payload size and lifetime give GLM per month, with the model's error
  shown.
- Amounts in GLM. Any fiat conversion is labelled illustrative (testnet GLM has no price).

## Phases

| Phase | Work | Estimate | Done when |
| --- | --- | --- | --- |
| 0. Spike | `git init`, scaffold, `.gitignore`. SDK read tests: count and page through all live entities, timing. How far back events and receipts go. Check Arkiv's `arkiv-chain-indexer` and `arkiv-transaction-decoder` repos. Controlled test writes to measure fees. | 0.5 to 1 day | Go/no-go notes in `arkiv/friction.md`; data sources chosen |
| 1. Indexer | Prisma schema; backfill and incremental sync; live/expired/deleted tracking; fixtures | 1 to 1.5 days | Index counts match the chain; safe to re-run |
| 2. Catalogue | Inference, pages, AI descriptions | 1.5 days | Every live dataset listed with schema and description |
| 3. Ask Arkiv | Query types, compiler, prompt, UI, eval set | 1 day | At least 80% of eval questions give correct queries |
| 4. Pulse | Series, cohort registry, retention, load-generator filter, summary | 1 to 1.5 days | Retention chart for Global Tour projects |
| 5. Cost | Fee ingestion, model, calculator | 1 day | Calculator within its stated error of observed fees |
| 6. Ship | README (why Arkiv, how each feature is used), friction log, deploy, 3-minute demo script, make the repo public | 1 day | Public URL and public repo |

About 7 to 8 working days. There is a demo-able slice after Phase 3 (catalogue plus Ask Arkiv).

### Phase 0 go/no-go checks
- **Reading everything:** can we read all live entities in under about 5 minutes with paging? If
  not, sample and say so in the UI.
- **History:** how far back can we read events or receipts? If history is pruned, the pulse starts
  from our first snapshot and builds up, backfilling only what is still available.
- **Fees:** do fees depend on lifetime, as documented? Either answer is a useful finding for Golem.

## Testing
- Vitest: schema inference, ownership classification, query compiler, `AskQuery` validation, cost
  model and load-generator detection, all against recorded chain fixtures.
- Playwright: a smoke test per page.
- No live-chain calls in unit tests.

## Risks

| Risk | Mitigation |
| --- | --- |
| Reading across the whole chain is slow (seen in the Data Explorer) | Incremental indexer, pages of 200, backoff |
| Expired data and limited history | Snapshots from day one; transaction decoding if available |
| Testnet reset (Braga was shut down in Aug 2026) | Keep raw snapshots; the index is rebuildable |
| Load generators skew metrics | Flag them and exclude by default |
| Project attribution is guesswork | Show the method and confidence; curated registry |
| Model errors in Ask Arkiv | Zod validation, always show the query, eval set |
| Public records may contain personal data | Show attributes and short payload previews only; send the model small samples only |
| Secrets in a public repo | `.env` gitignored before the first commit; `.env.example` only |

## Needs from the owner
1. **Hosting.** Recommended: Vercel for the app, Neon Postgres, and a GitHub Actions schedule for the
   indexer. Alternative: a local-only demo.
2. **Anthropic API key** in `.env` (the owner adds it; never committed).
3. **A test wallet with faucet GLM** for the Phase 0 fee tests (claimed at hub.arkiv.network/faucet;
   key in `.env`).
4. **Target date**, to confirm 7 to 8 days fits.
5. **Name** (working name: ArkivAgent).

## Later, in this repo
- Friction report analyser (44+ public `arkiv/friction.md` files found on GitHub).
- Agent onboarding benchmark.
- Customer examples: agent grants, agent quotes and receipts, dapp ops config.
- Arkiv read/write MCP server.
- Publish daily pulse snapshots as Arkiv records, so the data is queryable by anyone and ArkivAgent
  becomes a writer too.
