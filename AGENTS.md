# AGENTS.md

## Scope

These instructions apply to the entire repository.

This project is a self-contained, static, mobile-first personal London newspaper. Preserve its editorial reliability, three-edition archive, established visual system, companion event calendar, source directory, and Nearby POI app.

## Read before changing anything

- Read `README.md` for the repository map and normal workflow.
- For any daily-edition or publishing task, read `DAILY_NEWS_PROMPT.md` and `NEWS_CONTEXT.md` completely before acting. They are the source of truth for the publication workflow and editorial policy.
- Read the files directly involved in the requested change and check `git status` before editing.
- Treat `PotentialUnusedResources.html` as a research backlog, not an approved production source list.

## Working principles

- Keep changes tightly scoped to the user's request and preserve unrelated local work.
- Do not redesign the site during a daily-edition run. Preserve the locked palette, typography, open broadsheet layout, sharp rules, square media, responsive behaviour, keyboard navigation, and three-link homepage footer.
- Prefer the existing plain HTML, CSS, JavaScript, Python, and Node patterns. Do not introduce a framework, build system, or dependency unless the task clearly requires it.
- Maintain accessibility: semantic HTML, keyboard operation, meaningful alt text, readable contrast, and descriptive links.
- Volatile claims—including news, dates, weather, transport, prices, availability, people, policies, and schedules—must be verified live. Prefer primary sources and exact dates.
- Do not invent facts, quotes, links, coordinates, image rights, action URLs, or placeholder live data.

## Data and editorial invariants

- `index.html` contains the published newspaper and its rolling edition archive. Preserve its data structure and archive rotation rules.
- A new `today` edition must contain exactly ten stories: four adjacent Near Home activities, two Near Work stories, one London AI story, one London Technology story, and two Plan Ahead stories, in that order.
- Never rotate the archive twice on the same London date. Do not repeat yesterday's underlying stories, even under different headlines or sources.
- Treat `data/rss_candidates.json` as unverified discovery output. Refresh it with `python scripts/collect_candidates.py`; never treat it as reporting by itself.
- Treat `resources.html` as append-only production data. Deduplicate normalized hostnames, never remove existing cards, and never use an entry marked `data-status="do-not-use"`.
- Preserve all existing records in `data/upcoming-events.json` and `poi/data/editorial-pois.json` unless the governing daily prompt explicitly permits removal. Keep JSON valid, deduplicate additions, and use verified authoritative URLs.
- If `upcoming-events.js` changes, update its cache-busting version in `upcoming-events.html`.
- If the POI shell or source code changes, bump the POI service-worker version. A data-only POI append does not require a version bump.
- Preserve the established action rendering: verified `Book` and `Participate` actions use linked CTA styling; `Walk`, `Avoid`, and actions without a verified direct URL remain plain text.

## Validation

Run checks proportional to the change. For a full publication or any change touching shared site behaviour, run all of the following from the repository root:

```text
npm test
python -m py_compile scripts/collect_candidates.py
git diff --check
```

For POI-only work, also run its tests directly when useful:

```text
npm --prefix poi test
```

For rendered UI changes, serve the repository over HTTP and inspect the affected pages at desktop and mobile widths. A full daily run must inspect all three homepage date tabs plus `upcoming-events.html`, `about.html`, `resources.html`, and `poi/`; verify images, navigation, direct links, action styling, and browser-console errors.

Before handing off, review the final diff and report which checks ran and any checks that could not run.

## Publishing and Git

- Do not commit, push, deploy, or alter GitHub settings unless the user explicitly requests publication or supplies the complete daily-generation instruction that authorizes those actions.
- For an authorized daily publication, follow `DAILY_NEWS_PROMPT.md` through commit, push, deployment monitoring, and public verification. Do not report success before all required stages succeed.
- Never force-push. Never discard unrelated user changes.
- If research, validation, publishing, or deployment is blocked, preserve local work and report the exact blocker instead of claiming completion.
