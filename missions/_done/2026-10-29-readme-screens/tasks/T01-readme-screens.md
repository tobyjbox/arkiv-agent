# T01 — README screenshots of all main screens + commentary

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** — (base: main 9752cf8 or later)
- **Workspace:** ~/dev/worktrees/arkiv-agent-readme-screens, branch docs/readme-screens (from main; never push)
- **Port:** use the owner's running app at http://localhost:3101 (indexer --watch is live) for real data; don't stop it

## Inputs
- Owner request (inbox A02): only 2 screens covered (docs/screenshots/catalogue.png, ask.png), they look old.
- design/ specs 03-07 for what each screen is meant to show.

## Milestones
- [x] Inventory every main screen (each top-level nav page plus dataset detail); list them in Progress log
- [x] Capture each at desktop width (~1280 px, dark mode, real data, no personal info), save to docs/screenshots/<screen>.png, replace the stale two
- [x] README: one section or table entry per screen with a 1–3 sentence commentary on what it shows and why it matters; alt text on every image

## Acceptance criteria
- [ ] every top-level screen covered; images current; README renders correctly on GitHub (relative paths)
- [ ] PNGs reasonably sized (<~600 KB each); no app code changes
- [ ] pnpm test still green

## Progress log
- 2026-10-29T20:56:19Z claimed; worktree ~/dev/worktrees/arkiv-agent-readme-screens on docs/readme-screens from main 3f73ee3.
- 2026-10-29T20:57:00Z inventory: top-bar nav (components/shell/top-bar.tsx) is Catalogue /catalogue, Insights /insights, Financials /financials, Ask Arkiv /ask; plus the dataset page /catalogue/[id]. /pulse and /cost only redirect; / redirects to /catalogue. Five screens.
- 2026-10-29T21:00:58Z owner asked in chat for screenshots and explainers of at least the top-level screens, anything else a bonus: all four covered, dataset page as the bonus. Candidate 932d2f1. pnpm test 632/632.

## Handoff
Branch docs/readme-screens, candidate 932d2f1553f2ac96b5248fa92b5fd1b635c85a43 (base main 3f73ee3). Worktree ~/dev/worktrees/arkiv-agent-readme-screens. Nothing pushed. No app code changes: only README.md and docs/screenshots/.

**What changed**
- README.md: new `## Screens` section after the feature table, one `###` per screen with its route, the screenshot, descriptive alt text and 3 to 4 lines of commentary (what it shows, why it matters): Data catalogue, Dataset page, Ask Arkiv, Insights, Financials. Opening note: captured 29 Oct 2026, local index of Tiramisu, 1280 px, dark.
- The hero catalogue image at the top stays, with a line pointing to Screens. The old Ask image under "What it is" moved into the section (no screenshot shown twice there except the catalogue, which is both hero and its own entry).
- docs/screenshots: catalogue.png and ask.png replaced; dataset.png (tideland / structure, /catalogue/8743747487be), insights.png and financials.png added. Sizes 455 to 578 KB.

**How they were taken** (scratch script, not committed; the repo's `pnpm screenshot` is unchanged): Playwright Chromium against the owner's app on 3101 (read-only, not restarted), viewport 1280 wide, deviceScaleFactor 2, dark, reduced motion so numbers render settled, after hydration plus 2.5 s; Ask waits for its results table, Financials for the price chart. Heights trimmed so each image ends on a clean edge. Ask uses the README's own example question.

**How to verify**
- Open README.md in a Markdown preview, or on GitHub after merge: six images (the hero plus five entries), all relative `docs/screenshots/*.png`; every image has alt text; `#screens`, `#known-gaps`, `#outbound-calls` anchors resolve (checked by script).
- `ls -la docs/screenshots` (all under 600 KB). `pnpm test` 632/632.

**Deviations and notes, flagged**
- Personal info: none of mine or the owner's (no local paths, emails, keys). Images do show public Tiramisu testnet data, including wallet addresses and keys in the dataset and Ask tables and project labels in Insights; that is the app's content, as in the old images.
- No AI summaries in the shots (no ANTHROPIC_API_KEY); the pages say so, and the Ask commentary notes it ran on catalogue rules.
- Seen, not fixed (no app changes allowed): on Insights, the chart's "Before Tiramisu (2026-10-01)" label overlaps the peak value label "25,282" (visible in insights.png). Worth a small finding row.
- Mobile shots not included (task asked for desktop).

Next owner: Orchestrator (review and merge).
- 2026-10-29T21:01:05Z notify intent: T01 review candidate=932d2f1 to Orchestrator <session> via ccd send_message; attempt 1.
- 2026-10-29T21:01:15Z notify intent corrected before sending: recipient is <session> (ak-orch.sh thread arkiv-agent; the Orchestrator moved sessions); same event, attempt 1, nothing sent yet.
- 2026-10-29T21:01:28Z notify result: delivered to Orchestrator (arkiv-agent, opus-5.5-med) (message_id 66f7d37d-78f4-44d8-969f-b468ffe54aef).
