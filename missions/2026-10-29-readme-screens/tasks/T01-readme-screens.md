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
- [ ] Inventory every main screen (each top-level nav page plus dataset detail); list them in Progress log
- [ ] Capture each at desktop width (~1280 px, dark mode, real data, no personal info), save to docs/screenshots/<screen>.png, replace the stale two
- [ ] README: one section or table entry per screen with a 1–3 sentence commentary on what it shows and why it matters; alt text on every image

## Acceptance criteria
- [ ] every top-level screen covered; images current; README renders correctly on GitHub (relative paths)
- [ ] PNGs reasonably sized (<~600 KB each); no app code changes
- [ ] pnpm test still green

## Progress log

## Handoff
