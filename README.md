# Brian's London Daily News

A self-contained, personal, mobile-first daily newspaper about London events, areas, and activities that Brian finds interesting.

Everything required to research, produce, validate, and publish the newspaper is contained in this repository: the editorial design, three-edition archive, source directory, Nearby POI app, RSS candidate collector, tests, and publication instructions. It does not depend on another code repository.

## Generate today's edition

**Brian has one required action:** open this repository as a Codex task and send the complete contents of [`DAILY_NEWS_PROMPT.md`](DAILY_NEWS_PROMPT.md).

That one prompt instructs Codex to:

- refresh the RSS candidate file;
- reduce hundreds of raw leads to a compact, ranked daily brief;
- research and verify live sources;
- select, analyse, categorise, and write the ten stories (four near home, two near work, one each for London AI and technology, and two plan-ahead items);
- update weather and current TfL status;
- update structured edition data, deterministically render `index.html`, and maintain the source directory;
- run Python/Node validation and browser checks;
- commit, push, and verify the published edition.

Brian does **not** need to run Python or npm separately. Those commands are implementation and validation steps that Codex runs while fulfilling the prompt. The scheduled GitHub Action is an optional background head start: it refreshes the candidate pool and compact brief each morning, but it is not required for the prompt to work and it never edits the newspaper.

If a Codex run cannot execute one of its internal steps, it must continue with safe alternatives where possible and report the exact blocker rather than asking Brian to infer which command to run.

The optimized workflow is designed for a balanced, lower-cost Codex model at low or medium reasoning. It starts with `data/daily-brief.json` and reads the much larger RSS discovery file only when the shortlist is insufficient. A frontier model remains useful as a fallback for conflicting evidence, difficult verification or failed validation—not as the default for every mechanical step.

## Rediscover or change the whole project

For structural changes, troubleshooting, feature work or a fresh audit of how everything fits together, use [`NEWSPAPER_MAINTENANCE_PROMPT.md`](NEWSPAPER_MAINTENANCE_PROMPT.md). It tells Codex to rebuild an accurate project map, distinguish generated output from editable source, implement the requested change and update the daily prompt when architecture moves.

The maintenance prompt does not publish a daily edition unless the request explicitly says to do so. Continue using `DAILY_NEWS_PROMPT.md` for the daily newspaper.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | The published self-contained newspaper; its edition data block is generated |
| `DAILY_NEWS_PROMPT.md` | The prompt Brian sends to Codex each day |
| `NEWSPAPER_MAINTENANCE_PROMPT.md` | Whole-project rediscovery, repair and feature-work prompt |
| `NEWS_CONTEXT.md` | Stable editorial context, source seeds, and quality rules |
| `data/rss_candidates.json` | Machine-collected leads; never treated as verified reporting |
| `data/daily-brief.json` | Compact ranked discovery view used by the normal daily run |
| `data/editions.json` | Editable source of truth for images and the rolling three-edition archive |
| `data/upcoming-events.json` | Verified future events collected during daily research |
| `upcoming-events.html` | Searchable month and agenda calendar for planning ahead |
| `scripts/collect_candidates.py` | Self-contained standard-library RSS candidate collector |
| `scripts/prepare_daily_brief.mjs` | Deterministic candidate reduction and context assembly |
| `scripts/render_edition.mjs` | Deterministic renderer from edition JSON to the static homepage |
| `scripts/apply_edition.mjs` | Validated dry-run/write helper for verified editions and append-only additions |
| `scripts/lookup_context.mjs` | Full-record lookups without rereading entire editorial stores |
| `scripts/browser_smoke.mjs` | Repeatable desktop/mobile browser acceptance checks |
| `docs/EDITION_INPUT.md` | Verified input format and edition update safeguards |
| `docs/PUBLISHING.md` | Pages workflow activation, validation and rollback |
| `resources.html` | Append-only directory of sources used in published editions |
| `about.html` | Purpose and editorial method |
| `poi/` | Integrated Nearby POI single-page app |
| `assets/design-concept-*.png` | Desktop and mobile design references |

## Publishing

The site is static and suitable for GitHub Pages. The repository includes a tested, path-filtered Pages workflow; see `docs/PUBLISHING.md` for activation and rollback. Existing branch-based Pages settings remain in effect until an explicitly authorized settings change. The candidate workflow can run on a schedule, but only the daily Codex workflow updates the public edition. Discovery-only changes do not trigger the new deployment workflow once activated.

Useful internal commands, normally run by Codex through the prompts, are:

```text
python scripts/collect_candidates.py
npm run prepare:brief
npm run render:edition
npm test
npm run test:collector
```

## Efficient daily preparation

The collector fetches independent feeds with bounded concurrency and reports per-feed failures. A refreshed JSON timestamp alone does not establish successful collection. The brief uses the actual preparation time and London calendar date; it surfaces stale discovery, source restrictions and coverage gaps. Activity and primary-source signals improve lead ordering, while grouped alternative coverage remains available. Neither ranking nor grouping verifies a story.

Read the brief first, then retrieve only the complete records needed for editorial decisions:

```text
npm run lookup:context -- editions
npm run lookup:context -- stories "hampstead"
npm run lookup:context -- events "heath"
npm run lookup:context -- pois "kenwood"
npm run lookup:context -- resources "heath-hands.org.uk"
npm run lookup:context -- images "keats"
```

Exact IDs/domain names/image keys take precedence over case-insensitive text search. Lookup returns complete matching records, including image details for stories and status for resources. The helper never modifies data. Use the complete adjacent story summaries for semantic duplicate review; matching IDs alone is insufficient.

Prepare verified additions using `docs/EDITION_INPUT.md`. The edition update helper defaults to a dry run, preserves the archive on same-day reruns, and rejects conflicting additions before writing. Keep temporary editorial input in ignored `.daily-work/`; do not commit unverified research. The helper cannot establish source accuracy, image rights or semantic novelty. Verified calendar corrections/removals still require the documented explicit manual path.

For browser checks, install development tooling once with `npm ci` and `npx playwright install chromium`. Run `npm run test:browser` for deterministic UI regression checks and `npm run test:browser:live` for real image/network checks before daily publication. Keep visual review and live source/booking verification. Both modes exercise the full companion-page tour; see `docs/PUBLISHING.md` for options and evidence output. Playwright is development-only; the deployed site retains its existing dependency-free architecture.

Measure research time, usable shortlisted leads, update time and validation time separately when assessing savings. Preserve the 39 existing tests and full editorial/browser checks rather than trading coverage for a faster reported run.

## Design

The masthead uses white editorial type on dark navy (`#08264A`). The newspaper body uses near-black text on very light cool grey (`#F3F5F7`), with restrained red and green accents. The layout uses an open, rule-driven broadsheet composition rather than generic cards.
