# 04 · Ask Arkiv screens (`/ask`)

Owner: UX designer · Task T02 · Uses `01-visual-system.md` and `02-feels-live.md`

Primary user: a new developer who knows what they want but not Arkiv's query syntax.
The screen must do two jobs: **answer the question**, and **teach the query** (so the next time
they write it themselves). Showing the query is also the main guard against model errors (PLAN risk table).

## The flow in one line

Question → *interpretation appears* (query chips, within about a second) → results stream in → the
query string and SDK snippet are ready to copy → the user edits a chip or asks a follow-up.

The interpretation step is the "feels fast" moment: the user sees ArkivAgent understood them before
the chain answers.

## Layout

```
Ask Arkiv                                                             h1
Ask in plain English. See the query, the results, and the code.       body, secondary

          ┌───────────────────────────────────────────────────────┐  (soft ai glow behind)
          │ ✦  Find sensor readings above 30 °C from the last day  ⏎│  input, body-lg, 56px tall, radius lg
          └───────────────────────────────────────────────────────┘
          Try: [Weather readings over 30°C] [Datasets written by 0x3f…] [NFT metadata created today]
          Scope: All datasets ▾          Read-only · runs live on Arkiv testnet       caption

─── once asked ───────────────────────────────────────────────────────────────────────

You asked: "Find sensor readings above 30 °C from the last day"                    caption

┌ ✦ Interpreted as ────────────────────────────────────────────────────────────────┐
│ dataset = weatherdao/sensor_readings                                             │
│ [temp_c_x100 > 3000  i32 ✎] AND [created_at ≥ 1,198,000  u64 ✎]                  │  editable chips, mono
│ "30 °C stored as 3000 (hundredths)". Source: catalogue schema                    │  explanation, caption
└──────────────────────────────────────────────────────────────────────────────────┘

[ Results 128 ]  [ Query ]  [ TypeScript ]                  [Open in Data Explorer ↗]   tabs
┌──────────────────────────────────────────────────────────────────────────────────┐
│ key          device_id   temp_c_x100   created          expires                 │
│ 0x8a1…9f2    dev-0042    3150          2 min ago        in 6 d                  │
│ … rows arrive per Pattern 4 …                                                    │
└──────────────────────────────────────────────────────────────────────────────────┘
Showing first 50 of 128 · Ran in 1.4 s, live on Arkiv at block 1,204,331 · [Load more]

[ Ask a follow-up…                                                         ⏎ ]
```

## Components

### Question input
- Large and central (it is the only primary action on the page): `body-lg`, 56px tall, `bg.raised`, `border.control`, radius `lg`, `ai` sparkle icon at the left. Focus: `focus` ring plus the `ai` glow brightens slightly (opacity 8% to 12%, 240 ms).
- Enter submits, Shift+Enter adds a line. Submit button is visible too (do not rely on Enter only).
- Placeholder rotates through 3 examples every 4 s while empty and unfocused (stops on focus and under reduced motion).
- **Example chips** under the input: 3 real questions built from datasets that exist in the catalogue right now, so they never return empty. Clicking one fills and submits.
- **Scope selector:** "All datasets" or a single dataset (pre-set when arriving from a detail page). Narrow scope improves accuracy; show it so users understand why.
- Keyboard: `/` focuses the input from anywhere on the page.

### Interpretation card
- `ai` tint card, label "Interpreted as". Renders the validated `AskQuery` as **chips**, one per condition: `attribute operator value` in mono, plus a small type tag (`i32`). AND/OR shown as words between chips; nested groups as bracketed chip groups.
- **Explain line** under the chips, written by the model but kept short: unit conversions, which dataset was chosen and why, assumptions ("'last day' read as the last 43,200 blocks").
- **Editable chips** (✎): clicking opens a small popover to change operator or value, with the attribute's type enforced (an `i32` field takes integers only, with inline validation). Editing re-runs the query directly without the model (fast, and teaches the structure). This turns a wrong guess into a 2-second fix instead of a re-prompt.
- If the model's query fails validation, the card does not show a broken query: see error states.

### Results tabs
- **Results:** table whose columns come from the dataset schema (first 5 attributes, then a "more" column toggle). Same row component as catalogue recent records (middle-truncated keys, payload preview capped at 120 chars). Rows stream in as pages arrive.
- **Query:** the raw query string in a code block, with copy.
- **TypeScript:** the SDK snippet, with copy, and a one-line note "Read-only. Uses the public client; no wallet needed."
- Result meta line (caption): count, time taken, "live on Arkiv at block N" (this is live data, not the index, so say so).
- **Open in Data Explorer ↗** for the same query, when supported.

### Follow-ups and history
- Follow-up input under the results keeps context ("only from dev-0042"). Each turn stacks above, newest at the bottom, older turns collapsed to their question + chip summary.
- Recent questions (last 10) in a small "History" popover, stored locally only. Stays out of the way (no left sidebar) so the page keeps one focus.

## States

| State | What the user sees | Timing |
| --- | --- | --- |
| Empty (first visit) | Heading, input, example chips, short "How it works" line: "ArkivAgent turns your question into an Arkiv query using the catalogue's schema, then runs it live. You'll always see the query." | n/a |
| Interpreting | Your question echoes above; interpretation card shows a skeleton of 2 chips, `ai` shimmer, caption "Reading the catalogue schema…" | Card appears at once; skeleton after 150 ms |
| Querying | Chips are real and final; results area shows the table header (real columns) and 5 skeleton rows; caption "Running live on Arkiv…" with elapsed seconds counting | After 8 s add "Arkiv reads can be slow. Still working." |
| Results | Rows fade in as they arrive (Pattern 4), count rolls up as pages load | n/a |
| No results | Keep the query visible. "No records match this query." Then likely reasons, specific to Arkiv: "Values are type-strict: `temp_c_x100` is `i32` and stores hundredths", "Records may have expired". Actions: edit a chip, "Broaden: remove a condition" (one click per chip), "Try another dataset". | n/a |
| Couldn't understand | No chips. "ArkivAgent couldn't turn that into a query." Show what it needs ("Mention a kind of data or an attribute, for example…") and 2 examples from the catalogue. Input keeps the text, selected, ready to edit. | n/a |
| Query invalid (model output failed checks) | Same as above, plus a collapsed "Technical details" with the validation error. Never run an invalid query. | n/a |
| Timeout / Arkiv unreachable | `danger` tinted panel: "Arkiv didn't respond in 15 s." Retry button. The query and code tabs stay usable, so the user can still copy and run the snippet themselves. | Timeout per Coder (PLAN: limit and timeout) |
| No API key (local dev) | Input disabled with a clear note: "Ask Arkiv needs `ANTHROPIC_API_KEY` in `.env`. The catalogue works without it." Link to README. | n/a |
| Partial results (limit hit) | "Showing first 50 of at least 200. Narrow the question, or Load more." | n/a |

## Accessibility
- The interpretation card and results count are announced once via the polite live region ("Interpreted as 2 conditions. 128 results."). Rows streaming in are not announced individually.
- Chips are buttons with full names ("Edit condition: temp_c_x100 greater than 3000").
- Tabs follow the ARIA tabs pattern (arrow keys between tabs).
- The `ai` colour is never the only AI marker: the sparkle icon and the word "Interpreted" or "AI" are always present.

## Responsive
- Under 768px: input full width, example chips scroll horizontally in one row, interpretation chips wrap, results become cards (key + 2 main attributes + created), tabs stay.
