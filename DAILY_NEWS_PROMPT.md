# Daily generation prompt

Copy everything below the divider into a Codex task opened in this repository.

---

Generate and publish today's edition of **Brian's London Daily News**.

Treat this as a complete research, editorial, implementation, validation, and publication run. Do not merely suggest stories or give me a prose briefing.

## Start here

1. Read `NEWS_CONTEXT.md` completely.
2. Run `python scripts/collect_candidates.py` to refresh `data/rss_candidates.json`. This is an internal Codex step; Brian does not run it separately. If collection fails, continue with live web research and report the collector failure at the end.
3. Run `npm run prepare:brief`. This deterministically deduplicates and ranks the large RSS file into `data/daily-brief.json`, keeping ten discovery leads per section plus compact duplicate, event, POI and source-domain context.
4. Read the current git status, `data/daily-brief.json`, `data/editions.json`, `data/upcoming-events.json`, `poi/data/editorial-pois.json`, `resources.html`, and the files directly involved in any change. Read `index.html`, `upcoming-events.html`, `upcoming-events.js`, `about.html` or POI source code only when validating or changing their behaviour. `PotentialUnusedResources.html` is a research backlog, not an approved production source list.
5. Use the **Europe/London** calendar date. Inspect the current `today`, `yesterday`, and `day-before` objects in `data/editions.json` before changing anything.
6. Treat `data/daily-brief.json` and `data/rss_candidates.json` as discovery leads only. Begin with the compact brief, open destination pages, verify publication times and facts live, and prefer primary sources. Never cite a Google News redirect as the final source. Read the full RSS file only when the shortlist is insufficient or when diagnosing collection/ranking; broaden live web research whenever a section remains weak.

## Fast, reliable execution

- Use one agent for the normal run. Batch independent searches and source checks in parallel where safe; do not create subagents merely to save wall-clock time because they increase total model usage.
- Do not reread large generated files after the compact brief contains the needed fields. Open only the candidates and repository files required for the decisions being made.
- Let scripts handle mechanical work: candidate reduction, archive rendering, date labels and structural checks. Keep model effort for editorial judgement, live verification and concise writing.
- This prompt is designed to work well with a balanced, lower-cost Codex model at low or medium reasoning. Escalate to a frontier model or higher reasoning only when verification, conflicting evidence or a failed validation genuinely requires it.

## Build exactly ten stories, two per section, in this order

Each section runs as an adjacent pair (its two stories back to back) before the next section begins. The two stories in a pair must cover genuinely distinct topics or events — never two angles on the same announcement, venue, or activity.

1–2. **Near Home** — timely and genuinely useful within roughly a 20-minute walk of NW3 2RU. Search current official Hampstead Heath and Heath Hands listings first; a strong non-repeating Heath item takes priority for one of the two slots.
3–4. **Near Work** — useful around EC2N 4AY: Liverpool Street, Bishopsgate, Broadgate, Spitalfields, or the Square Mile.
5–6. **London AI** — a material AI development in which a London institution, deployment, investment, workforce, public service, or community is central.
7–8. **London Technology** — a significant non-duplicative technology or science advancement with a concrete London connection.
9–10. **Plan Ahead** — a London event, deadline, ticket release, scheduled disruption, or closing date where acting early is useful.

Within each pair, order the more time-critical story first — the one with the nearer deadline, the soonest event, or the more perishable news — and the more evergreen or exploratory item second.

Never fill a section's second slot with a weak or marginal story merely to reach ten. If initial research leaves a section short, broaden before giving up: widen Near Home's walking radius slightly (Gospel Oak, Finchley Road, South End Green are all in scope per `NEWS_CONTEXT.md`), extend Near Work across the wider Square Mile, broaden the London AI/Technology search terms, or look further ahead for Plan Ahead.

Ten stories is a hard requirement, not a target — every archived edition must have exactly ten, and `tests/site.test.mjs` enforces this. If, after genuinely broadening the search, a section still cannot support two justified stories, do not publish nine and do not pad with a weak one. Treat this the same as any other publishing blocker described at the end of this document: stop, preserve local work, and report the exact shortfall (which section, what was tried, why nothing qualified) instead of reporting success.

`about.html` hand-describes this editorial mix for readers ("ten concise choices... across five themes") and is not regenerated by this prompt. If the story count or section split ever changes again, update `about.html` to match in the same run — it is easy to leave it stale otherwise.

For each story supply:

- a stable ID beginning with `YYYY-MM-DD-`;
- a concise, specific headline;
- the required section;
- one of `Near NW3`, `Near EC2N`, `London-based`, or `Across London`;
- `Walk`, `Book`, `Participate`, or `Avoid` only when genuinely useful;
- a direct `actionUrl` whenever the action is `Book` or `Participate`. A story with `Walk` or `Avoid` (or any action without a verified direct link) renders as plain text, not a button — never invent a placeholder `actionUrl` just to make an action look clickable;
- one properly licensed, hotlink-safe editorial image with accurate alt text and credit — real photography or official artwork from the story's own source, never a generic stock stand-in for a specific place or event;
- an `imageKey` that points to that image in the top-level `images` object in `data/editions.json`; reuse an existing image only when it remains accurate and properly credited;
- an executive brief of about 45–80 words;
- a distinct “Why it matters” explanation of about 25–55 words;
- direct source URLs, favouring official or primary evidence.

## Freshness: use the correct clock

Apply freshness differently to news and to dated activities:

- **Hard news, AI, technology, policy, research, funding, transport announcements, and other developments:** normally use an article or primary announcement published or materially updated within the previous **36 hours**. Start with the newest verified candidates. Extend to 72 hours only when the story is clearly the strongest fit and remains new to this edition; state the reason in the completion report. London AI and London Technology each need two genuinely fresh, non-duplicate stories a day, which is a materially higher bar than one — use the 72-hour extension for the second slot in either section as needed rather than forcing a weaker but fresher story into it.
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

- Make edition and image changes in `data/editions.json`, never by hand inside the generated data block in `index.html`.
- If `today` already has today's London date, this is a same-day rerun: replace/update `today` only.
- Otherwise delete the old `day-before`, move `yesterday` to `day-before`, move `today` to `yesterday`, and insert the new edition as `today`.
- Never rotate twice on the same date.
- Reject the same underlying story as yesterday even if the headline, source, or angle differs.
- Compare every proposed story with every story in yesterday before publication.
- A continuing story may return only after a full intervening issue and a material new development.
- Keep exactly ten stories in every new edition, preserve the story count of already-published archival editions, and keep all story IDs unique across adjacent editions.
- After updating structured edition data, run `npm run render:edition`. This regenerates the embedded `images` and `issues` block plus the visible Today date in `index.html`, keeping the published page self-contained for GitHub Pages.
- Never hand-edit generated edition data in `index.html`. If generated output is wrong, fix `data/editions.json` or `scripts/render_edition.mjs` and render again.

## Source directory

Treat `resources.html` as append-only production data.

- Read every existing `data-domain`.
- Never use or reactivate a `data-status="do-not-use"` entry.
- Add one well-written resource card for every new normalized hostname cited today.
- Ignore `www.` and URL paths when deduplicating.
- Never delete existing cards or rewrite the directory from only today's sources.

## Persist every new point of interest

While researching and writing the edition, identify every newly discovered, named, fixed-location London place that a reader could genuinely visit. This includes venues, museums, galleries, gardens, monuments, historic buildings and other lasting places connected to today’s stories—even when the place is not selected as one of the ten stories.

- For every eligible new place found, append one record to `poi/data/editorial-pois.json` in the same run. Do not postpone it to a later edition.
- A place is eligible only when its name, WGS84 latitude/longitude, useful description and official or otherwise authoritative page can be verified live.
- Do not add temporary event installations, generic neighbourhoods or boroughs, online-only activities, private addresses, vague locations, or a venue whose continued existence cannot be verified.
- Deduplicate before adding: compare stable IDs, normalized names, source URLs, and coordinates against the editorial dataset and the POI page’s existing sources. Treat matching names within 45 metres as the same place. Never remove or silently rewrite an existing editorial POI merely because it appears in another source.
- Use a stable lowercase ID, one current category from `poi/js/lib/categories.js`, numeric `lat` and `lon`, a concise factual `description`, an official `url`, the discovery `sourceUrl`, and today’s London date in `addedOn`.
- Keep the JSON valid, preserve every existing record, set `updatedAt` to today’s London date when records are appended, and add no speculative fields.
- Finding an eligible POI creates an obligation to append it; not finding one is acceptable. State the number and names of POIs added—or explicitly state that none qualified—in the completion report.
- If the POI shell or source code changes, also bump the POI service-worker version. A data-only editorial append does not require a shell redesign.

## Persist every upcoming event

While researching the edition, append every verified London event, performance, exhibition, consultation, ticket release, deadline, planned disruption or other dated opportunity that is still upcoming to `data/upcoming-events.json`—even when it is not selected as one of the ten stories.

**Update the calendar page every run.** Updating the JSON store alone is not sufficient: render `upcoming-events.html` after the data change and confirm its visible “Calendar updated” date comes from the new `updatedAt` value, the event count is current, and every added, updated or removed record appears correctly in both Month and Agenda views. If `upcoming-events.js` changes, update its cache-busting version in `upcoming-events.html`.

- Add an event only when its date and authoritative source can be verified live. Verify time, venue, availability, price, booking status and cancellation status when those details apply.
- Deduplicate by stable ID, normalized title, source URL and overlapping date range. Never remove or silently rewrite an existing future event merely because it appears in another source.
- Use a stable lowercase ID beginning with the start date. Include `title`, `startDate`, `section`, `location`, `sourceName`, `sourceUrl`, a concise factual `summary`, and today's London date in `addedOn`. Add `endDate`, 24-hour `time`, `venue`, `action` and direct `actionUrl` when verified and useful. Do not add speculative fields.
- Use ISO `YYYY-MM-DD` dates. For a multi-day event, use one record with `startDate` and `endDate`; do not create a duplicate record for every day.
- Remove events only after their final date has passed or when an authoritative source confirms cancellation. Preserve future records, keep the JSON valid, and set `updatedAt` to today's London date whenever the file changes.
- Treat the calendar as an editorial planning source on future runs: check it for timely Plan Ahead candidates, but reverify all volatile details live before publishing a story.
- State the number and names of calendar events added, updated or removed—or explicitly state that no calendar changes qualified—in the completion report.

## Design lock

Preserve the established design and responsive behaviour (as of the 2026-08 "Fleet Street, Fixed" revision):

- white masthead text on dark navy `#08264A`;
- near-black text on very light cool grey `#F3F5F7`;
- editorial serif masthead/headlines and modern sans-serif body;
- open broadsheet composition, sharp rules, square image frames, no generic rounded card grid;
- the "Rolling 3-day edition · today, yesterday, day before" line under the issue date, stating the archive limit explicitly;
- `Book`/`Participate` actions with a verified `actionUrl` render as a bordered accent call-to-action (`.action-label.action-link`); `Walk`/`Avoid` or any action without a direct link render as plain muted text (`.action-plain`) — never give a non-clickable action the bordered button treatment, and never give a real link the plain-text treatment;
- the accent-coloured left rule on the "Why it matters" line (`.why`), keeping it visually distinct from the executive brief above it;
- the morning strip's linked facts stay live links: `Nearby POI` → `poi/`, the temperature reading → the Met Office forecast, and both transit statuses → the TfL status page (see "Morning strip" above for the verification rule); `rain` and `pollen` stay plain text, as they always have;
- working date tabs, keyboard navigation, image credits, source links, and mobile layout;
- footer links to Upcoming Events, About & method, and Sources only. Points of Interest is reached solely through the morning strip's `Nearby POI` link — do not re-add a Points of Interest link to the daily page's footer, since that would duplicate the morning strip.

Do not redesign the site during a daily edition run.

## Validation and publication

These are Codex responsibilities included in this single prompt; Brian does not run them separately.

1. Run `npm run prepare:brief` again so its compact duplicate/event/POI context reflects the finished structured data.
2. Run `npm run render:edition` and then `npm test`. The test command first verifies that `index.html` is exactly in sync with `data/editions.json`.
3. Run `python -m py_compile scripts/collect_candidates.py` and `git diff --check`.
4. Always perform a browser smoke test of the homepage at desktop and mobile widths: check all three date tabs, ten current stories, visible date, images, direct links, action styling, footer navigation, horizontal overflow and console errors.
5. Always follow the homepage footer’s `Upcoming Events` link. Confirm the visible updated date and count match `data/upcoming-events.json`, and inspect every added, updated or removed record in both Month and Agenda views.
6. Inspect `resources.html` in the browser when resource cards changed. Search the relevant area in `poi/` when editorial POIs changed. Inspect `about.html` when its content or shared secondary styling changed. Run the former full companion-page browser tour only when shared HTML/CSS/JavaScript changed or the smoke test reveals a regression.
7. Confirm every `Walk`/`Avoid` story renders as plain text, every `Book`/`Participate` story renders as a bordered link, source hostnames are deduplicated, no story repeats yesterday, and all JSON remains valid.
8. Review the final diff and commit only intended edition, shortlist, resource, event and POI changes with `Publish London edition YYYY-MM-DD`.
9. Push to `origin/main` without force.
10. Confirm local `HEAD` equals `origin/main`, monitor the Pages deployment, and verify the public homepage shows today's London issue date.

Do not report success until the edition is in `index.html`, validation passes, the intended commit is pushed, and the public deployment is verified. If publishing is blocked, preserve the local work and report the exact blocker.
