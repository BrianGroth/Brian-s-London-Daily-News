# Applying a verified daily edition

The helper performs mechanical bookkeeping after editorial research. It does not fetch news, verify facts, establish image rights, or approve publication. Use it only with a fully verified edition, then complete the checks in `DAILY_NEWS_PROMPT.md`.

```text
node scripts/apply_edition.mjs path/to/verified-edition.json
node scripts/apply_edition.mjs path/to/verified-edition.json --write
```

The first command validates and reports proposed changes without writing. The second applies the same input to the local repository. Neither command commits, pushes, deploys, or changes GitHub settings. Keep the temporary input outside versioned publication assets.

## Input contract

Provide one JSON object with these fields:

| Field | Required | Content |
| --- | --- | --- |
| `date` | Yes | Verified current London date, `YYYY-MM-DD` |
| `edition` | Yes | `{ "morning": {...}, "stories": [...] }` using the existing edition schema |
| `images` | No | New image keys mapped to `{ "src", "alt", "credit" }` |
| `events` | No | Verified event records to append |
| `pois` | No | Verified editorial POI records to append |
| `pruneExpired` | No | Boolean; preview/remove only events whose final date is before the proposed edition date |
| `resources` | No | New directory cards, described below |

Use the existing fields in `data/editions.json` as the story and morning-strip schema. Omit `label` and `footer`: the helper derives them from `date`. Supply exactly ten stories in the existing 4/2/1/1/2 order. Story IDs start with `date`; image keys must exist in the combined image catalogue. `Book` and `Participate` require direct HTTPS `actionUrl` values. All URLs must be HTTP(S), without embedded credentials, and cannot be Google News redirects or blocked source domains. Images and action links use HTTPS.

The helper retains `Nearby POI` linking to `poi/`, requires the weather link to the Met Office forecast service, and requires Northern/Overground status tuples linking to TfL. Supply verified facts, never “Check live”. The existing `good` and `check` transit styling values remain unchanged.

Use the schemas in `data/upcoming-events.json` and `poi/data/editorial-pois.json` for new records. Their `addedOn` date must match the proposed edition date. Events need valid, still-upcoming date ranges and `HH:MM` times when supplied. POIs need numeric WGS84 coordinates and a category from `poi/js/lib/categories.js`. Unknown fields are rejected. By default the helper preserves expired records. `pruneExpired: true` previews and removes only events whose final date is before the edition date; the daily runner enables this automatically. Future corrections/cancellations remain separate evidence-based reviewed edits.

Each `resources` item has exactly four fields:

```json
{
  "name": "Verified source name",
  "url": "https://example.org/",
  "description": "A factual description of the source and its editorial usefulness.",
  "section": "local-sources"
}
```

Allowed resource sections are `local-sources`, `poi-sources`, `institutions-sources`, and `reporting-sources`. Every hostname cited in story sources must already have a directory card or receive one in this input. Hostnames are normalized to lowercase without `www.`; resource text and attributes are HTML-escaped. Existing cards are preserved verbatim. Existing domains are reported as unchanged; `do-not-use` sources and their subdomains cannot be used or reactivated.

## Preservation and duplicate review

- A newer date rotates the archive once. The same date replaces only `today`; an older date is rejected. All retained archive IDs remain unique. Identical reruns produce no file changes.
- Existing image entries cannot be changed through this helper, because that could alter archived stories. Supply a new image key for a corrected image.
- Existing event and POI records are immutable. Identical ID/content matches are explicitly reported as unchanged. Conflicting content under an existing ID stops the entire update.
- Event records with overlapping dates and a matching normalized title or canonical source URL stop for review. Repeated events on non-overlapping dates remain possible.
- POIs with matching canonical venue/source URLs, or matching normalized names within 45 metres, stop for review. Compare new places against the POI application's other sources as required by the daily prompt; those live sources are outside this helper.
- An exact normalized headline match with yesterday is rejected, but semantic story repetition, two angles on one event, freshness, geography, article quality, licensed images and authoritative direct links still require editorial judgement. Duplicate heuristics may produce false positives: review the existing record and correct the proposed input; the helper never silently discards a suspected new record.

The JSON report lists archive handling, added/unchanged record IDs or source domains, and files that would change. Store `updatedAt` values change only when their records are appended. The calendar loads its JSON dynamically and has no separate HTML rendering step; browser verification of its visible date, count and Month/Agenda views is still required.

## Write safety and recovery

All input, store merges, directory coverage and homepage rendering are validated in memory before any file is replaced. Changed files are staged under a temporary `.edition-update-*` directory inside the repository. The helper checks that its input files have not changed during preparation, saves originals, installs staged files, and rolls back ordinary write failures. It preserves recovery backups if rollback itself fails and reports their location.

This is a local multi-file update, not a crash-atomic database transaction. Do not run concurrent edition writers. A terminated process or power loss during installation may leave a `.edition-update-*` directory containing originals named `*.backup`. Inspect and restore those originals before rerunning; do not delete a recovery directory without checking it. Run the normal tests and review the final diff before publication.
