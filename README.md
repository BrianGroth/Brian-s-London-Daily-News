# Brian's London Daily News

A self-contained, personal, mobile-first daily newspaper about London events, areas, and activities that Brian finds interesting.

Everything required to research, produce, validate, and publish the newspaper is contained in this repository: the editorial design, three-edition archive, source directory, Nearby POI app, RSS candidate collector, tests, and publication instructions. It does not depend on another code repository.

## Generate today's edition

**Brian has one required action:** open this repository as a Codex task and send the complete contents of [`DAILY_NEWS_PROMPT.md`](DAILY_NEWS_PROMPT.md).

That one prompt instructs Codex to:

- refresh the RSS candidate file;
- reduce hundreds of raw leads to a compact, ranked daily brief;
- research and verify live sources;
- select, analyse, categorise, and write the ten stories (two per section);
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
| `resources.html` | Append-only directory of sources used in published editions |
| `about.html` | Purpose and editorial method |
| `poi/` | Integrated Nearby POI single-page app |
| `assets/design-concept-*.png` | Desktop and mobile design references |

## Publishing

The site is static and suitable for GitHub Pages. Enable Pages for the `main` branch at the repository root. The candidate workflow can run on a schedule, but only the daily Codex workflow updates the public edition.

Useful internal commands, normally run by Codex through the prompts, are:

```text
python scripts/collect_candidates.py
npm run prepare:brief
npm run render:edition
npm test
```

## Design

The masthead uses white editorial type on dark navy (`#08264A`). The newspaper body uses near-black text on very light cool grey (`#F3F5F7`), with restrained red and green accents. The layout uses an open, rule-driven broadsheet composition rather than generic cards.
