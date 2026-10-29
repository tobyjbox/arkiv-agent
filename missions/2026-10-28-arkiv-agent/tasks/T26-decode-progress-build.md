# T26 — Build the decode progress bar (design/07)

- **Persona:** coder
- **Model tier:** fast
- **Depends on:** T25, T24 (queue after C2; same catalogue files may move)
- **Workspace:** <worktrees>/arkiv-agent-decode-bar, branch feat/decode-progress (from local main)
- **Port:** 3105

## Acceptance criteria
- [ ] design/07-decode-progress.md implemented in full: all states (decoding, keeping pace, nearly done, caught up, hidden, stalled, offline/first run as specced), motion with prefers-reduced-motion fallback, 375 px, progressbar ARIA and live-region cadence
- [ ] rate/ETA/stalled derived client-side from existing data; add undecodedLive to the feed only if the bar visibly lags
- [ ] unit tests for the state/rate logic; e2e for render + reduced motion; tests, build, prod e2e pass. Don't rename "arkiv-agent"; don't push

## Progress log

## Handoff
