# Daily workflow efficiency without weaker editorial checks

Status: accepted for local implementation; Pages activation requires authorized publication.

## Decision

Keep the static site and its established visual system. Improve candidate selection, bounded feed fetching, freshness diagnostics and deterministic data updates. Give the editor compact context and targeted full-record lookup rather than repeatedly reading entire stores. Retain live verification of selected facts, source/booking links, image rights and semantic story novelty.

Use a dry-run-first edition update helper with validation and preservation of existing records. Keep explicit human review for ambiguous duplicates and permitted calendar corrections/removals. Never interpret machine ranking as reporting.

Add Playwright as a development-only dependency to automate the full desktop/mobile browser checklist. Deterministic CI checks isolate third-party network variability; live publication checks still require real images and live source verification. Do not remove the existing fast Node/POI test suite.

Prepare a test-gated Pages workflow that responds to publishable changes rather than candidate refreshes. Preserve current settings until publication is explicitly authorized. No paid service or application framework is required.

## Reasons and limits

The review found that current build/test operations take seconds, while candidate quality and repeated editorial bookkeeping are stronger opportunities for improvement. Shortlist keyword matches can select local news that does not satisfy the activity-led Near Home requirement. Feed failure can leave old candidates with a new file timestamp. Discovery-only commits also trigger unnecessary legacy Pages builds.

Success means less research/update effort with at least the same usable lead coverage, ten justified stories, all freshness/duplicate checks and unchanged visual behavior. Measure research, update, validation and deployment separately. Faster feed fetches alone do not establish a faster or better edition.
