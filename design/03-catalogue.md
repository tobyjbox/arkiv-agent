# 03 · Catalogue screens: `/catalogue` and `/catalogue/[id]`

Owner: UX designer · Task T02 · Uses `01-visual-system.md` and `02-feels-live.md`

Primary user: a developer looking for data on Arkiv to build on. Their questions, in order:
*What's here? Is it alive? Can I trust it? How do I read it?* The layout answers them top to bottom.

## App shell (all pages)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◆ ArkivAgent   Catalogue  Ask Arkiv  (Pulse) (Cost)   [⌘K Search]  ● Synced 3s │  top bar 56px, bg.canvas, border.subtle bottom
├───────────────────────────────────────────────────────────────────────────────┤
│                         (hero glow behind header)                             │
│  page content, max 1280px                                                     │
└───────────────────────────────────────────────────────────────────────────────┘
```

- Nav items: `body` 14/500, `text.secondary`; current page `text.primary` with a 2px `accent` underline. Pulse and Cost are hidden until built (do not show disabled nav, it promises unbuilt things).
- `⌘K` opens a command palette that searches datasets and doubles as an entry to Ask Arkiv ("Ask: …" as the last option).
- Under 768px: nav collapses into a menu button; the sync indicator shrinks to the dot plus "3s".
- Footer line (caption, tertiary): "ArkivAgent reads Arkiv's public testnet. Read-only. Not affiliated with Golem." plus a link to the repo.

## `/catalogue` (list)

### Layout (desktop)

```
Data catalogue                                                     h1
What's stored on Arkiv, who writes it, and how fresh it is.        body, text.secondary

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                stat tiles, 4 across
│DATASETS  │ │LIVE REC. │ │PROJECTS  │ │WRITES/24h│                label + stat (rolls) + sparkline 24h
│ 142      │ │ 1.2M  +12│ │ 38       │ │ 18,402   │
│ ╱╲_╱‾    │ │ ‾‾╱      │ │          │ │ _╱╲╱‾╲   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

[🔍 Search datasets, attributes, projects…      ]  [Project ▾] [Ownership ▾] [Freshness ▾] [Sort: Most active ▾]
Active filters: (Ownership: app ✕) (Hide load generators ✓)             142 datasets

┌───────────────────────────────────────────────────────────────────────────────┐
│ ↑ 4 new datasets · Show                         (only when updates are held)  │
├─────────────────────┬──────────────┬────────┬────────┬─────────┬─────────────┤
│ DATASET             │ PROJECT      │ LIVE   │WRITERS │ LIFETIME│ LAST WRITE  │
├─────────────────────┼──────────────┼────────┼────────┼─────────┼─────────────┤
│ ● sensor_readings   │ weatherdao   │ 48,201 │ 312    │ ~7 d    │ 4 s ago     │
│ ✦ IoT temperature…  │ label · 92%  │ ▁▂▃▅▇  │ user   │         │             │
│   str·i32·u64 +3    │              │        │        │         │             │
└─────────────────────┴──────────────┴────────┴────────┴─────────┴─────────────┘
```

### Stat tiles
- `bg.surface`, radius `md`, padding 20. Label (`label` token, secondary), value (`stat`, primary, rolls on change), delta chip, 24h sparkline (accent line, 16% fill, 32px tall, no axes).
- "Live records" shows the count from the index; tooltip says "Excludes expired and deleted. From ArkivAgent index, block N."
- Under 768px: 2×2 grid. Sparklines remain.

### Search and filters
- Search is instant over loaded data (client filtering), matches dataset name, project, attribute keys and AI description. Highlight matched text with `accent` at 20% background.
- Filters (each a popover, multi-select with counts): **Project**, **Ownership** (app / user / mixed), **Freshness** (written in last hour / day / week / quiet over a week), **Content type**.
- **"Hide load generators"** is on by default (PLAN risk table) and shown as an active filter chip so nobody wonders why counts differ from other explorers.
- Sort: Most active (writes in 24h, default), Most records, Newest, Recently written, Name.
- Filter state lives in the URL, so views can be shared and the back button works.
- Hick's law: four filters only. Anything else goes into search.

### Dataset row (the core unit)
Row height 64px, two lines. Hover: `bg.raised`; whole row is the link (one tab stop), with copy buttons as separate tab stops.

| Column | Line 1 | Line 2 |
| --- | --- | --- |
| Dataset | Status dot + name (`mono`, primary) | `ai` sparkle + AI description, one line, truncated; then schema type chips `str · i32 · u64 +3` |
| Project | project name | attribution method + confidence: "label · 92%". Below 70%: `warn` text "creator wallet · 55%" |
| Live | record count (rolls) | 7-day writes sparkline, 16px tall |
| Writers | number | ownership chip: app / user / mixed |
| Lifetime | median lifetime, human ("~7 d") | n/a |
| Last write | relative time, counts up | `warn` "Quiet 3 d" when over 24h |

- **Label conflict flag** (same project label from unrelated wallets): `warn` triangle after the project name, tooltip "This label is used by 3 unrelated wallets. Labels on Arkiv aren't locks." This is a finding worth showing Golem, so make it visible, not buried.
- Status dot: `live` if written in last hour, `text.tertiary` otherwise. Dot has a text alternative ("active in last hour").
- Under 768px the table becomes cards: name + description, then a row of three stats (Live, Writers, Last write), project line below.

### States

| State | What the user sees |
| --- | --- |
| Loading (first visit, server render) | Content is there on first paint. No skeleton. |
| Loading (client re-fetch after filter change) | Current rows stay; `accent` progress line on top of the table. |
| Index building (first run, nothing indexed yet) | Full-width panel: "Building the index", progress "Read 48,000 of about 1.2M records", an estimate, and a note that the page fills in as it goes. Rows stream in as datasets are found (Pattern 4). This is the empty state on day one, so it should look intentional. |
| Empty (no datasets at all on chain) | Illustration-free panel: "No datasets found on Arkiv yet", the block range scanned, and a link to the Arkiv docs. |
| No results (filters/search) | "No datasets match 'xyz'" + the active filters as removable chips + "Clear filters" + "Ask Arkiv instead: 'xyz'" (sends the text to Ask Arkiv). |
| AI description missing or failed | Show the schema chips only; no error text in the row. Detail page explains. |
| Sync delayed / offline | Sync indicator states (Pattern 1). The list stays usable; a `warn` banner appears only after 2 min: "Showing data from 14:02. ArkivAgent can't reach the index right now. Retry". |
| Error loading the page | Panel in `danger` tint: what failed in plain words, "Retry", and the error detail in a collapsed "Technical details" block (mono) for developers. |

## `/catalogue/[id]` (dataset detail)

### Layout

```
← Catalogue / weatherdao / sensor_readings                                breadcrumb, caption

sensor_readings  ● Active                       [Copy SDK snippet] [Open in Data Explorer ↗]
weatherdao · attributed by label · 92% confidence  ⚠ label used by 2 other wallets

┌ ✦ AI summary ─────────────────────────────────────────────┐   ai-tinted card, left 8 cols
│ Hourly temperature and humidity readings from IoT devices.│
│ Likely use: dashboards, climate history, alerts.          │
│ Generated by Claude Haiku from the schema and 5 samples.  │   caption, tertiary
└───────────────────────────────────────────────────────────┘
┌ stats (4 tiles in 2×2, right 4 cols) ┐
│ Live 48,201  Writers 312             │
│ Median life ~7 d  Payload ~180 B     │
└──────────────────────────────────────┘

Schema                                                                    h2
┌──────────────┬────────┬──────────────────────────────┬──────────┐
│ ATTRIBUTE    │ TYPE   │ EXAMPLES                     │ PRESENT  │
│ device_id    │ str    │ "dev-0042", "dev-0193"       │ 100%     │
│ temp_c_x100  │ i32    │ 2150, -340                   │ 100%     │
└──────────────┴────────┴──────────────────────────────┴──────────┘

Activity (writes per hour, 7 days)            [24h | 7d | 30d]          area chart
Recent records (live)                                                    rows arrive per Pattern 4
Read this dataset                                                        SDK snippet, tabs: TypeScript | Query string
```

### Sections
1. **Header:** name (`h1`, mono), status chip, attribution line. Primary action "Copy SDK snippet" (accent button, the main reason a developer came). Secondary "Open in Data Explorer ↗" (ghost button, `info` icon, opens new tab, says so for screen readers).
2. **AI summary card:** `ai` 12% tint, sparkle icon, "AI summary" label. Always state model and inputs in a caption, so readers can judge it (trust and transparency). A "Was this right? 👍 👎" control is out of scope; do not add it.
3. **Stats:** same tile component as the list page.
4. **Schema table:** attribute (mono), type chip (each `AttrType` has one neutral chip; type-strict filters make this the most valuable column, so keep it prominent), examples (mono, up to 3, truncated), presence % (how many records carry it). Copy button on each attribute name on hover/focus.
5. **Activity chart:** writes per hour, with expiries as a second, muted series. Range toggle. Text equivalent: a one-sentence summary above the chart ("About 420 writes per hour, steady over 7 days").
6. **Recent records:** last 20, live. Each: key (middle-truncated, copy), owner, created, expires ("in 6 d"), attributes as `key: value` chips, a 120-character payload preview only (PLAN privacy risk). Expired records are kept with an "Expired" chip.
7. **Read this dataset:** code block (`bg.canvas`, mono, syntax colours from the accent/ai/info/warn set), tabs TypeScript and Query string, copy button top right with "Copied" confirmation for 2 s. Below it, link: "Ask Arkiv about this dataset" (pre-scopes Ask Arkiv).

### States
| State | What the user sees |
| --- | --- |
| Loading | Header, stats and schema server-render. AI summary, activity chart and recent records each have their own skeleton and stream in (Pattern 5). |
| AI summary pending | Skeleton of 2 lines in the card, caption "Writing a summary…". |
| AI summary failed / no API key | Card in neutral style: "No AI summary yet. The schema below is read directly from Arkiv." No error colour, it is not the user's problem. |
| Dataset gone (all records expired) | Page still renders from the index: `warn` banner "All records in this dataset have expired. Showing what ArkivAgent saw last, up to block N." This is an Arkiv-specific truth worth showing. |
| Not found (bad id) | 404 panel: "This dataset isn't in the catalogue", search box, link back. |
| Error | As list page error panel. |
| Recent records, none live | "No live records right now. Last write 3 d ago." |

## Responsive
- 1280+: as drawn. 768 to 1279: AI card and stats stack (full width each); schema table stays.
- Under 768: schema table becomes stacked rows (attribute + type on line 1, examples line 2). Chart full-width, 160px tall. Code block scrolls horizontally inside itself (never the page).
