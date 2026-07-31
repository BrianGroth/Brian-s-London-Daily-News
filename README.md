# Brian's London Daily News

A self-contained, personal, mobile-first daily newspaper about London events, areas, and activities that Brian finds interesting.

Everything required to research, produce, validate, and publish the newspaper is contained in this repository: the editorial design, three-edition archive, source directory, Nearby POI app, RSS candidate collector, tests, and publication instructions. It does not depend on another code repository.

## Generate today's edition

**Brian has one required action:** open this repository as a Codex task and send the complete contents of [`DAILY_NEWS_PROMPT.md`](DAILY_NEWS_PROMPT.md).

That one prompt instructs Codex to:

- refresh the RSS candidate file;
- research and verify live sources;
- select, analyse, categorise, and write the five stories;
- update weather and current TfL status;
- update `index.html` and the source directory;
- run Python/Node validation and browser checks;
- commit, push, and verify the published edition.

Brian does **not** need to run Python or npm separately. Those commands are implementation and validation steps that Codex runs while fulfilling the prompt. The scheduled GitHub Action is an optional background head start: it refreshes candidates each morning, but it is not required for the prompt to work and it never edits the newspaper.

If a Codex run cannot execute one of its internal steps, it must continue with safe alternatives where possible and report the exact blocker rather than asking Brian to infer which command to run.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | The published newspaper and its three-edition data archive |
| `DAILY_NEWS_PROMPT.md` | The prompt Brian sends to Codex each day |
| `NEWS_CONTEXT.md` | Stable editorial context, source seeds, and quality rules |
| `data/rss_candidates.json` | Machine-collected leads; never treated as verified reporting |
| `scripts/collect_candidates.py` | Self-contained standard-library RSS candidate collector |
| `resources.html` | Append-only directory of sources used in published editions |
| `about.html` | Purpose and editorial method |
| `poi/` | Integrated Nearby POI single-page app |
| `assets/design-concept-*.png` | Desktop and mobile design references |

## Publishing

The site is static and suitable for GitHub Pages. Enable Pages for the `main` branch at the repository root. The candidate workflow can run on a schedule, but only the daily Codex workflow updates the public edition.

## Design

The masthead uses white editorial type on dark navy (`#08264A`). The newspaper body uses near-black text on very light cool grey (`#F3F5F7`), with restrained red and green accents. The layout uses an open, rule-driven broadsheet composition rather than generic cards.
