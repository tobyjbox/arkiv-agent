# 06 · Cost view (`/cost`)

Owner: UX designer · Task T09 (stretch) · Uses `01-visual-system.md` and `02-feels-live.md`

Two users, two halves of one page:
1. **Developers budgeting:** "What would my app cost?" → the **calculator**, top of page (it is the action).
2. **Golem pricing:** "What are projects actually spending, and what drives fees?" → **observed spend** and the **fee model**, below.

Honesty rules for this page: amounts are in **GLM**. Testnet GLM has no price, so any fiat figure
is off by default and always labelled "illustrative". The model's error is always shown next to
its estimate. Never show an estimate without its range.

## Layout (desktop)

```
Cost view                                                                    h1
What Arkiv storage costs, from real fees on the network.                     body, secondary

┌ Estimate your app's cost ─────────────────────────────────────────────────────────┐  bg.surface, radius lg
│ Writes per day      [ 1,000      ]   ───●──────────  (log slider 1 to 1M)          │
│ Payload size        [ 200   ] B      ──●───────────  (log slider 32 B to 128 KB)   │
│ Record lifetime     [ 7 ] [days ▾]   ────●─────────  (1 h to 1 y)                  │
│                                                                                  │
│     ≈ 4.2 GLM / month                       range 3.6 to 4.9 GLM (±15%)            │  display token, rolls
│     0.00014 GLM per write · based on 18,402 observed writes                        │  caption
│     [ ] Show illustrative fiat (assumed price: [ 0.25 ] USD/GLM)                   │
│                                                                                  │
│  What drives this:  lifetime ███████ 62%   payload ███ 28%   base fee █ 10%      │  breakdown bar
└──────────────────────────────────────────────────────────────────────────────────┘

Observed spend                                     [7d | 30d | 90d] [☑ Exclude load generators]  h2
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│GLM SPENT │ │TXS       │ │MEDIAN FEE│ │PROJECTS  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
(stacked area: GLM per day by top 5 projects + "Other")
(table: project, GLM in period, share bar, writes, GLM per write, median lifetime)

How fees behave                                                              h2
┌ Fee vs lifetime (scatter) ─────────────┐ ┌ Fee vs payload size (scatter) ─────────┐
│ dots = observed writes, line = model   │ │                                        │
│ band = model error                     │ │                                        │
└────────────────────────────────────────┘ └────────────────────────────────────────┘
Model: fee ≈ a + b·bytes + c·lifetime. Fitted on N writes, R² 0.94. Last fitted 2 h ago.   caption
Finding: [Phase 0 result in one sentence, e.g. "Fees scale with lifetime, as documented."]  info note
```

## Components

### Calculator
- Three inputs, each a **number field paired with a log-scale slider** (sliders for exploring, fields for exact values; both keyboard accessible, slider has `aria-valuetext` with units). Lifetime has a unit select (hours, days, months).
- Defaults are a realistic small app (1,000 writes/day, 200 B, 7 days) so the first view is meaningful, not zero.
- Inputs live in the URL, so an estimate can be shared ("here's what your app would cost").
- **Result:** `display` token, tabular, rolls on change (Pattern 3, 02). Recompute on input, no submit button. Debounce slider drags so the number moves smoothly rather than flickering (about 60 ms).
- **Range is mandatory:** "range 3.6 to 4.9 GLM (±15%)" always beside the estimate, in `text.secondary`. If inputs go outside the observed data (e.g. payloads larger than anything seen), show a `warn` note: "Outside observed data: estimate is less reliable" and widen the range.
- **Breakdown bar:** horizontal stacked bar of what drives the cost, using series colours, with labels and percentages (text, not colour alone). This answers "what should I change to pay less?" at a glance.
- **Fiat toggle:** off by default. When on, the user must see the assumed price in an editable field and every fiat figure carries "illustrative". Never fetch or imply a market price for testnet GLM.
- Copy button: "Copy estimate" copies a plain-text summary with inputs, result, range and model date.

### Observed spend
- Tiles and stacked area chart as in 05 (same components, same load-generator control and rules).
- Project table: share bar (inline, `accent`, 60px), GLM per write (tabular), median lifetime. Sorting by GLM spent (default) or GLM per write. Rows link to the project's datasets in the catalogue.
- Fee amounts: show up to 4 significant digits; very small values use plain decimals ("0.00014 GLM"), not scientific notation.

### Fee model charts
- Two scatter plots with observed writes as dots (`text.tertiary` at 40%, `accent` on hover), the fitted line in `accent`, and the error band at 16% fill. Log axes where the data spans orders of magnitude, labelled as log.
- Over 5,000 dots: sample for drawing and say so ("Showing 5,000 of 18,402 writes").
- Model caption states formula, sample size, fit quality and when it was last fitted. Text equivalents: the caption plus a short table of model coefficients.
- **Finding note** (`info` tint): the Phase 0 result about lifetime and fees in one sentence. This is a finding for Golem, so it is placed in plain view.

## States

| State | What the user sees |
| --- | --- |
| Loading | Server render. Calculator works immediately with the last fitted model; charts stream in. |
| No fee data yet | Calculator disabled with: "Not enough observed fees to estimate yet (need about 100 writes, have 12)." Observed spend shows what exists. |
| Model not yet fitted / too few points | Calculator shows a wide range and a `warn` chip "Rough estimate: few observations". |
| Input outside observed range | `warn` note, wider range (see above). |
| Invalid input | Inline field error under the field ("Enter a whole number from 1 to 1,000,000"), result keeps the last valid value, dimmed. |
| Fiat on | "illustrative" label beside every fiat figure; assumed price editable. |
| Load generators included | `warn` chips by affected labels, as in 05. |
| Error | Section-level error panels as in 03; calculator stays usable if the model loaded. |
| Sync delayed | Sync indicator states (02, Pattern 1). |

## Responsive
- Under 768: calculator inputs stack (field above slider), result moves above the inputs and becomes sticky at the top of the calculator card while editing, so users see the number change as they drag. Scatter plots stack, 220px tall. Table becomes cards.
