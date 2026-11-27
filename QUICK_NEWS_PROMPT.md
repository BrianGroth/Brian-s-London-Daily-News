# Quick newspaper update, including publication

Trigger: **Make the quick update to the newspaper.** Also recognize “Quick update the newspaper” and “Publish a quick newspaper update”. The request authorizes the agent to research, write, validate, commit, push and verify the published edition. Brian runs no separate commands. An explicit preview-only request stops before committing/publishing.

Read `NEWS_CONTEXT.md` and this file once, inspect git status, and preserve unrelated work. Use the current Europe/London date. Follow the schemas/recovery rules in `docs/EDITION_INPUT.md` and runtime/publishing guidance in `docs/DAILY_RUN.md`. This quick mode overrides the full prompt's instruction to keep broadening research; all factual, freshness, quality, layout and publication requirements still apply.

## Bounded research

1. Run `npm run quick:prepare`. It checks readiness, fetches the four usual activity listings and only two institution-focused news queries, and writes today's isolated reading brief under `.daily-work/quick/YYYY-MM-DD/reading.json`. Do not run `daily:prepare`, the full RSS collector, broad web searches, weekly maintenance or the full daily brief. `quick:status` shows timings and checkpoints; `--refresh` refreshes only quick discovery.
2. Read that quick reading brief. Start a **12-minute research budget** now; it limits selection effort, not total publication time. Consult at most **8 Near Home, 4 Near Work, 3 London AI, 3 London Technology and 4 Plan Ahead candidates**, including rejected and uncertain-location leads. Stop at ten strong choices or the selection limit. Use `lookup:context -- candidates --ids ID1,ID2 --quick` or `package ID --quick` for compact context. `--format full` retrieves detail. Keep geography verification queues separate from eligible coverage; never dump the full normal pool.
3. Only use the usual sources in `scripts/quick_sources.json`: Heath Hands, Hampstead Theatre, City of London (including Hampstead Heath), Barbican, Kenwood/English Heritage, Broadgate, Spitalfields, UCL, Imperial and the Alan Turing Institute. The collector checks the first four listings; Kenwood/Broadgate/Spitalfields are bounded same-source fallbacks, not extra programme crawls. AI/technology starts with UCL/Imperial/Turing primary news discovered by two site-restricted RSS queries. Google redirects are discovery only. Use current saved-calendar opportunities from these sources for Plan Ahead. Existing `do-not-use` exclusions always take precedence.
4. Reverify selected facts on direct primary pages with `npm run read:source -- HTTPS_URL --refresh`. A candidate is not verified by an HTTP 200, a cached page, feed timestamp or scraped summary. Check publication/material-update time for news; event/action date, price, time, venue, booking/availability and cancellations for activities. Booking providers, source papers and image/licence pages outside the usual domains may be opened to verify a selected story, but must not become new discovery sources. Give a failed URL at most two attempts, diagnose a shared failed host once, then choose another usual-source candidate within budget.
5. Reuse accurate images with recorded reuse rights from `lookup:context images`; inspect current rights and live loading. Never use generic stock to save research. Verify Met Office weather, rain/pollen/air quality when relevant, and Northern/Overground status live immediately before writing. These checks may use their normal authoritative domains.

Publish **one to ten** justified stories in adjacent sections with targets/caps of **4 Near Home / 2 Near Work / 1 London AI / 1 London Technology / 2 Plan Ahead**. Sections may be unfilled; news and useful events are equally eligible for AI/technology when they pass the concrete London test. Geography, direct action URLs, image credits/alt text and normal word lengths apply. News normally uses the last **36 hours**, with an explained 36–72-hour exception; activity freshness uses its still-useful action date verified today. Compare all selected underlying stories with the previous issue, including same-day reruns. Do not recycle stale prose.

If time, coverage, strength or rights cannot support ten stories, publish the smaller justified selection with `shortEditionReason` or the helper's automatic count note; no separate approval is required. Do not pad, weaken checks or automatically expand to full discovery. Complete essential verification on selected candidates even when the selection budget expires. If none qualify, preserve the draft and report the blocker without publication.

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

This includes validation, commit, ordinary push to `origin/main`, and public manifest/asset verification. Preparation checks main ancestry early; unrelated staged work or unexpected reachable local commits must be reconciled separately. Never discard work or force-push. Do not report success until the intended edition and commit are verified publicly. Report the link, measured phase times, additions and freshness exceptions concisely; never infer token savings from output bytes. Set the actual `morning.checkedAt` timestamp, and review date honesty, compact view, calendar day overflow/search and story-to-event links in the full tour.
