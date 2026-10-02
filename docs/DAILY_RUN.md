# Daily operations and research

The editor still makes factual, novelty, geography and image-rights decisions. These commands perform repeatable work and store compact results. No command treats scraped data as verified reporting.

## Normal daily sequence

```text
npm run daily:prepare
npm run lookup:context -- candidates ID
npm run read:source -- https://official.example/event --refresh
npm run lookup:context -- images kenwood
npm run daily:apply -- --input .daily-work/verified-edition.json
npm run daily:apply -- --input .daily-work/verified-edition.json --write
npm run daily:validate
npm run daily:publish -- --reviewed
```

`prepare` checks Node, browser, public source access and TLS first. It refreshes RSS and direct listings, then writes the full discovery index to `data/daily-brief.json` and the small model-facing view to `data/reading-brief.json`. Read the reading view first. A successful same-day preparation can resume for two hours; `--refresh` forces a new collection. This reuse does not verify any volatile claim. Selected events/news and weather/transit must still be checked live immediately before writing.

Direct activity discovery uses the approved Heath Hands JSON listing, Hampstead Theatre programme, Barbican programme and City event listings. Extracted dates, offers and summaries are evidence leads. Listings without dates need a detail-page visit; booking availability is never inferred from a listing or an HTTP 200. Partial or empty adapters produce source-specific warnings and require live fallback research. Other sources remain available when coverage is weak.

`lookup:context candidates ID` returns the full selected lead and alternative IDs. Request alternatives by ID rather than dumping them all. `--limit N` controls a bounded result count (default five, maximum fifty). Complete discovery data stays available on disk, including grouped alternatives. Exact IDs are preferred to broad searches. The reading brief includes all adjacent story headlines for semantic repeat review and only the nearest twelve calendar opportunities; full records are retrieved with `lookup:context`.

`read:source` fetches public HTTPS pages with no credentials, saves raw bodies under ignored `.daily-work/evidence/`, and prints a bounded extraction of dates, prices and action links. Use `--refresh` for selected facts. Conditional requests can establish an unchanged representation; cached bodies are explicitly labelled as needing re-verification. Each URL gets at most two attempts, permanent access failures get one, and failures have a fifteen-minute cooldown. Do not repeat a blocked booking form across several candidates: diagnose the shared host once, then select a qualified alternative. A source's raw body remains available for targeted inspection when extraction is incomplete. A cached file path from another machine may not exist locally; re-fetch the source rather than assuming the evidence is present.

`daily:apply` injects `pruneExpired: true`, previews additions and entries whose final date passed, and only writes with `--write`. It retains the helper's archive, conflict and recovery protections. A write invalidates the validation checkpoint. It never modifies an existing future event or POI silently. Cancellation and correction still require authoritative evidence and an explicit reviewed edit.

`daily:validate` refreshes finished brief context and checks data/render synchronization, Node/POI tests, collector tests, Python compilation, diff whitespace and the complete desktop/mobile live browser tour. Each successful check has a fingerprint. A resumed validation repeats failed or changed checks; live browser evidence expires after thirty minutes. Changed HTML, data, scripts, styles or tests invalidate dependent checks. Logs and screenshots stay under `.daily-work/runs/YYYY-MM-DD/`.

`daily:publish --reviewed` is the explicit publication command after editorial and screenshot review. It requires today's London edition and valid checks, refuses existing staged changes or an advanced remote branch, stages the publication allowlist, commits if necessary, pushes without force and verifies the public manifest and critical asset hashes against local HEAD. Use `--paths path1,path2` only for a reviewed nonstandard publication; it never allows paths outside this repository. A push failure preserves the commit for retry. Public verification requires the GitHub Actions Pages pipeline. Full local live acceptance remains required; exact public asset checks avoid another full browser tour unless a deployment discrepancy needs diagnosis.

## Runtime and the managed proxy

Use Node 24 LTS. Network scripts use `--use-env-proxy`, honoring inherited proxy and CA settings without printing credentials. The preflight tries the normal pinned browser first and reuses an existing pinned browser in a sibling `.playwright-browsers` cache. If the browser alone rejects the managed proxy certificate while Node verifies the same image, it selects `proxy-bridge` and records this in `.daily-work/preflight.json`.

The bridge is limited to real public GET responses on known asset/API hosts plus the bounded, read-only Overpass map query. It forwards no browser cookies, credentials or arbitrary headers, does not access account endpoints, never disables TLS verification and supplies no fixtures. Live responses are reused only in memory within the check. Direct browser mode remains the default outside this environment. The bridge is test tooling, not production application code.

If tooling is absent, install it once with `npm ci` and `npx playwright install chromium`. Do not reinstall on each daily run. Source-specific failures do not justify changing TLS policy or relaxing browser assertions.

## Weekly catalogue upkeep

The Monday GitHub workflow refreshes broad official listing discovery, removes only expired events and checks the reviewed image-library source/licence pages. It uploads an image-review queue and commits discovery/housekeeping files without force. It cannot certify a new event's booking status or a new place's eligibility, so it never inserts unreviewed discoveries into the editorial stores. Discovery-only changes do not deploy; calendar removals do.

For editorial weekly upkeep, run `npm run weekly:maintain` (dry run) or `npm run weekly:maintain -- --write` (permitted expiry cleanup), review the candidate/image queue, verify future opportunities and new fixed places, then apply reviewed additions using the edition helper or the documented explicit store workflow. Keep broader year-ahead catalogue exploration here. The daily editor still saves every qualified event or place actually encountered in the bounded ten-story research; it does not explore an entire year's programme solely to fill the catalogue.

The image library `data/image-library.json` holds reviewed author, licence, source, subject and archive-use metadata for keys in the existing edition image catalogue. Look up an accurate existing image before researching a replacement. Weekly licence-page checks flag review needs; they do not establish rights automatically. Daily live browser checks still decode the selected photos. Never substitute generic stock or present archive equipment/venue photos as current event coverage.

## Reports and measurement

`npm run daily:status` shows checkpoints. The runner records exact command/phase durations, source request/cache/failure counts, captured tool-output bytes and preserved failure logs. Raw HTML is not printed by default. Tool-output bytes are a measurable payload proxy, **not** a token count or a cost estimate. Actual model token usage is available only from the Codex/API usage report; pass `--usage PATH` with JSON `inputTokens` and `outputTokens` when that telemetry is available. Never estimate it from bytes. Report research time separately from preparation, update, validation and deployment. Compare several routine editions before claiming a total speed improvement.

A process crash can leave `.daily-work/runner.lock`. Inspect its owner and whether that process is alive before removing it. Never delete helper recovery backups to get a faster restart. No runner command creates an edition's prose or supplies editorial approval.
