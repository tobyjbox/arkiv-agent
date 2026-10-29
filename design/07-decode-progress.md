# 07 · Decode progress bar (catalogue)

Owner: UX designer · Task T25 · Uses `01-visual-system.md`, `02-feels-live.md`, `03-catalogue.md`

Replaces the amber banner in `apps/arkiv-agent/components/catalogue/catalogue-view.tsx`:
"792 of 37,288 live records are still being decoded, so their datasets are not listed yet. They
appear as the indexer catches up."

## Why change it

The banner reads as a warning (amber tint), but decoding is normal, expected work, not a problem.
It is also a wall of text with the key number buried mid-sentence. A progress bar turns the same
facts into **visible system status** (Nielsen heuristic 1): how far along, how fast, and whether
it is moving. It also becomes one of the "feels live" moments the brief asked for, backed by real
numbers only (honest-speed rule, 02).

## Placement and anatomy

Same slot as the banner: between the stat tiles and the search/filter bar, full content width.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◌ DECODING RECORDS                                   36,496 / 37,288 · 97.9%          │  row 1
│ ▕████████████████████████████████████████████████████████████▓▓░░▏                   │  row 2: track 6px
│ 792 waiting · ~140 / min · about 6 min left        Their datasets appear as they're decoded │  row 3
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Container:** `bg.surface`, 1px `border.default`, radius `md`, padding 12 × 16. Not tinted:
  it is status, not a warning. Height about 72px desktop.
- **Row 1 (left):** status glyph (see Motion) + label in `label` token (12/16, 500, uppercase,
  +0.04em), `text.secondary`: "DECODING RECORDS".
- **Row 1 (right):** `decoded / total` in `mono` 13/20 `text.primary`, tabular; then `·` and the
  percentage in `text.primary` 600. Percent shows one decimal under 99.95%, never rounds up to
  "100%" while anything is waiting (show "99.9%").
- **Row 2, the track:** 6px tall, radius `full`, `bg.raised`, with a 1px inner `border.subtle`.
  - **Fill:** gradient from `accent` (#3DDCC5) at the left to `ai` (#A99BFF) at the right edge
    of the fill, so the leading edge reads as "where the work is happening".
  - **Leading edge:** a 2px-wide bright cap in `focus` (#7FF5E3) with a soft glow
    (`accent` at 35%, 8px blur) bleeding a little past the track. This is the "futuristic" element.
  - **Scan sheen:** a narrow highlight (white at 10%, 40px wide) travels left to right across the
    *filled* part only, every 2.4 s. It signals active work without implying false progress.
  - **Ticks:** faint marks at 25 / 50 / 75% in `border.subtle`, 2px tall, inside the track. They
    give the bar an instrument-panel feel and make small moves readable.
- **Row 3 (left):** caption 12/16 `text.tertiary`: `792 waiting · ~140 / min · about 6 min left`
  (rate and ETA only when derivable, see Data). Numbers are tabular and roll per Pattern 3.
- **Row 3 (right):** caption `text.tertiary`: "Their datasets appear as they're decoded." This
  keeps the original explanation in short form. Tooltip on an `info` icon gives the full sentence
  and the source ("From ArkivAgent index, block N").

## States

| State | Condition (from data) | What shows |
| --- | --- | --- |
| **Decoding** | `undecodedLive > 0`, recent syncs OK, waiting count falling or steady | As drawn. Glyph: `accent` ring rotating (1.6 s). Sheen runs. |
| **Keeping pace** | `undecodedLive > 0` but not falling over the last 60 s (new writes arrive as fast as they decode) | Bar as normal. Rate text becomes "keeping pace with new writes". No ETA. Not a warning: busy chains do this. |
| **Nearly done** | under 0.5% waiting or under 50 records | Same, ETA reads "under a minute". |
| **Caught up** | `undecodedLive` goes to 0 | Bar fills to 100% over 600 ms, the cap flashes `live` once, label changes to "ALL RECORDS DECODED" with a `live` check. Holds 3 s, then the panel collapses (height and opacity, 240 ms) and is removed. The stat tiles move up smoothly; no jump. |
| **Hidden** | `undecodedLive = 0` on page load | Not rendered at all (no empty slot reserved). |
| **Stalled** | waiting count unchanged for 2 min while syncs keep succeeding and `undecodedLive > 0` | Fill and cap switch to `warn`; sheen stops; glyph becomes a static `warn` pause icon. Row 3: "Decoding paused · no progress for 2 min". Info tooltip: "The indexer is running but not decoding. Check the indexer logs." |
| **Indexer offline** | sync indicator is in its Offline state (02 Pattern 1) | Fill desaturates to `text.disabled`, cap and sheen off, glyph static `danger` dot. Row 3: "Paused while the index is unreachable" plus the same Retry action as the sync indicator. Keeps the last known numbers (labelled "as of 14:02"). |
| **Delayed sync** | sync indicator Delayed | No change to the bar; the top-bar indicator already says it. Avoid two warnings for one cause. |
| **First run, 0 decoded** | `liveRecords > 0` and `undecodedLive = liveRecords` | Track shows no fill, but an **indeterminate** shimmer (a 25%-wide `accent` gradient sliding across the whole track, 1.8 s) so it is clearly alive. Row 1 right: "0 / 37,288". Row 3: "Starting to decode · datasets will appear here". The list's empty state below (catalogue-view line 114) stays as is. |
| **Total unknown** | `liveRecords = 0` with the indexer still reading | Do not show this bar; the catalogue's index-building state (03) covers it. |

## Numbers and how to derive them

- `decoded = liveRecords − undecodedLive`; `percent = decoded / liveRecords`.
- **Rate:** from the last few samples of `undecodedLive`, each with its client receive time.
  Rate = drop in `undecodedLive` per minute over a rolling window of at least 30 s and 3 samples.
  - Show "~N / min" (rounded to 2 significant figures) only when the rate is positive and the
    window is filled. Until then show nothing (no placeholder dash).
  - If the waiting count is rising or flat, use the "Keeping pace" text instead of a rate.
- **ETA:** `undecodedLive / rate`, shown as "about 6 min left", rounded (under 1 min, minutes up to 90,
  then hours). Show it only when the rate has been positive for at least 60 s; recompute on each
  sample; smooth it (never let it jump by more than 50% between samples, except down to finished).
  An ETA that keeps changing does more harm than no ETA.
- The total (`liveRecords`) changes too (new writes, expiries). The fill uses the current
  ratio, so the bar can step back slightly. That is honest; animate it with the same 600 ms ease and do not hide it.

## Data needed, and whether it exists

| Need | Exists today? | Where |
| --- | --- | --- |
| `undecodedLive`, `liveRecords` | **Yes** | `CatalogueData.summary` (`packages/catalogue/src/load.ts`), already used by the banner. Refreshed through `/api/catalogue` whenever the live feed moves (`use-live-rows.ts`). |
| Sync state (ok / delayed / offline), `syncedAt`, last OK time | **Yes** | `useLive()` in `components/live/live-provider.tsx` (also drives the sync indicator) |
| `indexedBlock` for the tooltip | **Yes** | `summary.indexedBlock` |
| Samples over time for rate and ETA | **Derivable on the client** | Keep the last ~10 `(receivedAt, undecodedLive)` pairs in the component. No backend change. |
| `undecodedLive` on every 5 s poll, even when no feed changes | **No (optional)** | The summary only refreshes when the feed moves. If decoding progresses without feed changes, the bar can lag. `decoded` is already a `ChangeKind` in `packages/db/src/feed.ts`, so it usually moves the feed. If Coder finds the bar lags, add `undecodedLive` to `FeedResponse` (one COUNT, like `liveCount`). Coder's call. |
| "Stalled" detection | **Derivable** | From the samples: unchanged `undecodedLive` for 2 min while `useLive()` reports OK syncs. |

## Motion

All per 01 Motion tokens; animate transform and opacity only.

| Element | Normal | Reduced motion (`prefers-reduced-motion: reduce`) |
| --- | --- | --- |
| Fill width change | 600 ms `emphasis` ease (scaleX on the fill) | Instant |
| Leading-edge cap glow | Gentle 2 s breathing (opacity 70% to 100%) | Static at 100% |
| Scan sheen | Every 2.4 s across the fill | Off |
| Status glyph ring | Rotates, 1.6 s per turn | Static ring |
| Indeterminate shimmer (first run) | 1.8 s slide | Static 25% accent block at the left, plus the text "Starting" |
| Counters | Roll per Pattern 3 | Instant swap |
| Caught-up collapse | 3 s hold, then 240 ms collapse | 3 s hold, then removed with a 160 ms fade, no height animation |

Respect the 8-elements rule (01): the bar counts as one animated element.

## 375 px layout

```
┌───────────────────────────────────┐
│ ◌ DECODING          97.9%         │
│ ▕████████████████████████▓▓░▏     │
│ 36,496 / 37,288 · ~6 min left     │
└───────────────────────────────────┘
```

- Row 1: label (shortened to "DECODING") + percent only.
- Row 2: track, full width.
- Row 3: `decoded / total · ETA` (or the rate if no ETA, or the state text). The right-hand
  explanation moves into the info tooltip (tap target 44 × 44).
- Padding 12 × 12. Total height about 76px. No horizontal scroll; numbers never wrap mid-number.

## Accessibility

- The track is `role="progressbar"` with `aria-valuemin="0"`, `aria-valuemax={liveRecords}`,
  `aria-valuenow={decoded}`, `aria-valuetext="36,496 of 37,288 records decoded, 97.9%, about 6 minutes left"`,
  and `aria-labelledby` pointing to the "Decoding records" label.
- First run (indeterminate): omit `aria-valuenow`; `aria-valuetext="Starting to decode 37,288 records"`.
- **Live-region cadence:** the bar is not itself a live region (values change every few seconds).
  Use the page's existing polite region (`announcement` in catalogue-view, Pattern 6) and announce:
  on first appearance ("Decoding records: 98% done"), at each 25% boundary crossed, on Stalled, on
  Offline, and on Caught up ("All records decoded"). At most one announcement per 30 s, except
  Caught up, which always speaks.
- Colour is never the only signal: every state has its own text and glyph.
- Contrast: label and numbers use `text.secondary` / `text.primary` (8.4:1, 15.9:1 on surface);
  the fill is decorative relative to the text, but `accent` on `bg.raised` is 10.2:1 anyway, and
  `warn` 9.6:1.
- Info tooltip opens on hover, focus and tap, and is dismissable with Esc.

## Out of scope
- No app code (Coder task). No rename of "ArkivAgent" (separate task).
- The dataset detail page has no decode bar; datasets only exist once decoded.
