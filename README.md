# ArkivAgent

A live map of what is stored on [Arkiv](https://arkiv.network): which projects write data, what their
datasets look like, who owns them, and how fresh they are.

![ArkivAgent data catalogue: stat tiles, filters and a live list of datasets on Arkiv's Tiramisu testnet](docs/screenshots/catalogue.png)

## What it is

Arkiv is Golem's queryable data layer: apps write records (entities) with typed attributes, a payload
and an expiry. Golem's Block Explorer and Data Explorer show blocks, wallets and single records. ArkivAgent
shows the level above that: **projects and datasets**.

- **Data catalogue** groups records into datasets (by project label and record kind), infers each
  dataset's schema, and shows live counts, writers, ownership, lifetimes and recent activity. Each
  dataset page has the SDK code to read it back.
- **Ask Arkiv** turns a plain-English question ("tideland parcels with x greater than 20") into a typed
  Arkiv query using the catalogue's schema, runs it live, and shows the query, the results, the SDK code
  and a Data Explorer link. Every condition is an editable chip. It works with no API key (catalogue
  rules); with `ANTHROPIC_API_KEY` set, Claude reads the question instead, checked against the same schema.
- **Feels live:** a local indexer follows the chain head, and the UI updates within seconds without a
  refresh. It never shows invented numbers: a sync indicator says how fresh the data is.
- **Read-only:** ArkivAgent writes nothing to Arkiv and holds no wallet. It runs locally against Arkiv's
  public Tiramisu testnet.

| Feature | Status |
|---|---|
| Data catalogue | Built |
| Ask Arkiv (plain-English search to query and SDK code) | Built |
| Ecosystem pulse, cost view | Planned |

## Run it locally

Needs Node 22.10+ and pnpm.

```bash
cp .env.example .env
pnpm install
pnpm index          # first run: replays Arkiv from block 1 (~4 min), then decodes attributes
pnpm dev            # http://localhost:3101
```

Keep `pnpm index --watch` running beside `pnpm dev` for live updates. Decoding attributes for the first
time takes about 2 hours on the public RPC. Set an optional Arkiv Hub access key (`ARKIV_API_KEY`) to
speed it up. The catalogue fills in as decoding progresses.

![Ask Arkiv: a question becomes editable query chips, then live results from Arkiv](docs/screenshots/ask.png)

Ask Arkiv's question-to-query rules are measured by a 20-question eval (`pnpm test`).

What ArkivAgent reads from Arkiv is listed in [`arkiv/schema.md`](arkiv/schema.md). What was hard is in
[`arkiv/friction.md`](arkiv/friction.md).

ArkivAgent reads Arkiv's public testnet. Not affiliated with Golem.
