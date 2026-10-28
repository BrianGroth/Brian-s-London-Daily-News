# Quick newspaper update, including publication

Trigger: **Make the quick update to the newspaper.** Also recognize “Quick update the newspaper” and “Publish a quick newspaper update”. The request authorizes the agent to research, write, validate, commit, push and verify the published edition. Brian runs no separate commands. An explicit preview-only request stops before committing/publishing.

Read `NEWS_CONTEXT.md` and this file once, inspect git status, and preserve unrelated work. Use the current Europe/London date. Follow the schemas/recovery rules in `docs/EDITION_INPUT.md` and runtime/publishing guidance in `docs/DAILY_RUN.md`. This quick mode overrides the full prompt's instruction to keep broadening research; all factual, freshness, quality, layout and publication requirements still apply.

## Bounded research

1. Run `npm run quick:prepare`. It checks readiness, fetches the four usual activity listings and only two institution-focused news queries, and writes today's isolated reading brief under `.daily-work/quick/YYYY-MM-DD/reading.json`. Do not run `daily:prepare`, the full RSS collector, broad web searches, weekly maintenance or the full daily brief. `quick:status` shows timings and checkpoints; `--refresh` refreshes only quick discovery.
2. Read that quick reading brief. Start a **12-minute research budget** now; it is a limit on research effort, not a guaranteed total publication time. Consult at most **8 Near Home, 4 Near Work, 3 London AI, 3 London Technology and 4 Plan Ahead candidates** across the entire run, including rejected or manually found alternatives. Stop selecting as soon as ten strong, distinct choices qualify. Use `npm run lookup:context -- candidates ID --quick` for full quick leads and targeted normal `events`, `stories`, `images`, `pois` and `resources` lookups. Never dump the full normal discovery pool.
3. Only use the usual sources in `scripts/quick_sources.json`: Heath Hands, Hampstead Theatre, City of London (including Hampstead Heath), Barbican, Kenwood/English Heritage, Broadgate, Spitalfields, UCL, Imperial and the Alan Turing Institute. The collector checks the first four listings; Kenwood/Broadgate/Spitalfields are bounded same-source fallbacks, not extra programme crawls. AI/technology starts with UCL/Imperial/Turing primary news discovered by two site-restricted RSS queries. Google redirects are discovery only. Use current saved-calendar opportunities from these sources for Plan Ahead. Existing `do-not-use` exclusions always take precedence.
4. Reverify selected facts on direct primary pages with `npm run read:source -- HTTPS_URL --refresh`. A candidate is not verified by an HTTP 200, a cached page, feed timestamp or scraped summary. Check publication/material-update time for news; event/action date, price, time, venue, booking/availability and cancellations for activities. Booking providers, source papers and image/licence pages outside the usual domains may be opened to verify a selected story, but must not become new discovery sources. Give a failed URL at most two attempts, diagnose a shared failed host once, then choose another usual-source candidate within budget.
5. Reuse accurate images with recorded reuse rights from `lookup:context images`; inspect current rights and live loading. Never use generic stock to save research. Verify Met Office weather, rain/pollen/air quality when relevant, and Northern/Overground status live immediately before writing. These checks may use their normal authoritative domains.

Keep exactly ten stories in adjacent **4 Near Home / 2 Near Work / 1 London AI / 1 London Technology / 2 Plan Ahead** blocks. Geography, the concrete London test, direct action URLs, image credits/alt text and the existing story word-length guidance in `DAILY_NEWS_PROMPT.md` apply. News normally uses the last **36 hours**, with an explained exceptional 36–72-hour choice. An older official activity listing is valid only when its actionable date is still useful and verified today. Compare all ten underlying stories with the issue becoming yesterday, including on same-day reruns. Do not recycle stale prose or silently carry yesterday's story into a newly dated edition.

If time, source coverage, article strength or image rights cannot support ten justified stories, stop, preserve the draft outside published files, and report the exact section shortfall and sources tried. Do not pad, weaken checks, publish a partial edition, or automatically expand to a full update. A full-update request is a separate choice. Complete essential verification on already selected candidates even when the selection budget expires; if it fails, report the shortfall.

## Apply, validate and publish

Persist qualified events/POIs actually encountered, including unselected candidates, using the existing append/preserve/deduplication rules. Avoid exploratory catalogue work. Add source cards only for newly cited normalized hosts; preserve existing and blocked cards. Prepare verified input at `.daily-work/quick-verified-edition.json` and run:

```text
npm run quick:apply -- --input .daily-work/quick-verified-edition.json
npm run quick:apply -- --input .daily-work/quick-verified-edition.json --write
npm run quick:validate
```

Review the dry run before writing. The agent performs that review without another routine approval request. Applying retains same-day replacement/one-time archive rotation, permits only expired-calendar cleanup, and renders `index.html`. Keep all current UI, navigation, action styling and cache/service-worker rules.

Validation uses the normal tests and the complete desktop/mobile live browser tour of all three tabs, Upcoming Events Month/Agenda, Sources, About and POI. Inspect screenshots, direct/action links, image loading, credits, keyboard controls, overflow and console errors. Reuse still-valid successful checkpoints, never isolated fixtures in place of live acceptance. Quick mode has separate discovery and run checkpoints; its temporary discovery files are not published.

After factual, rights, duplicate, diff and screenshot review, run:

```text
npm run quick:publish -- --reviewed
```

This includes validation, commit, ordinary push to `origin/main`, and public manifest/asset verification. A branch behind main or unrelated staged changes must be resolved without discarding work or force-pushing. Do not report success until the public site shows the intended London edition and exact publication commit. On any blocker report the phase/log path and preserve work. Report the public link, elapsed research/preparation/validation/publication times, actual events/POIs added and freshness exceptions concisely. Never invent speedups or token savings.
