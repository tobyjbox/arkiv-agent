# 01 · Visual system (dark only)

Owner: UX designer · Task T02 · For: Coder (T04, T05, later T10/T11)

## Direction in one paragraph

**"Instrument panel at night."** ArkivAgent is an observatory for a live data network, so it should
feel like a precise instrument: deep ink background, quiet surfaces, crisp type, and colour used
only where it carries meaning (live, AI, warning). The "stunning" part comes from three things,
not from decoration: (1) depth from layered surfaces and a single soft glow behind the hero area,
(2) data that visibly moves (counters, pulses, rows arriving), (3) disciplined typography with
tabular numbers. Everything else stays calm so the motion reads as signal, not noise.

Rationale: the owner asked for "visually stunning, in dark mode" and "fast to update, or give the
impression that it is". Restraint makes motion the hero; a busy palette would compete with it.

## Colour tokens

All text pairs below are checked against WCAG 2.1 AA (4.5:1 body, 3:1 large text and UI parts).
Ratios are measured on `surface` unless stated.

### Backgrounds (darkest to lightest; each step is one elevation level)

| Token | Hex | Use |
| --- | --- | --- |
| `bg.canvas` | `#07090F` | Page background |
| `bg.surface` | `#0D111A` | Cards, table body, panels |
| `bg.raised` | `#141A26` | Hovered rows, inputs, popovers' inner areas |
| `bg.overlay` | `#1B2232` | Menus, tooltips, modals, command palette |

Do not use pure black: `#07090F` keeps a hint of blue so the glow and accent sit naturally.

### Borders

| Token | Hex | Ratio | Use |
| --- | --- | --- | --- |
| `border.subtle` | `#1F2737` | decorative | Dividers between table rows, card edges |
| `border.default` | `#2A3447` | decorative | Card outlines, section separators |
| `border.control` | `#626E88` | 3.7:1 | Input, select, checkbox outlines (must stay at 3:1 or more, WCAG 1.4.11) |

### Text

| Token | Hex | Ratio | Use |
| --- | --- | --- | --- |
| `text.primary` | `#E8ECF4` | 15.9:1 | Headings, values, body |
| `text.secondary` | `#A3AEC2` | 8.4:1 | Labels, descriptions, table headers |
| `text.tertiary` | `#8590A6` | 5.9:1 (4.95 on overlay) | Timestamps, hints, "synced 3 s ago" |
| `text.disabled` | `#566175` | exempt | Disabled controls only, never information |

### Meaning colours (the only saturated colours in the product)

| Token | Hex | Ratio | Meaning, and nothing else |
| --- | --- | --- | --- |
| `accent` | `#3DDCC5` | 11.0:1 | Primary action, focus, selection, links. Teal reads as "signal" |
| `on-accent` | `#04201C` | 10.0:1 on accent | Text on accent-filled buttons |
| `ai` | `#A99BFF` | 7.9:1 | Anything model-generated: AI descriptions, Ask Arkiv's interpretation |
| `live` | `#4ADE80` | 10.8:1 | Live status, sync pulse, "new" flashes |
| `warn` | `#F5B544` | 10.4:1 | Stale data, sampled data, label conflicts, low confidence |
| `danger` | `#FF7A7A` | 7.5:1 | Errors, failed queries |
| `info` | `#6CB6FF` | 8.8:1 | Neutral notes, external links to Golem explorers |
| `focus` | `#7FF5E3` | 14.4:1 | Focus ring (2px, 2px offset) |

Tinted backgrounds for chips and banners: the meaning colour at **12% opacity** over `surface`,
text in the full meaning colour, and a 1px border at **28% opacity**.

Colour is never the only signal (WCAG 1.4.1): every status chip also has an icon or a word.

### Hero glow (the one decorative effect)

A single radial gradient behind the page header: `accent` at 10% opacity in the centre,
fading to transparent at 60% of its radius, about 900px wide, placed top-centre. A second, smaller
`ai` glow at 8% sits behind the Ask Arkiv input only. No other gradients. Turn off both glows
under `prefers-reduced-transparency` if available. They are purely decorative, so nothing breaks.

### Data visualisation series (for sparklines now, pulse/cost charts later)

Order: `accent`, `ai`, `info`, `warn`, `#F28FCB` (pink), `#9BE15D` (lime). Line weight 1.5px,
area fill at 16% opacity. Gridlines use `border.subtle`. Axis text uses `text.tertiary`.

## Typography

| Role | Family | Notes |
| --- | --- | --- |
| UI and body | **Inter** (variable), fallback system-ui | Turn on `tabular-nums` everywhere numbers are shown, and `cv11` (single-storey a) for a cleaner technical look |
| Code, keys, addresses, attribute names | **JetBrains Mono**, fallback ui-monospace | Use for anything a developer might copy |

Both are free (Google Fonts). Self-host via the framework's font loader so the first render does
not flash.

| Token | Size / line height | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `display` | 40 / 44 | 600 | -0.02em | Page hero number or title (one per page) |
| `h1` | 28 / 34 | 600 | -0.015em | Page title |
| `h2` | 20 / 28 | 600 | -0.01em | Section title |
| `h3` | 16 / 24 | 600 | 0 | Card title |
| `body` | 14 / 22 | 400 | 0 | Default |
| `body-lg` | 16 / 26 | 400 | 0 | Ask Arkiv input and answers |
| `label` | 12 / 16 | 500 | +0.04em, uppercase | Table headers, stat labels |
| `caption` | 12 / 16 | 400 | 0 | Timestamps, hints |
| `mono` | 13 / 20 | 400 | 0 | Code, keys, attributes |
| `stat` | 24 / 28 | 600 | -0.01em | Stat tile values, always tabular |

Body text is 14px because this is a dense developer tool. Never go below 12px.

Truncate addresses and keys in the middle (`0x3f9a…c21e`), with the full value in a tooltip and a
copy button. Never truncate at the end, because the end is what people compare.

## Spacing, layout, radius, elevation

- **Spacing scale (4px base):** 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
  Card padding 20. Gap between cards 16. Section gap 40. Table cell padding 12 horizontal, 10 vertical.
- **Layout:** max content width 1280px, centred, 24px gutters (16px under 640px).
  12-column grid on desktop, single column under 768px.
- **Radius:** `sm` 6 (chips, inputs), `md` 10 (cards, buttons), `lg` 14 (modals, Ask panel), `full` (pills, avatars, live dot).
- **Elevation:** use surface steps first, shadows second. `overlay` items get
  `0 8px 24px rgba(0,0,0,0.45)` plus a 1px `border.default`. No shadows on cards.
- **Hit targets:** 32px minimum on desktop, 44px on touch (Fitts's law, WCAG 2.5.5 guidance).

## Motion

Motion means "something changed". It is never ambient decoration, except the live dot.

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| `instant` | 80ms | linear | Hover and press colour changes |
| `quick` | 160ms | `cubic-bezier(0.2, 0, 0, 1)` (decelerate) | Menus, tooltips, chip toggles |
| `standard` | 240ms | `cubic-bezier(0.2, 0, 0, 1)` | Row insert, panel expand, route content fade |
| `emphasis` | 600ms | `cubic-bezier(0.3, 0, 0, 1)` | Number roll, "new" highlight fade-out starts |
| `highlight-hold` | 1200ms then fade 800ms | ease-out | Background flash on a changed row or value |
| `pulse` | 2000ms loop | ease-in-out | Live dot ring only |

Rules:
- Animate opacity and transform only (no layout properties), so updates stay smooth.
- Never animate more than about 8 elements at once. If more change in one tick, update the rest
  without animation and show a summary ("+23 new").
- **`prefers-reduced-motion: reduce`:** no movement at all. Numbers swap instantly, rows appear
  without sliding, the live dot is static, and highlights still happen as a colour fade (colour
  changes are acceptable under reduced motion) shortened to 400ms.

## Iconography

Lucide icons, 16px in tables and chips, 20px in buttons and headers, 1.5px stroke, colour
inherits text. Fixed meanings: `radio` = live, `sparkles` = AI, `alert-triangle` = warning,
`clock` = freshness/lifetime, `users` = writers, `key-round` = ownership, `external-link` = leaves ArkivAgent.

## Accessibility baseline (applies to every screen)

- WCAG 2.1 AA. Focus ring always visible on keyboard focus (`:focus-visible`), never removed.
- Live regions: see `02-feels-live.md` for how updates are announced without spamming screen readers.
- Every icon-only button has an accessible name. Every chart has a text equivalent (a table or summary sentence).
- Skip link to main content. Logical heading order (one `h1` per page).
