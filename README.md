# Brian's London Daily News

A personal, mobile-first daily newspaper about London events, areas, and activities that Brian finds interesting. It is built from the strongest parts of two earlier projects:

- **Brian Daily News** supplies the editorial design, three-edition archive, personal five-story format, source directory, and integrated Nearby POI app.
- **NW3-News** supplies the lightweight RSS discovery pattern, deduplication, retained candidate history, and scheduled GitHub Actions job.

The automated job is deliberately a **candidate collector**, not the editor. It gathers possible stories into `data/rss_candidates.json`. Brian's daily Codex prompt then searches more broadly, opens and cross-checks sources, rejects repeats, writes the analysis, updates the three-edition archive in `index.html`, extends `resources.html`, validates the site, and publishes the result.

## Generate today's edition

1. Open this repository as a Codex task.
2. Copy and send the complete contents of [`DAILY_NEWS_PROMPT.md`](DAILY_NEWS_PROMPT.md).
3. Codex will read [`NEWS_CONTEXT.md`](NEWS_CONTEXT.md), the RSS candidates, the current edition, and the source directory before researching live news.

To refresh RSS candidates locally first:

```powershell
python scripts/collect_candidates.py
```

To validate the newspaper and POI app:

```powershell
npm test
```

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | The published newspaper and its three-edition data archive |
| `DAILY_NEWS_PROMPT.md` | The prompt Brian sends to Codex each day |
| `NEWS_CONTEXT.md` | Stable editorial context, source seeds, and quality rules |
| `data/rss_candidates.json` | Machine-collected leads; never treated as verified reporting |
| `scripts/collect_candidates.py` | Standard-library RSS collector adapted from NW3-News |
| `resources.html` | Append-only directory of sources used in published editions |
| `about.html` | Purpose and editorial method |
| `poi/` | Integrated Nearby POI single-page app |
| `assets/design-concept-*.png` | Desktop and mobile design references |

## Publishing

The site is static and suitable for GitHub Pages. Enable Pages for the `main` branch at the repository root. The candidate workflow can run on a schedule, but only the daily Codex workflow updates the public edition.

## Design

The masthead uses white editorial type on dark navy (`#08264A`). The newspaper body uses near-black text on very light cool grey (`#F3F5F7`), with restrained red and green accents. The layout preserves the open, rule-driven broadsheet character of Brian Daily rather than turning stories into generic cards.

## Provenance

This repository retains and adapts code from:

- <https://github.com/BrianGroth/Brian_Daily_News>
- <https://github.com/BrianGroth/NW3-News>
