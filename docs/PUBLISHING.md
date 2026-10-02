# Validation and publishing operations

The website stays plain HTML, CSS and JavaScript. Daily research still verifies
sources, actionable dates, availability, prices, image rights, and story diversity
live. Browser automation checks behavior; it cannot certify reporting or image
licensing. No paid service, production dependency, or application redesign is added.

## Local prerequisites

- Node 24 LTS and Python 3.12 match CI. The runtime major versions are deliberately
  maintained; Actions themselves use immutable commit pins.
- Run `npm ci` to install the exact lockfile. Playwright is development tooling only.
- Run `npx playwright install chromium` once. Linux CI also installs browser system
  packages with `npx playwright install --with-deps chromium`.
- An installed Edge can be used when the Chromium download is unavailable:
  append `--channel msedge`, or set `PLAYWRIGHT_CHANNEL=msedge`.
- Startup, evidence caching and resumable checks are documented in `docs/DAILY_RUN.md`. No API keys or new repository secrets are needed. Source-network access is needed
  for collection and the live browser check.

## Daily acceptance

After the authorized editorial update, run the normal renderer, tests, collector
unit tests, Python compile check and `git diff --check`. Run the full browser tour:

```text
npm run test:browser:live -- --expected-date YYYY-MM-DD
```

Use the actual Europe/London publication date. The browser command starts and stops
its own loopback HTTP server. It checks desktop (1440 × 1000) and mobile (390 × 844):

- All three edition tabs, story counts, current section mix, visible date, keyboard
  selection, actual image decoding, image credit/alt text, source destinations,
  link-vs-plain CTA styling, footer destinations, console errors and overflow.
- Calendar updated date, current future-event count, all stored events in their
  start month (including crowded-cell overflow), future entries in Agenda, event
  dialogs, search, view switching and keyboard activation.
- About, Sources, return navigation, Nearby POI results using a fixed test
  geolocation, category filtering and map focus.

The tour selects a real existing editorial POI's location for reproducibility.
For newly appended POIs, also inspect their specific map areas and verify the new
records are discoverable, as required by the daily prompt. Browser contexts are
fresh and service workers are blocked to check current files; this does not test
offline installation or service-worker upgrade behavior.

Screenshots go to a new directory under the operating system temporary directory.
Set `SMOKE_ARTIFACT_DIR` to choose another location. The output reports that path,
per-check durations, and total duration. `report.json` in the same directory records
every check's result, complete failure details, failure screenshot names, and browser
console warnings/errors with page URLs per viewport. Terminal output stays concise.
An archived-image failure does not stop remaining edition, keyboard or navigation
checks; it still fails the run. Review screenshots for visual problems
that structural assertions cannot detect. Keep evidence outside the repository.

`npm run test:browser` is the separate, repeatable **CI regression** check. It uses
real local data, HTML, CSS and JavaScript, but supplies empty remote API responses,
placeholder external images and fallback fonts. It does not establish that live
images, remote APIs or webfonts work and never substitutes for daily live acceptance.
Live network failures are reported as failures; investigate them rather than
switching to isolated mode and reporting publication success.

The browser runner verifies that rendered source and action URLs match the reviewed
edition data. It does not automatically visit every outbound destination: live
editorial verification remains required. Test screenshots containing placeholders
are regression evidence only, not production visual approval.

## Pipeline and activation

`collect-candidates.yml` remains the independent discovery head start. It uses
explicit Python/Node versions, immutable Actions, a ten-minute timeout and a single
writer. A concurrent publication can cause its ordinary push to fail safely;
rerun against the latest main revision rather than force-pushing. Feed health and
freshness must be checked; scheduled delivery is not guaranteed.

`pages.yml` validates pull requests and changes to main, excluding pushes which
only change the raw candidates and compact brief. It installs from the lockfile,
runs Node/Python validation, stages only public runtime files, then runs browser
regression checks against that staged artifact before uploading it. Screenshots
are retained for seven days. The public artifact excludes discovery files,
structured edition inputs, image-rights metadata, prompts, tests, package dependencies and operational
documentation; it includes the calendar and POI runtime stores.

The target is **GitHub Actions** as the single Pages source. Discovery-only commits (RSS, direct candidates, full brief and reading brief) are excluded. The Monday weekly discovery workflow additionally removes expired calendar entries and saves a reviewed-image queue; an actual calendar change triggers validation. Until activation is verified, legacy branch publication remains active.

Activation is an explicit hosting operation: publish and validate this workflow, then dispatch `pages.yml` with `activate_pages=true`. After validation, its deployment job uses its narrowly scoped Pages-write token to request the hosting change. Subsequent deployments run when the current Pages source is `workflow`; setting the optional repository variable `PAGES_ACTIONS_ENABLED=false` pauses them. If GitHub denies activation, a repository administrator must select **Settings → Pages → Source → GitHub Actions**. Preparation and validation never change hosting settings.

Only the deployment job receives `pages:write` and `id-token:write`; validation has
read access and checkout does not persist credentials. Pull requests cannot deploy.
Keep the `github-pages` environment restricted to main. The collector alone has
repository write access for its existing data commits. No long-lived deployment
token is introduced.

The new workflow can reduce deployment noise only after activation. GitHub Pages
is sufficient for this personal static site; no separate paid staging environment
is required. Local HTTP is development/preview, a validated artifact is the
candidate release, and the Pages job publishes production. Standard Actions and
artifact limits still apply; browser setup increases validation runtime, so browser
downloads are not cached speculatively. The npm download cache is keyed by lockfile
and `npm ci` still verifies dependencies.

## Deployment evidence and recovery

Each staged site contains `deployment.json` with its Git commit, issue label and
SHA-256 of `index.html` and critical public HTML, CSS, JS and calendar/POI assets. The deployment job retries public fetches briefly and
requires both the expected commit and exact homepage digest to match. The daily runner uses `verify_public.mjs` to compare those assets with local HEAD, avoiding a second complete UI tour when the already-tested bytes match. A successful
upload alone is not deployment verification.

After activation, a normal public smoke check is:

```text
npm run test:browser:live -- --base-url https://briangroth.github.io/Brian-s-London-Daily-News/ --expected-date YYYY-MM-DD
```

Run it from the checkout corresponding to the deployed revision so local expected
calendar/edition data agrees with production. A failure preserves the checked-in
work; consult Actions logs, browser evidence and the public manifest before retrying.

For rollback, manually dispatch the workflow **from main** and supply the full
40-character known-good commit as `restore_sha`. The workflow rebuilds and retests
that revision, deploys it without rewriting main, and verifies its actual older
edition label and digest. Choose a revision containing this pipeline's package
lock, staging and test commands; older revisions require a reviewed safe-forward
revert of the problematic changes followed by normal validation. Retain the run URL,
chosen revision and public evidence in the release record. The next normal main
push publishes main again, so fix or revert the underlying change before it lands.

To stop custom deployments, set `PAGES_ACTIONS_ENABLED` to `false`; this leaves the
last published site available. Returning to the previous deployment method requires
an authorized Pages source change to `main` and `/`. Do not force-push for recovery.

Maintain action pins and the Playwright lockfile deliberately. Re-run Node/Python
and browser checks when updating them. Official references:
[custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[workflow triggers and filters](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run),
[Playwright browser contexts](https://playwright.dev/docs/api/class-browsercontext),
[Node release schedule](https://nodejs.org/en/about/previous-releases).
