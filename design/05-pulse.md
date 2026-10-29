# 05 · Ecosystem pulse (`/pulse`)

Owner: UX designer · Task T09 (stretch) · Uses `01-visual-system.md` and `02-feels-live.md`

Primary user: Golem product and growth. Their questions: *Is the ecosystem growing? Which
projects are active? Do hackathon projects keep building after the prize?* The last one is the
headline insight, so it gets the most prominent chart.

Nav: add "Pulse" to the top bar only once the page is built (03-catalogue.md, App shell).

## Layout (desktop)

```
Ecosystem pulse                                  [7d | 30d | 90d]  [☑ Exclude load generators]
Who is building on Arkiv, and who keeps building.                    body, secondary

┌ ✦ This week on Arkiv ────────────────────────────────────────────────────────────┐  ai card, full width
│ Builders added 6 datasets, mostly IoT telemetry and game state. 3 hackathon     │
│ projects wrote again after a 10-day pause.  Generated weekly by Claude, from new │
│ datasets. Week of 21 Oct.                                                        │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     5 stat tiles (catalogue tile component)
│ACTIVE    │ │ACTIVE    │ │WRITES    │ │NEW       │ │GLM SPENT │     value + delta vs previous period + sparkline
│WALLETS   │ │PROJECTS  │ │ 412k     │ │PROJECTS 4│ │ 12.4     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

Hackathon retention                                     [Cohort: Global Tour Stop, Oct 2026 ▾]   h2
┌──────────────────────────────────────────────┐ ┌───────────────────────────────────┐
│ Still writing after the event                │ │ Projects in cohort (14)           │
│  100% ┤█                                      │ │ ● weatherdao   D7 ✓ D14 ✓ D30 ·   │
│       │█  █                                   │ │ ○ chainquest   D7 ✓ D14 ✗ D30 ·   │
│   50% ┤█  █  ░                                │ │ ...                               │
│       │█  █  ░                                │ │                                   │
│    0% └D7─D14─D30─────                        │ │                                   │
│ 9 of 14 still writing at D7 (64%)            │ │                                   │
└──────────────────────────────────────────────┘ └───────────────────────────────────┘

Activity over time                       [Writes | Active wallets | Active projects | GLM]  h2
(area chart, daily, with event markers as vertical dashed lines labelled "Global Tour Stop")

Most active projects                                                                     h2
(table: project, writes in period + sparkline, active days, datasets, cohort tag, last write)
```

## Components

### Period and filter controls
- Segmented control `7d | 30d | 90d` (default 30d). In the URL.
- **Exclude load generators** is on by default and always visible beside the period, never hidden in a menu. Tooltip: "Wallets with very high, uniform write rates (for example about 1,665 writes per hour) are excluded. Turn off to see raw totals." When off, a `warn` chip "Including load generators" sits next to every affected number's label.
- Rationale: two wallets can dominate totals; showing the filter in plain sight keeps the numbers honest and makes the finding itself visible.

### Weekly AI summary card
- Same `ai` card style as the dataset AI summary (03). States its model, inputs ("from new datasets") and the week it covers. Max 3 sentences. Datasets named in it link to their catalogue pages.

### Stat tiles
- Reuse the catalogue stat tile. Delta chip compares with the previous period of the same length ("+18% vs previous 30 d"). Increases `live`, decreases `text.secondary` (not red: quiet weeks are not failures).
- "GLM spent" links to `/cost`.

### Retention chart (the headline)
- Bar chart: three bars D7, D14, D30, height = share of cohort projects that wrote at least once in the window after that day. Bars in `accent`; a bar whose window has not closed yet is drawn as an outline with a hatched fill (`text.tertiary`) and labelled "D30 · in 12 days". Never show an unfinished window as a low number.
- Value labels on top of bars (tabular). Sentence summary under the chart is the text equivalent ("9 of 14 still writing at D7 (64%)").
- **Cohort selector:** event name and date. Each cohort shows its source in a tooltip ("Seeded from public repos: arkiv/schema.md and READMEs").
- **Cohort project list** (right): each project with D7/D14/D30 marks: `✓` wrote, `✗` did not, `·` window not reached. Marks use icon plus colour (`live` / `text.tertiary`), never colour alone. Click a project to filter the activity chart to it.
- If more than one cohort exists, an optional "Compare cohorts" toggle overlays cohorts as grouped bars (series colours from 01, in order). Max 4 cohorts at once.

### Activity chart
- Area chart, daily points, series switcher (one series at a time keeps the y axis readable). Event markers as dashed vertical lines in `ai` with a label at the top.
- Hover/focus: a crosshair tooltip with date and value; keyboard users move along days with arrow keys. Text equivalent: a collapsible data table below the chart.
- Today's point is drawn open (hollow dot) with "so far today", since the day is incomplete.
- Live: today's value updates per Pattern 3 (02); the line extends without redrawing the rest.

### Most active projects
- Same row pattern as the catalogue list. Cohort tag chip (e.g. "Global Tour") on hackathon projects. Attribution confidence shown as in 03.

## States

| State | What the user sees |
| --- | --- |
| Loading | Server render of tiles and charts from the index. AI summary has its own skeleton (Pattern 5). |
| History still building (index younger than the period) | Charts draw what exists; the missing range is a hatched band labelled "Before ArkivAgent started tracking (from 28 Oct)". Tiles show "since 28 Oct" instead of the period. If history was pruned on chain (Phase 0 finding), the band says so. |
| No cohort data | Retention section shows: "No hackathon cohorts yet. Cohorts are seeded from event repos." and how to add one (link to README). |
| Cohort window not reached | Hatched bar with "in N days" (see above). |
| Load generators included | `warn` chip by each affected label, as above. |
| AI summary failed / no key | Card hidden, replaced by a one-line neutral note "No weekly summary yet." |
| Error | Error panel as in 03. Charts that loaded stay visible; only the failing section shows the error. |
| Sync delayed | Sync indicator states (02, Pattern 1). |

## Responsive
- 768 to 1279: tiles 3 + 2, retention chart and cohort list stack.
- Under 768: tiles 2 per row, charts full width at 200px tall, cohort list becomes an accordion under the chart, table becomes cards.
