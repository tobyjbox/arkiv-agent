# ArkivAgent: 3-minute demo

Shows the data catalogue and Ask Arkiv on live Tiramisu data, including the two things that make ArkivAgent
trustworthy: it shows how fresh the data is, and it says what it didn't understand.

## Before you start (5 minutes ahead)

- **Indexer:** `pnpm index --watch` is running and has finished its first decode. The sync indicator (top
  right) reads "Synced N s ago · block …", with a green dot.
- **App:** `pnpm build && pnpm start`, then http://localhost:3101/catalogue in a browser at 100% zoom, with a
  second tab on `/ask`.
- **Query budget:** Ask Arkiv reads live through Arkiv's public RPC, whose anonymous query budget can run out,
  especially if others on your network use it. Put an `ARKIV_API_KEY` in `.env` for the demo, or run the
  questions below once beforehand. If the budget is out, Ask says so immediately ("free query budget is used
  up"); the query and TypeScript tabs still work.
- **Rehearse:** run each question below once. Values change as people write to Arkiv; if one returns nothing,
  swap in a value from that dataset's schema examples.

## Script

**0:00–0:20 · What ArkivAgent is**

> "Arkiv is Golem's queryable database. Its explorers show blocks, wallets and single records. ArkivAgent shows
> the level above: which projects store data, what their datasets look like, and how fresh they are. It's
> read-only and runs locally against the public testnet."

**0:20–1:10 · The catalogue is live**

1. Point at the sync indicator: "This is the index's own heartbeat, a few seconds old. If the indexer
   stopped, it would say 'index not updating'. ArkivAgent never shows invented numbers."
2. Point at the stat tiles and the list: rows flash as new records land, without a refresh. "Load generators
   are hidden by default; they're most of Arkiv's raw writes."
3. Search `tideland`, then open **tideland / parcel**. Walk down the page:
   - attribution (the `app` label, with its confidence);
   - the inferred schema (types, and how often each attribute is set);
   - 7-day activity;
   - recent records updating live;
   - **Read this dataset**: the SDK snippet, and **Open Data Explorer**, which runs the same query.

**1:10–2:30 · Ask Arkiv**

4. Click **Ask about this dataset** (it scopes Ask to parcels), or open `/ask` and type:
   `tideland parcels with x greater than 10 and y less than 3`.
   "It read the question against the catalogue's schema. Each condition is a chip, typed `i32`, because
   Arkiv's filters are type-strict and a wrong type silently returns nothing."
5. Click the `y < 3` chip, change it to `10`, and **Run again**: "Editing re-runs the query directly. No
   re-asking, and you learn the query language."
6. Open the **Query** and **TypeScript** tabs, then **Open in Data Explorer**: "The exact query, the code to
   run it yourself, and Arkiv's own explorer running it."
7. Ask `tankha salaries in pune`, then the follow-up `only with ctc over 1500000` in the box under the
   results: "Follow-ups narrow the last answer."
8. **The honesty moment.** Ask `tideland structures made of driftwood near the harbour`.
   "It applied 'driftwood', which is a stored value of `material`. It also tells me what it didn't use:
   'near' and 'harbour'. The results are not filtered by them, so I don't read a superset as the answer."
9. Ask `show every record on Arkiv`: "It refuses with a reason: Ask reads one dataset at a time, or finds
   records by owner or creator. It doesn't invent a query."

**2:30–3:00 · Close**

> "No keys needed: a rules engine reads questions using the catalogue, and with an Anthropic key Claude
> reads them instead. Either way, every query is validated and built with Arkiv's SDK before it runs. Things
> Arkiv can't do, like sorting or counting, ArkivAgent says rather than hides. Those, and what was hard to build,
> are written up in `arkiv/friction.md` as feedback for Arkiv."

## If something goes wrong

| What you see | What it means | Say / do |
|---|---|---|
| "Synced 5 min ago · index not updating" (amber dot) | The indexer stopped; the app still serves the last index | Restart `pnpm index --watch`; it resumes |
| "Sync paused · Retry" (red dot) | The browser can't reach ArkivAgent's own server | Check `pnpm start` is running |
| "Arkiv's free query budget is used up" in Ask | The public RPC rate-limited anonymous queries | Show the Query and TypeScript tabs; set `ARKIV_API_KEY` |
| "Arkiv reads can be slow. Still working." | The read took over 8 s; Ask gives up at 15 s with Retry | Wait, or narrow the question |
| "No records match this query." | The query ran; nothing matches now | Use a **Broaden: remove** button, or a value from the schema examples |
