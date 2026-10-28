# ArkivAgent design specs (T02)

Dark mode only. Specs, not code: Coder lifts the token tables into the theme config.

| File | What it covers |
| --- | --- |
| [01-visual-system.md](01-visual-system.md) | Direction, colour, type, spacing, radius, elevation, motion, icons, accessibility baseline |
| [02-feels-live.md](02-feels-live.md) | Sync indicator, skeletons, number roll, row transitions, streaming/optimistic UI, update announcements, freshness |
| [03-catalogue.md](03-catalogue.md) | App shell, `/catalogue`, `/catalogue/[id]`, all states, responsive |
| [04-ask-arkiv.md](04-ask-arkiv.md) | Ask Arkiv flow, interpretation chips, results tabs, all states, responsive |

## Rationale in brief

- **Stunning through restraint.** Deep ink surfaces, one hero glow, colour reserved for meaning
  (teal = action, violet = AI, green = live). Motion is the hero, so the rest stays calm.
- **Fast, but honest.** Real deltas animate where they happen; a counting "synced N s ago" and a
  pulsing dot show the data is being checked. No invented or extrapolated numbers: ArkivAgent pitches
  trustworthy data, so its own UI must be trustworthy.
- **Show the machinery.** Attribution method and confidence, AI model and inputs, the exact query,
  index vs live source. Developers trust what they can inspect.
- **Arkiv-specific truths are features.** Type-strict filters, expiring records and label
  collisions are surfaced in the UI, not hidden. They are also findings for Golem.

## Open points for Coder / Orchestrator
- Update transport (poll every 5 s vs SSE) is Coder's call after T01/T03; UI behaviour is the same either way.
- Indexer lag threshold for the "Index N blocks behind" state: Coder picks it from T01 timings.
- Footer copy says "Not affiliated with Golem". The owner may want different wording.
