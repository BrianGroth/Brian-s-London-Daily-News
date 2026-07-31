# Daily generation prompt

Copy everything below the divider into a Codex task opened in this repository.

---

Generate and publish today's edition of **Brian's London Daily News**.

Treat this as a complete research, editorial, implementation, validation, and publication run. Do not merely suggest stories or give me a prose briefing.

## Start here

1. Read `NEWS_CONTEXT.md` completely.
2. Run `python scripts/collect_candidates.py` to refresh `data/rss_candidates.json`. This is an internal Codex step; Brian does not run it separately. If collection fails, continue with live web research and report the collector failure at the end.
3. Read `index.html`, `resources.html`, the refreshed `data/rss_candidates.json`, and the current git status.
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
4. Render and inspect the homepage at desktop and mobile widths. Check all three date tabs plus `about.html`, `resources.html`, and `poi/`.
5. Confirm images load, links are direct, actions are accurate, source hostnames are deduplicated, and no story repeats yesterday.
6. Review the final diff and commit only the intended edition/resource changes with `Publish London edition YYYY-MM-DD`.
7. Push to `origin/main` without force.
8. Confirm local `HEAD` equals `origin/main`, monitor the Pages deployment, and verify the public homepage shows today's London issue date.

Do not report success until the edition is in `index.html`, validation passes, the intended commit is pushed, and the public deployment is verified. If publishing is blocked, preserve the local work and report the exact blocker.
