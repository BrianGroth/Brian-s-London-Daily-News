# Daily generation prompt

Copy everything below the divider into a Codex task opened in this repository.

---

Generate and publish today's edition of **Brian's London Daily News**.

Treat this as a complete research, editorial, implementation, validation, and publication run. Do not merely suggest stories or give me a prose briefing.

## Start here

1. Read `NEWS_CONTEXT.md` completely.
2. Run `python scripts/collect_candidates.py` to refresh `data/rss_candidates.json`. This is an internal Codex step; Brian does not run it separately. If collection fails, continue with live web research and report the collector failure at the end.
3. Read `index.html`, `resources.html`, `data/upcoming-events.json`, `poi/data/editorial-pois.json`, the refreshed `data/rss_candidates.json`, and the current git status. `PotentialUnusedResources.html` is a research backlog, not an approved production source list.
4. Use the **Europe/London** calendar date. Inspect the current `today`, `yesterday`, and `day-before` editions before changing anything.
5. The RSS file contains discovery leads only. Search the live web broadly and open the underlying articles. Prefer primary sources and corroborate consequential claims. Do not cite a Google News redirect as the final source.

## Build exactly five stories, in this order

1. **Near Home** — timely and genuinely useful within roughly a 20-minute walk of NW3 2RU. Search current official Hampstead Heath and Heath Hands listings first; a strong non-repeating Heath item takes priority.
2. **Near Work** — useful around EC2N 4AY: Liverpool Street, Bishopsgate, Broadgate, Spitalfields, or the Square Mile.
3. **London AI** — a material AI development in which a London institution, deployment, investment, workforce, public service, or community is central.
4. **London Technology** — a significant non-duplicative technology or science advancement with a concrete London connection.
5. **Plan Ahead** — a London event, deadline, ticket release, scheduled disruption, or closing date where acting early is useful.

For each story supply:

- a stable ID beginning with `YYYY-MM-DD-`;
- a concise, specific headline;
- the required section;
- one of `Near NW3`, `Near EC2N`, `London-based`, or `Across London`;
- `Walk`, `Book`, `Participate`, or `Avoid` only when genuinely useful;
- a direct `actionUrl` whenever the action is `Book` or `Participate`;
- one properly licensed, hotlink-safe editorial image with accurate alt text and credit;
- an executive brief of about 45–80 words;
- a distinct “Why it matters” explanation of about 25–55 words;
- direct source URLs, favouring official or primary evidence.

## Freshness: use the correct clock

Apply freshness differently to news and to dated activities:

- **Hard news, AI, technology, policy, research, funding, transport announcements, and other developments:** normally use an article or primary announcement published or materially updated within the previous **36 hours**. Start with the newest verified candidates. Extend to 72 hours only when the story is clearly the strongest fit and remains new to this edition; state the reason in the completion report.
- **Events, activities, performances, consultations, ticket releases, closures, deadlines, and planned disruption:** the important date is the event, availability, deadline, or action date—not merely the publication date of the page. An older official listing is valid when the activity is still upcoming and useful. Verify its date, time, availability, price, booking status, and cancellation status today.
- Never include an event that has already happened or an expired action merely because its page is recent.
- For Plan Ahead, prefer the nearest meaningful future decision. Look further ahead only when booking pressure, limited capacity, or an important deadline makes early action useful.
- When two candidates are equally strong, choose the one with the more recent material development or the more immediate useful action.

## Morning strip

Update:

- the integrated `Nearby POI` link to `poi/`;
- London high/low temperature linked to the relevant Met Office forecast;
- the most decision-relevant rain window;
- pollen or air quality when notable;
- current Northern line and London Overground status, with each status linked to the TfL status page.

Verify all volatile facts live. Never leave a placeholder such as “Check live”.

## Archive and duplicate rules

- If `today` already has today's London date, this is a same-day rerun: replace/update `today` only.
- Otherwise delete the old `day-before`, move `yesterday` to `day-before`, move `today` to `yesterday`, and insert the new edition as `today`.
- Never rotate twice on the same date.
- Reject the same underlying story as yesterday even if the headline, source, or angle differs.
- Compare every proposed story with every story in yesterday: 25 semantic comparisons.
- A continuing story may return only after a full intervening issue and a material new development.
- Keep exactly five stories in each archived edition and keep all story IDs unique across adjacent editions.

## Source directory

Treat `resources.html` as append-only production data.

- Read every existing `data-domain`.
- Never use or reactivate a `data-status="do-not-use"` entry.
- Add one well-written resource card for every new normalized hostname cited today.
- Ignore `www.` and URL paths when deduplicating.
- Never delete existing cards or rewrite the directory from only today's sources.

## Persist every new point of interest

While researching and writing the edition, identify every newly discovered, named, fixed-location London place that a reader could genuinely visit. This includes venues, museums, galleries, gardens, monuments, historic buildings and other lasting places connected to today’s stories—even when the place is not selected as one of the five stories.

- For every eligible new place found, append one record to `poi/data/editorial-pois.json` in the same run. Do not postpone it to a later edition.
- A place is eligible only when its name, WGS84 latitude/longitude, useful description and official or otherwise authoritative page can be verified live.
- Do not add temporary event installations, generic neighbourhoods or boroughs, online-only activities, private addresses, vague locations, or a venue whose continued existence cannot be verified.
- Deduplicate before adding: compare stable IDs, normalized names, source URLs, and coordinates against the editorial dataset and the POI page’s existing sources. Treat matching names within 45 metres as the same place. Never remove or silently rewrite an existing editorial POI merely because it appears in another source.
- Use a stable lowercase ID, one current category from `poi/js/lib/categories.js`, numeric `lat` and `lon`, a concise factual `description`, an official `url`, the discovery `sourceUrl`, and today’s London date in `addedOn`.
- Keep the JSON valid, preserve every existing record, set `updatedAt` to today’s London date when records are appended, and add no speculative fields.
- Finding an eligible POI creates an obligation to append it; not finding one is acceptable. State the number and names of POIs added—or explicitly state that none qualified—in the completion report.
- If the POI shell or source code changes, also bump the POI service-worker version. A data-only editorial append does not require a shell redesign.

## Persist every upcoming event

While researching the edition, append every verified London event, performance, exhibition, consultation, ticket release, deadline, planned disruption or other dated opportunity that is still upcoming to `data/upcoming-events.json`—even when it is not selected as one of the five stories.

- Add an event only when its date and authoritative source can be verified live. Verify time, venue, availability, price, booking status and cancellation status when those details apply.
- Deduplicate by stable ID, normalized title, source URL and overlapping date range. Never remove or silently rewrite an existing future event merely because it appears in another source.
- Use a stable lowercase ID beginning with the start date. Include `title`, `startDate`, `section`, `location`, `sourceName`, `sourceUrl`, a concise factual `summary`, and today's London date in `addedOn`. Add `endDate`, 24-hour `time`, `venue`, `action` and direct `actionUrl` when verified and useful. Do not add speculative fields.
- Use ISO `YYYY-MM-DD` dates. For a multi-day event, use one record with `startDate` and `endDate`; do not create a duplicate record for every day.
- Remove events only after their final date has passed or when an authoritative source confirms cancellation. Preserve future records, keep the JSON valid, and set `updatedAt` to today's London date whenever the file changes.
- Treat the calendar as an editorial planning source on future runs: check it for timely Plan Ahead candidates, but reverify all volatile details live before publishing a story.
- State the number and names of calendar events added, updated or removed—or explicitly state that no calendar changes qualified—in the completion report.

## Design lock

Preserve the established design and responsive behaviour:

- white masthead text on dark navy `#08264A`;
- near-black text on very light cool grey `#F3F5F7`;
- editorial serif masthead/headlines and modern sans-serif body;
- open broadsheet composition, sharp rules, square image frames, no generic rounded card grid;
- working date tabs, keyboard navigation, image credits, source links, POI/About/Sources footer links, and mobile layout.

Do not redesign the site during a daily edition run.

## Validation and publication

These are Codex responsibilities included in this single prompt; Brian does not run them separately.

1. Run `npm test`.
2. Run `python -m py_compile scripts/collect_candidates.py`.
3. Run `git diff --check`.
4. Render and inspect the homepage at desktop and mobile widths. Check all three date tabs plus `upcoming-events.html`, `about.html`, `resources.html`, and `poi/`.
5. Confirm images load, links are direct, actions are accurate, source hostnames are deduplicated, and no story repeats yesterday.
6. Validate `data/upcoming-events.json` and `poi/data/editorial-pois.json`; confirm every eligible event and POI discovered today was appended once, calendar events appear on the correct dates, and POIs appear on `poi/` when their area is searched.
7. Review the final diff and commit only the intended edition/resource/POI changes with `Publish London edition YYYY-MM-DD`.
8. Push to `origin/main` without force.
9. Confirm local `HEAD` equals `origin/main`, monitor the Pages deployment, and verify the public homepage shows today's London issue date.

Do not report success until the edition is in `index.html`, validation passes, the intended commit is pushed, and the public deployment is verified. If publishing is blocked, preserve the local work and report the exact blocker.
