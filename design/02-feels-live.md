# 02 · "Feels live" patterns

Owner: UX designer · Task T02 · Uses tokens from `01-visual-system.md`

The owner's direction: "needs to be fast to update. Or give the impression that it is updating fast."

## The one rule: fast, but honest

ArkivAgent is about trustworthy data, so **perceived speed must never come from
invented numbers.** We make real updates feel immediate and we make the wait feel short. We do
not extrapolate counts, fake a stream, or show a "live" badge on data that is stale. Every pattern
below follows that rule.

Where speed comes from, in order of impact:
1. **Instant first paint:** the page renders from the index on the server, so content is there on load (no spinner page).
2. **Small, frequent real updates:** the client asks for "what changed since cursor X" on a short
   interval and animates only the deltas.
3. **Visible heartbeat:** a sync indicator shows the data is being checked even when nothing changed.
4. **Skeletons only where data is genuinely not ready** (Ask Arkiv results, first index build, AI descriptions).

## Update model the UI expects (for Coder; mechanism is your call)

- Each page gets its first data from the server render, plus a `cursor` (last indexed block) and `syncedAt`.
- The client asks for changes since `cursor` every **5 s while the tab is visible**, and pauses when
  hidden (Page Visibility). On return it fetches once at once, then resumes. Server-sent events are
  fine instead, if T01/T03 make that easy; the UI behaviour is the same.
- A response carries: new/changed/expired items, updated aggregates, the new `cursor` and `syncedAt`.
- If the index itself only refreshes every N seconds, the UI still checks every 5 s; it simply
  gets "no change" and the heartbeat still ticks. That honestly shows "we checked, nothing new".

## Pattern 1 · Sync indicator ("synced N s ago" pulse)

Placement: right side of the top bar, on every page. Always visible, never hidden in a menu.

Anatomy: `[● dot] Synced 3 s ago · block 1,204,331`

| State | Dot | Text | When |
| --- | --- | --- | --- |
| Live | `live` colour, ring pulses every 2 s | "Synced 3 s ago" (counts up each second) | Last successful check under 15 s ago |
| Checking | `live`, ring does one quick pulse | text unchanged | During a request (do not swap text; avoids flicker) |
| Delayed | `warn`, static | "Synced 47 s ago · retrying" | 15 s to 2 min without a successful check |
| Offline / error | `danger`, static | "Sync paused · Retry" (Retry is a button) | Over 2 min, or the network is down |
| Index behind chain | `warn` | "Index 128 blocks behind" | Indexer lag over a threshold Coder picks |

- "N s ago" counts up live from `syncedAt` (a cheap, honest motion that signals freshness).
  Switch to "1 min ago" after 60 s.
- The block number rolls (Pattern 3) when it changes.
- Hover/focus tooltip: exact time, block, "checks every 5 s", and the data source (ArkivAgent index vs live Arkiv).
- Screen readers: the indicator is **not** a live region (it would speak every second). Only
  the move into Delayed or Offline is announced, once, through a polite live region.

Rationale: a counting "ago" timer plus a soft pulse gives a steady sense of motion with zero
false data, and the colour states turn silent failure (the worst outcome) into a visible one
(Nielsen heuristic 1: visibility of system status).

## Pattern 2 · Skeletons

Use when content is genuinely not available yet. Never on a server-rendered page's first paint.

- Shape: the real layout's blocks in `bg.raised`, same sizes as the content they replace, radius matching the target.
- Shimmer: a 1.2 s left-to-right sheen (`#FFFFFF` at 4%), only on the skeleton itself. Static under reduced motion.
- Show the skeleton only if loading takes over **150 ms** (avoid flashes on fast loads). Once shown, keep it at least **300 ms** so it does not blink.
- Content replaces it with a 160 ms fade. No layout shift: reserve the exact height.
- After **8 s**, add a line under it: "Still working, Arkiv reads can be slow" (text.tertiary). After the timeout, switch to the error state of that screen.

## Pattern 3 · Live counters (number roll)

For stat tiles, counts in tables, the block number.

- When a value changes, digits roll vertically to the new value over 600 ms (`emphasis`). Only changed digits move.
- Direction: up for increase, down for decrease. Beside the number, a small delta chip appears for 3 s: `+12` in `live`, `−3` in `text.secondary` (decreases are often expiries, which are normal, so not red).
- Large jumps (over 10× or first load): no roll, just a crossfade, since a long roll looks like a slot machine.
- Always `tabular-nums` so the width does not wobble.
- Reduced motion: instant swap, delta chip still shows.
- Screen readers: counters are not live regions. Use the summary in Pattern 5.

## Pattern 4 · Row insert and update transitions

For catalogue lists, sample record lists, Ask Arkiv results that refresh.

- **New row:** inserts at its sort position, slides down 8px and fades in over 240 ms; its background flashes `live` at 12% for 1.2 s, then fades over 800 ms. A 2px `live` bar on the left edge follows the same timing.
- **Changed value in a row:** only that cell flashes, same timing. The number rolls if numeric.
- **Expired or deleted:** the row fades to 50% opacity and gets an "Expired" chip for 3 s, then collapses (240 ms). On the detail page, expired samples stay visible with the chip; do not silently remove data the user is reading.
- **Do not reorder under the cursor:** if the pointer is over the list, or the user has scrolled down, or a row is focused, hold re-sorting. Show a pill at the top of the list instead: "↑ 4 new datasets · Show" (keyboard reachable). Clicking it applies the updates and scrolls to top.
- Batch rule: more than 8 changes in one tick means no per-row animation; apply them and show the pill text "23 updates".

Rationale: motion at the exact place of change draws the eye where something happened (Gestalt
common fate), while freezing order under the user's hand prevents mis-clicks (Fitts's law
targets must not move).

## Pattern 5 · Streamed and optimistic rendering

- **Streaming (server):** page shell and header render first. Each panel streams in on its own;
  the slowest part (AI description, samples) never blocks the rest. Each slow panel has its own skeleton.
- **Optimistic UI:** ArkivAgent is read-only, so optimism applies to the interface itself:
  - Filters, search and sort update the list instantly on the client from loaded data, then
    reconcile with the server in the background. While reconciling, a 2px `accent` progress line runs along the top of the list (indeterminate, no spinner).
  - Ask Arkiv shows the interpreted query as soon as it exists, before results arrive (see `04-ask-arkiv.md`).
- **Prefetch:** hovering or focusing a catalogue row for 100 ms prefetches its detail page, so the click feels instant.
- **Navigation:** route changes keep the previous page visible with the top progress line until the next page's shell is ready (no blank flash).

## Pattern 6 · Announcing updates accessibly

One polite live region per page, which speaks at most once every 30 s with a summary:
"3 new datasets, 120 new records since you opened this page." Users can turn update announcements
off in a small settings popover (stored locally). Errors use an assertive region, once.

## Pattern 7 · Freshness on every piece of data

Every stat and dataset shows how fresh it is, so "live" is backed by evidence:
- Dataset rows: "last write 12 s ago" in `text.tertiary`, turning `warn` with a clock icon if over 24 h ("Quiet for 3 days").
- Data from the index vs live Arkiv is labelled in tooltips ("From ArkivAgent index, block 1,204,331" or "Live from Arkiv, just now").
- Sampled data (if Phase 0 says we cannot read everything): a `warn` chip "Sampled: about 40% of records" with a tooltip saying why.
