# Quality-first editions and reusable evidence

Status: accepted for local implementation, 27 November 2026. Publication remains a separate authorized action.

## Decision

Keep the static newspaper, JSON stores, deterministic renderer, GitHub Pages and the established broadsheet design. Brian selected fewer stories when useful material is weak and equal eligibility for useful AI/technology events and news.

Publish one to ten justified stories in existing section order, with maximums of 4 Near Home, 2 Near Work, 1 London AI, 1 London Technology and 2 Plan Ahead. Sections may be unfilled. The helper supplies a count explanation for a shorter edition; editorial text can override it. Empty editions are rejected. This supersedes ADR 001's fixed ten-story success criterion, not its verification or preservation safeguards.

Make geographical eligibility separate from ranking. Operator/publisher names are not venue locations. Unknown or contradictory location leads remain in a bounded verification queue. Group recurring activities by occurrence date, not just title/URL. Use the next useful start/closing date for calendar discovery and retain audience and likely-repeat flags. These heuristics never establish reporting or final eligibility automatically.

Expose compact candidate packages and evidence packets, with explicit unknowns/conflicts, direct public action links and raw-source pointers. Familiar availability providers have opt-in, read-only browser adapters; no form submissions or reservations. Cache timestamps and actual request timestamps remain distinct. Subject image lookup defaults to reviewed provenance; an explicit exact-key lookup can retrieve flagged legacy records. Stable photos support per-story wording while preserving their catalogue attribution.

Scheduled discovery uploads allowlisted, hashed, provenance-labelled snapshots rather than pushing daily commits. Preparation imports only compatible same-London-day snapshots no older than twelve hours, from a successful default-branch scheduled/manual collection, and rebuilds the brief locally. Unavailable, old or incompatible artifacts fall back to ordinary local collection. Selected facts still require live verification. Weekly maintenance commits only permitted calendar expiry cleanup.

Check main ancestry before research; safely fast-forward only a clean non-divergent checkout. Refuse unexpected reachable local commits before publication, even when the file staging allowlist is safe. Preserve failed-push recovery commits. Logs and source request records are append-only per attempt; actual token telemetry is optional and never inferred from payload bytes.

The reader sees actual publication dates, dated condition snapshots and a stale-issue notice. Headline/section navigation and an optional compact mode shorten mobile scanning. Calendar days reveal all entries, filtering happens before overflow limits, and stable event deep links connect the two views. Calendar export is deferred until end times/recurrence can be represented faithfully.

## Validation and limits

Keep the complete desktop/mobile live publication acceptance tour. Fingerprint its actual runtime/test dependencies so unrelated metadata changes do not repeat it. Test date/DST edges, skipped issues, event overflow/search, deep-link history, evidence extraction, eligibility and recurrence, snapshot provenance/tampering/freshness, Git ancestry and failure recovery. Preserve all existing archive, future-event, source-directory and POI records unless existing editorial rules explicitly permit otherwise.

No new paid service, database, model API, vector store or frontend framework. Geography and prior-coverage heuristics remain explainable discovery assistance. Measure several comparable runs before claiming time or token savings.
