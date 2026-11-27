# Daily generation prompt

For “Make the quick update to the newspaper” and equivalent quick-update requests, follow `QUICK_NEWS_PROMPT.md` through publication. Its limited source list/research budget replaces this full prompt's broadening steps; all editorial and validation requirements remain.

Brian's single normal request is: **Generate and publish today's edition of Brian's London Daily News, following DAILY_NEWS_PROMPT.md.** The agent performs every internal command; Brian does not run Python or npm separately.

## Prepare once, then research selected leads

1. Read `NEWS_CONTEXT.md` completely once, inspect git status and preserve unrelated work. Use the Europe/London date. Read `docs/DAILY_RUN.md` the first time using this workflow or when its code changes.
2. Run `npm run daily:prepare`. It checks main ancestry before research, safely fast-forwards a clean checkout, runs preflight and imports a same-day, hash/provenance-validated discovery artifact when available (at most twelve hours old). Otherwise it runs `python scripts/collect_candidates.py` and direct official activity collection locally. It always rebuilds the brief with current local policy and archive context. `--refresh` forces local collection. Discovery reuse never replaces live verification. Use the preflight result and source-specific logs instead of rebuilding network workarounds.
3. Read **`data/reading-brief.json` first**, not the full RSS or full daily brief. It contains collection warnings, all three issue dates, adjacent headlines, twenty leads across the five sections and nearby calendar opportunities. Full discovery and alternative coverage remain in `data/daily-brief.json` and `data/rss_candidates.json`.
4. Use `npm run lookup:context -- candidates --ids ID1,ID2` or `npm run lookup:context -- package ID` for selected leads and related previous coverage, calendar and reviewed image options. Compact output is default; `--format full` retrieves detail. Images use reviewed subject search; `images --key KEY` retrieves an exact legacy record with its rights warning. Inspect the separate geography verification queue without treating it as eligible coverage. Never repeatedly dump whole stores or raw HTML.
5. Read selected primary pages live with `npm run read:source -- HTTPS_URL --refresh`, or `--urls URL1,URL2` for a bounded batch. Packets identify source statements, missing/conflicting facts and raw evidence pointers. Use `--availability` on a supported booking-provider page for a read-only, timestamped browser observation; unknown availability needs manual verification. Verify publication time, dates, price, availability, booking and cancellations. HTTP success, extraction and cached data are not proof. Never cite a Google News redirect.
6. Prefer direct official Heath/Heath Hands, Hampstead Theatre, City and Barbican activity leads; use RSS/search for AI, technology and genuine coverage gaps. Diagnose a blocked shared source once. Give a URL at most two attempts, then use a qualified alternative. Do not wait repeatedly on several forms with the same network failure.

## Up to ten justified stories

Use one to ten strong choices in adjacent section blocks, with targets/caps in this order: **4 Near Home, 2 Near Work, 1 London AI, 1 London Technology, 2 Plan Ahead**. Leave sections unfilled when useful verified material is absent. News and useful events are equally welcome in AI/technology if their London relevance and freshness qualify. Within a section put the nearest meaningful decision first. Never cover two angles on one announcement, venue or activity.

- Near Home: activity-led choices useful within roughly a twenty-minute walk of NW3 2RU. Strong non-repeating Heath items take priority. Broaden to Gospel Oak, Finchley Road, South End Green or other nearby areas when necessary.
- Near Work: useful around EC2N 4AY, Liverpool Street, Bishopsgate, Broadgate, Spitalfields or the wider Square Mile.
- AI and technology: name a concrete central London institution, deployment, investment, workforce, public service or consequence. A passing London mention or office alone is insufficient. These two stories must be non-duplicative.
- Plan Ahead: a real future decision, prioritising the nearest meaningful event, deadline, ticket release, closure or closing date. Look further ahead when limited capacity or an important deadline makes early action useful.

Hard news normally comes from the previous **36 hours**. Extend to 72 hours only for a clearly stronger, still-new London story and record why. For activities the **important date is the event, availability, deadline, or action date**, not the page's publication date. Older listings are valid only after today's live date/availability/cancellation checks. Never include an expired action or event recap as an upcoming opportunity.

Compare every proposed story with every story in the issue becoming previous, using repeat flags and full records where needed. Same-day reruns replace today only; newer dates rotate once. A continuing story requires a full intervening issue and a material new development. Publish a shorter justified selection with an editorial note (`shortEditionReason`, or the helper's automatic count note); do not pad or seek separate routine approval. If no stories qualify, preserve the draft and report the exact blocker without publishing.

Each story needs the existing schema: a `YYYY-MM-DD-` stable ID, required section, concise specific headline, location (`Near NW3`, `Near EC2N`, `London-based` or `Across London`), a 45–80-word executive brief, a distinct 25–55-word why-it-matters explanation, direct source pairs and `imageKey`. Use Walk, Book, Participate or Avoid only when useful. Book/Participate require a verified direct HTTPS `actionUrl`; Walk/Avoid remain plain text.

Look up an accurate image in the reviewed `data/image-library.json` via `lookup:context images SUBJECT` before researching a new one. Reuse its stable key; optional per-story `imageAlt`/`imageCaption` can give accurate context without duplicating the photo or changing archives. Catalogue author/licence credit is always retained. Keep archive images identified. Use real photography or official artwork of the actual subject, verified rights, accurate alt text and credit. Never substitute generic stock or infer rights. Selected images must load in the live browser check.

## Morning strip

Verify weather and transport immediately before writing: the integrated Nearby POI link to `poi/`; London high/overnight low linked to the Met Office; the most relevant rain window; pollen or air quality when notable; Northern and Overground statuses linked to TfL. Set `morning.checkedAt` to the actual ISO verification timestamp; never backfill an invented time. Keep the tuple/style schema. These are dated snapshots with live-status links, not continuously live readings.

## Bookkeeping without exploratory catalogue work

**Persist every new point of interest:** append each qualified named, fixed, visitable London place actually encountered in this edition's research to `poi/data/editorial-pois.json`. Verify name, WGS84 coordinates, description and authoritative URL live. Deduplicate stable IDs, URLs and matching names within 45 metres against editorial records and the POI app's live sources. Use the existing schema/category, preserve all records, and report additions or that none qualified. Temporary installations, vague neighbourhoods, private places and unverified coordinates do not qualify. Shell/code changes require a POI service-worker version bump.

**Persist every upcoming event:** save each verified future dated opportunity encountered during this bounded research to `data/upcoming-events.json`, even if it is not one of the ten stories. Verify relevant date, time, venue, price, availability, booking and cancellations live. Use one ISO date-range record per multi-day event; deduplicate IDs, normalized titles, URLs and overlapping dates. Preserve existing future records. Never insert unreviewed direct-collector leads as verified calendar entries.

Broad year-ahead calendar/POI discovery and image-library upkeep belong to the Monday weekly process described in `docs/DAILY_RUN.md`. Do not expand daily research into an entire programme solely to fill those catalogues. Still save all qualified incidental discoveries within the daily scope.

Prepare input in ignored `.daily-work/` following `docs/EDITION_INPUT.md`, then run:

```text
npm run daily:apply -- --input .daily-work/verified-edition.json
npm run daily:apply -- --input .daily-work/verified-edition.json --write
```

Review the dry-run report before writing. The runner enables deterministic expired-event removal only after the final date, validates additions, preserves archives and renders `index.html`. Cancellation/correction requires authoritative evidence and an explicit reviewed edit. Never hand-edit generated homepage data. No future record is silently rewritten or removed.

Treat `resources.html` as append-only: add one useful card for each newly cited normalized hostname, ignoring `www.` and paths. Never delete cards, duplicate domains or use/reactivate a `do-not-use` source. The full active/blocked context is checked by the helper and available through lookups.

**Update the calendar page every run** by changing its JSON store when records qualify and verifying its dynamic display; it does not have a separate HTML render step. Confirm the visible updated date, count and changed records in both Month and Agenda views. If `upcoming-events.js` changes, bump its HTML cache-busting version. Treat the calendar as an editorial planning source and reverify selected opportunities live.

## Validate, review and publish

Preserve the design and navigation locked in `NEWS_CONTEXT.md`: navy/white masthead, cool-grey paper, editorial type, rules and square media; actual-date three-edition archive; accent why-it-matters rule; bordered Book/Participate links; plain Walk/Avoid labels; dated morning facts; footer links only to Upcoming Events, About and Sources. Do not redesign during a daily run. `about.html` must describe the up-to-ten policy and 4/2/1/1/2 section targets/caps.

Run `npm run daily:validate`. It refreshes finished brief context, confirms rendering, runs `npm test`, `npm run test:collector`, `python -m py_compile scripts/collect_candidates.py`, `git diff --check` and the complete `npm run test:browser:live` acceptance tour. Reuse valid successful checkpoints; repeat failed checks or those invalidated by changes. Never substitute isolated fixtures for live acceptance or weaken assertions to hide a failure.

Inspect desktop/mobile screenshots and all three actual-date tabs: truthful latest/previous/earlier labels and staleness notice, actual story count and order, images/credits, compact/full view, section/headline links, action styles, keyboard navigation, overflow and console errors. Follow Upcoming Events and verify Month/Agenda, full day lists/overflow/search, event deep links, date and count. Include Sources, About and POI in the full tour. Source verification, rights and semantic novelty remain editorial duties.

After that concrete review, run `npm run daily:publish -- --reviewed`. It commits only intended publication/discovery files with `Publish London edition YYYY-MM-DD`, pushes `origin/main` without force, and verifies the GitHub Actions deployment manifest and exact public asset hashes against local HEAD. Resolve an advanced remote safely and revalidate. Existing unrelated staged work is a blocker, not permission to include it.

Report success only after the current issue is in `index.html`, required checks pass, the intended commit is pushed and the public deployment is verified. If blocked, preserve work and report the specific failed phase and log path. Include the public URL, event/POI/resource additions and permitted removals, freshness exceptions and remaining gaps. Use the saved report for full names; keep chat concise.

Use one agent, batch independent reads/checks and keep model judgement for reporting and ambiguity. Record research wall time separately from preparation, update, validation and publication; report observed payload bytes, and actual token usage only when available from Codex/API telemetry. Do not claim a total speedup from one fast script or invent token counts. A balanced model at low/medium reasoning is the normal choice; use stronger reasoning only for a real verification conflict.
