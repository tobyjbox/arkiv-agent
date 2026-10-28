# Brief: ArkivAgent

Mission: `2026-10-28-arkiv-agent` · Frozen 2026-10-28. Amendments arrive only through `missions/_inbox/`.

## The brief

Build "ArkivAgent" per the build plan at `docs/PLAN.md` (commit 5c7210b), drafted by Coder at
the owner's request. Coder's summary, as relayed to the orchestrator on 2026-10-28:

> What: four read-side tools showing how Arkiv is used, complementing Golem's Block Explorer and
> Data Explorer (those show blocks, wallets and single records; ArkivAgent shows projects and
> datasets). Repo goes public at the end.
> Build order (the owner's call): 1 data catalogue, 2 Ask Arkiv (plain-English search to query + SDK
> code), 3 ecosystem pulse (incl. hackathon cohort retention), 4 cost view (GLM fees, cost model,
> calculator).

## Clarifying Q&A (2026-10-28)

**Q1. Done criteria: all four tools, or the demo-able slice (catalogue + Ask Arkiv) plus whatever fits before a date?**
Owner: "the latter"

**Q2. Is there a target date?**
Owner: "sometime next week"

**Q3. Hosting and secrets: Vercel + Neon + GitHub Actions schedule? Who adds the Anthropic key and funds the test wallet?**
Owner: "run locally only for now, so dont need to deploy anything. Lets avoid Neon for now if possible. Yes I will connect with a test wallet but shouldnt need that for read only operations right ?"

**Q4. QA + Security review lanes on coding tasks? Real UX work for the UX designer?**
Owner: "yes and yes"

**Q5. If the Phase 0 spike says no-go: stop and ask, or cut scope to what the spike proves possible?**
Owner: "the latter"

## Other decisions from chat (2026-10-28)

- Repo: private GitHub repo `tobyjbox/arkiv-agent` (the owner: "Private repo").
- UX direction (the owner, verbatim): "for the UX design it needs to look visually stunning, in dark
  mode. And needs to be fast to update. Or give the impression tha it is updating fast."
- Workers notify the orchestrator on done, review or blocked (the owner).
