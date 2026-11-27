# Daily operations and research

The editor still makes factual, novelty, geography and image-rights decisions. These commands perform repeatable work and store compact results. No command treats scraped data as verified reporting.

## Normal daily sequence

For the phrase “Make the quick update to the newspaper”, use `QUICK_NEWS_PROMPT.md`. The commands below remain the full-update flow.

```text
npm run daily:prepare
npm run lookup:context -- candidates ID
npm run lookup:context -- candidates --ids ID1,ID2
npm run lookup:context -- package ID
npm run read:source -- https://official.example/event --refresh
npm run read:source -- --urls https://official.example/event,https://official.example/other --refresh
npm run lookup:context -- images kenwood
npm run daily:apply -- --input .daily-work/verified-edition.json
npm run daily:apply -- --input .daily-work/verified-edition.json --write
npm run daily:validate
npm run daily:publish -- --reviewed
```

`prepare` first fetches `origin/main` and checks staged work, ancestry and tracked changes. A clean checkout behind main is fast-forwarded without force; divergent or conflicting local work stops before research. Untracked user files are preserved. Unexpected reachable local commits are surfaced early and refused before a daily publication push; a pending commit created by this runner remains retryable after a failed ordinary push.

After Node/browser/source/TLS preflight, normal preparation tries the latest successful main-branch scheduled/manual collection artifact `london-discovery`. It validates repository, run ID/revision, manifest schema, file allowlist, hashes, byte counts and source timestamps. Only same-London-day discovery no older than twelve hours qualifies. Missing credentials, unavailable artifacts or failed validation trigger normal local RSS/direct collection. `--refresh` always collects locally. It rebuilds the brief with current local code and archive context instead of importing an old ranked brief. Selected facts are still verified live. No automatic publication is scheduled.

Read `data/reading-brief.json` first. Eligible candidates and a separate bounded `verificationQueue` are explicit; unknown geography never fills a section. A successful same-day preparation can resume for two hours. The ordinary target is up to ten strong choices, preserving section order and caps, not a quota that forces weak picks.

Direct activity discovery uses the approved Heath Hands JSON listing, Hampstead Theatre programme, Barbican programme and City event listings. Extracted dates, offers and summaries are evidence leads. Listings without dates need a detail-page visit; booking availability is never inferred from a listing or an HTTP 200. Partial or empty adapters produce source-specific warnings and require live fallback research. Other sources remain available when coverage is weak.

`lookup:context candidates ID` returns a compact lead and alternate IDs; `--ids ID1,ID2` batches records, `--format full` retrieves full detail. `package ID` bundles the candidate with prior coverage, matching calendar records, reviewed image options and cached evidence without fetching sources. `--limit N` bounds output (default five, maximum fifty). Subject image search defaults to reviewed records; `images --key LEGACY_KEY` explicitly retrieves an exact record and its rights status. Canonical URL/headline flags assist repeat review, not semantic approval. Calendar context prioritises the next start or closing decision ahead of oldest ongoing exhibitions.

`read:source` fetches public credential-free HTTPS, prioritises structured/main/article content, and defaults to compact evidence packets. Fields include source date, activity dates/time, venue, price, audience, booking/cancellation statements, explicit unknowns/conflicts and raw-file pointers. `--format full` retains detailed metadata/extraction. Batch with `--urls URL1,URL2` or `--input PATH` containing a URL array or `{ "urls": [...] }`; maximum 24 URLs, concurrency 1–4 (default three). Use `--refresh` for selected volatile facts. Conditional HTTP revalidation does not prove booking availability.

Opt-in `--availability` supports public Heath Hands Beacon forms, Eventbrite event pages, UCL Zoom webinar registration and Barbican event date selectors. It requires the installed browser configuration and uses fresh contexts. Only read-only requests and date/time disclosure controls are permitted: no login, checkout, reservation, ticket purchase or form submission. Cookies/authorization are not forwarded. Output is a timestamped page observation, not a guarantee; failed/provider-changed/ambiguous pages return `unknown` and need editorial verification. A full selection budget never permits skipping that verification.

Raw bodies and latest extraction caches remain under ignored `.daily-work/evidence/`. Every reader request also writes an exclusive UUID record in `evidence/requests/`, including its actual `recordedAt`, original source `checkedAt`, request metrics and separate browser-request counts. Repeated or cached URL reads remain distinguishable. Each HTTP URL gets at most two attempts, permanent access failures one, and failed hosts must not be retried across many candidates. Cached files from another machine may not exist locally; re-fetch rather than assuming evidence is present.

`daily:apply` injects `pruneExpired: true`, previews additions and entries whose final date passed, and only writes with `--write`. It retains the helper's archive, conflict and recovery protections. A write invalidates the validation checkpoint. It never modifies an existing future event or POI silently. Cancellation and correction still require authoritative evidence and an explicit reviewed edit.

`daily:validate` refreshes finished context and checks render synchronisation, Node/POI tests, collector tests, Python compilation, whitespace and the complete desktop/mobile live browser tour. Each successful check has a dependency fingerprint. Browser checks depend on deployed runtime assets, edition data and their harness; documentation or image-library tag/date edits alone do not repeat the browser tour. Changed runtime content does. Live browser evidence expires after thirty minutes; failed checks never resume as success. Set `SMOKE_ARTIFACT_DIR` to keep screenshots outside the checkout.

`daily:publish --reviewed` is the explicit publication command after editorial and screenshot review. It requires today's London edition and valid checks, refuses existing staged changes or an advanced remote branch, stages the publication allowlist, commits if necessary, pushes without force and verifies the public manifest and critical asset hashes against local HEAD. Use `--paths path1,path2` only for a reviewed nonstandard publication; it never allows paths outside this repository. A push failure preserves the commit for retry. Public verification requires the GitHub Actions Pages pipeline. Full local live acceptance remains required; exact public asset checks avoid another full browser tour unless a deployment discrepancy needs diagnosis.

## Quick sequence (includes publication)

```text
npm run quick:prepare
npm run lookup:context -- candidates ID --quick
npm run quick:apply -- --input .daily-work/quick-verified-edition.json
npm run quick:apply -- --input .daily-work/quick-verified-edition.json --write
npm run quick:validate
npm run quick:publish -- --reviewed
```

The agent verifies and writes one to ten justified stories between prepare and apply. These commands do not generate prose or certify facts. Four official listing adapters and two site-restricted RSS queries replace normal discovery; quick mode never imports a broad artifact. Requests have an eight-second listing timeout and one attempt. Quick files live in ignored `.daily-work/quick/YYYY-MM-DD/`; `lookup:context --quick` never substitutes the normal discovery pool. The full tracked datasets remain untouched by quick preparation.

`scripts/quick_sources.json` limits each listing to eight leads, each section's eligible plus verification-queue candidates to 8/4/3/3/4, the calendar to twelve opportunities and selection to twelve minutes. At most one alternate per topic remains available within that total budget. Stop at ten strong choices or the selection limit; publish the smaller verified selection with a visible note if necessary. An empty verified selection stops publication. Facts/actions/images and morning conditions still require live verification. No automatic broadening. Ticket providers, papers and licence pages verify selected choices; they are not extra discovery sources.

Quick state/logs are separate under `.daily-work/runs/YYYY-MM-DD/quick/`; `npm run quick:status` reports them. Both modes share the writer lock, publication protections, tests and complete live browser acceptance. Quick brief regeneration is checkpointed after data changes so validation/publishing does not rebuild it needlessly. A quick publish stages the publication allowlist excluding the four normal discovery/brief files; ignored quick discovery is not uploaded. A preview-only request ends before publishing. `--refresh` forces quick rechecks only. `weekly:maintain -- --quick` is refused.

## Runtime and the managed proxy

Use Node 24 LTS. Network scripts use `--use-env-proxy`, honoring inherited proxy and CA settings without printing credentials. The preflight tries the normal pinned browser first and reuses an existing pinned browser in a sibling `.playwright-browsers` cache. If the browser alone rejects the managed proxy certificate while Node verifies the same image, it selects `proxy-bridge` and records this in `.daily-work/preflight.json`.

The bridge is limited to real public GET responses on known asset/API hosts plus the bounded, read-only Overpass map query. It forwards no browser cookies, credentials or arbitrary headers, does not access account endpoints, never disables TLS verification and supplies no fixtures. Live responses are reused only in memory within the check. Direct browser mode remains the default outside this environment. The bridge is test tooling, not production application code.

If tooling is absent, install it once with `npm ci` and `npx playwright install chromium`. Do not reinstall on each daily run. Source-specific failures do not justify changing TLS policy or relaxing browser assertions.

## Weekly catalogue upkeep

The Monday GitHub workflow refreshes broad discovery, uploads it as an artifact, removes only expired events and checks reviewed image source/licence pages. It uploads an image-review queue and commits only permitted calendar housekeeping without force. It cannot certify new event availability or place eligibility and never inserts unreviewed editorial records. Calendar changes still trigger the test-gated Pages workflow. Daily discovery has read-only repository permission and makes no commits. Manual publication may retain its discovery snapshots in the edition commit for reproducibility.

For editorial weekly upkeep, run `npm run weekly:maintain` (dry run) or `npm run weekly:maintain -- --write` (permitted expiry cleanup), review the candidate/image queue, verify future opportunities and new fixed places, then apply reviewed additions using the edition helper or the documented explicit store workflow. Keep broader year-ahead catalogue exploration here. The daily editor still saves every qualified event or place actually encountered while selecting up to ten stories; it does not explore an entire year's programme solely to fill the catalogue.

The image library `data/image-library.json` holds reviewed author, licence, source, subject and archive-use metadata for keys in the existing edition image catalogue. Look up an accurate existing image before researching a replacement. Weekly licence-page checks flag review needs; they do not establish rights automatically. Daily live browser checks still decode the selected photos. Never substitute generic stock or present archive equipment/venue photos as current event coverage.

## Reports and measurement

`npm run daily:status` shows checkpoints, per-attempt IDs, measurements and source-reader request metrics. Daily state remains `.daily-work/runs/YYYY-MM-DD/state.json` (or `quick/state.json`); append-only command logs and snapshots live below `attempts/RUN_ID/COMMAND_ID/`. Repeated subprocess names get sequence numbers. `prepare --new-run`, or preparation after a completed editorial write, starts a new attempt and resets its counters; successful valid checkpoints remain reusable. A pending publication commit is retained for failed-push recovery.

Command durations cover preparation, update, validation and publication; the research span is an editorial wall-clock interval including drafting/idle time. To measure those separately, use `npm run daily:mark -- research start`, `research end`, `drafting start/end` and `review start/end` (add `--quick` as applicable). Markers are explicit wall-clock observations, not model compute. Source metrics cover saved reader history only; tool-output bytes cover runner subprocess output only. Neither is total task payload or a token/cost estimate. Pass `--usage PATH` with actual nonnegative integer `inputTokens`/`outputTokens` from Codex/API telemetry when available. Compare several equivalent editions before claiming savings.

A process crash can leave `.daily-work/runner.lock`. Inspect its owner and whether that process is alive before removing it. Never delete helper recovery backups to get a faster restart. No runner command creates an edition's prose or supplies editorial approval.
