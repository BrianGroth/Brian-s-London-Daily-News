# Daily generation prompt

Brian's single normal request is: **Generate and publish today's edition of Brian's London Daily News, following DAILY_NEWS_PROMPT.md.** The agent performs every internal command; Brian does not run Python or npm separately.

## Prepare once, then research selected leads

1. Read `NEWS_CONTEXT.md` completely once, inspect git status and preserve unrelated work. Use the Europe/London date. Read `docs/DAILY_RUN.md` the first time using this workflow or when its code changes.
2. Run `npm run daily:prepare`. This runs the startup checks, `python scripts/collect_candidates.py`, direct official activity collection and brief preparation. Continue with live fallback research for failed or weak discovery sections. Do not rebuild browser/network workarounds during each run: use the preflight result and source-specific logs.
3. Read **`data/reading-brief.json` first**, not the full RSS or full daily brief. It contains collection warnings, all three issue dates, adjacent headlines, twenty leads across the five sections and nearby calendar opportunities. Full discovery and alternative coverage remain in `data/daily-brief.json` and `data/rss_candidates.json`.
4. Use `npm run lookup:context -- candidates ID` for selected full leads; fetch alternatives by their IDs. Use targeted `stories`, `events`, `pois`, `images` and `resources` lookups when needed. Never repeatedly dump whole stores, opaque Google redirect URLs or raw source HTML. The helper loads complete stores internally.
5. Read selected primary pages live with `npm run read:source -- HTTPS_URL --refresh`. Inspect targeted saved evidence when the bounded extraction omits necessary facts. Verify publication time, dates, price, availability, booking and cancellation status. A fresh HTTP response or scraped snippet is not proof of availability. Never cite a Google News redirect.
6. Prefer direct official Heath/Heath Hands, Hampstead Theatre, City and Barbican activity leads; use RSS/search for AI, technology and genuine coverage gaps. Diagnose a blocked shared source once. Give a URL at most two attempts, then use a qualified alternative. Do not wait repeatedly on several forms with the same network failure.

## Exactly ten justified stories

Use adjacent section blocks in this order: **4 Near Home, 2 Near Work, 1 London AI, 1 London Technology, 2 Plan Ahead**. Within each multi-story section, put the nearest deadline or event first. Stories must be genuinely distinct; never cover two angles on one announcement, venue or activity.

- Near Home: activity-led choices useful within roughly a twenty-minute walk of NW3 2RU. Strong non-repeating Heath items take priority. Broaden to Gospel Oak, Finchley Road, South End Green or other nearby areas when necessary.
- Near Work: useful around EC2N 4AY, Liverpool Street, Bishopsgate, Broadgate, Spitalfields or the wider Square Mile.
- AI and technology: name a concrete central London institution, deployment, investment, workforce, public service or consequence. A passing London mention or office alone is insufficient. These two stories must be non-duplicative.
- Plan Ahead: a real future decision, prioritising the nearest meaningful event, deadline, ticket release, closure or closing date. Look further ahead when limited capacity or an important deadline makes early action useful.

Hard news normally comes from the previous **36 hours**. Extend to 72 hours only for a clearly stronger, still-new London story and record why. For activities the **important date is the event, availability, deadline, or action date**, not the page's publication date. Older listings are valid only after today's live date/availability/cancellation checks. Never include an expired action or event recap as an upcoming opportunity.

Compare every proposed story with every story in the issue becoming yesterday, using adjacent headlines and full records where needed. Same-day reruns replace today only; newer dates rotate once. A continuing story requires a full intervening issue and a material new development. If broadening still cannot justify the required ten, preserve local work and report the exact shortfall; do not publish a short or padded edition.

Each story needs the existing schema: a `YYYY-MM-DD-` stable ID, required section, concise specific headline, location (`Near NW3`, `Near EC2N`, `London-based` or `Across London`), a 45–80-word executive brief, a distinct 25–55-word why-it-matters explanation, direct source pairs and `imageKey`. Use Walk, Book, Participate or Avoid only when useful. Book/Participate require a verified direct HTTPS `actionUrl`; Walk/Avoid remain plain text.

Look up an accurate image in the reviewed `data/image-library.json` via `lookup:context images` before researching a new one. Keep archive images honestly identified. Use real photography or official artwork of the actual place/event/technology, with verified reuse terms, accurate alt text and credit. Never substitute generic stock, assume company artwork is reusable, or label an archive photograph as current coverage. New rights decisions are editorial; the library and weekly checks cannot certify them automatically. Selected images must load in the live browser check.

## Morning strip

Verify weather and transport immediately before writing: the integrated Nearby POI link to `poi/`; London high/overnight low linked to the Met Office; the most relevant rain window; pollen or air quality when notable; Northern and Overground statuses linked to TfL. Keep the existing tuple/style schema. Never use a placeholder or cached volatile fact as a live reading.

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

Preserve the design and navigation locked in `NEWS_CONTEXT.md`: navy/white masthead, cool-grey paper, editorial type, rules and square media; explicit rolling three-day archive; accent why-it-matters rule; Book/Participate bordered links; Walk/Avoid plain labels; linked morning facts; footer links only to Upcoming Events, About and Sources. Do not redesign during a daily run. `about.html` must continue to describe the ten-story 4/2/1/1/2 mix.

Run `npm run daily:validate`. It refreshes finished brief context, confirms rendering, runs `npm test`, `npm run test:collector`, `python -m py_compile scripts/collect_candidates.py`, `git diff --check` and the complete `npm run test:browser:live` acceptance tour. Reuse valid successful checkpoints; repeat failed checks or those invalidated by changes. Never substitute isolated fixtures for live acceptance or weaken assertions to hide a failure.

Inspect desktop/mobile screenshots and all three tabs: date, ten current stories, section order, images/credits, direct URLs, action styles, keyboard navigation, overflow and console errors. Follow Upcoming Events through the footer and verify Month/Agenda records, date and count. Include `resources.html`, `about.html` and `poi/` in the full tour; inspect added cards and relevant map areas for new POIs. Source verification, rights review and semantic novelty remain editorial duties.

After that concrete review, run `npm run daily:publish -- --reviewed`. It commits only intended publication/discovery files with `Publish London edition YYYY-MM-DD`, pushes `origin/main` without force, and verifies the GitHub Actions deployment manifest and exact public asset hashes against local HEAD. Resolve an advanced remote safely and revalidate. Existing unrelated staged work is a blocker, not permission to include it.

Report success only after the current issue is in `index.html`, required checks pass, the intended commit is pushed and the public deployment is verified. If blocked, preserve work and report the specific failed phase and log path. Include the public URL, event/POI/resource additions and permitted removals, freshness exceptions and remaining gaps. Use the saved report for full names; keep chat concise.

Use one agent, batch independent reads/checks and keep model judgement for reporting and ambiguity. Record research wall time separately from preparation, update, validation and publication; report observed payload bytes, and actual token usage only when available from Codex/API telemetry. Do not claim a total speedup from one fast script or invent token counts. A balanced model at low/medium reasoning is the normal choice; use stronger reasoning only for a real verification conflict.
