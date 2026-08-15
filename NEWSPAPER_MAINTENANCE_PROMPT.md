# Whole-project rediscovery and maintenance prompt

Copy everything below the divider into a Codex task opened in this repository. Replace the bracketed request near the top with the change you want.

This is for structural changes, repairs, feature work and complete project rediscovery. Continue using `DAILY_NEWS_PROMPT.md` for the normal newspaper run.

---

Rediscover, update and maintain the complete **Brian's London Daily News** project.

My requested change or investigation is:

> [DESCRIBE THE CHANGE, PROBLEM OR IDEA HERE]

Treat this as a whole-project engineering task, not a daily newspaper publication unless my request explicitly says otherwise.

## Rediscover the current system before deciding

1. Read the repository-level `AGENTS.md` instructions if present, then read `README.md`, `DAILY_NEWS_PROMPT.md` and `NEWS_CONTEXT.md` completely.
2. Inspect the current git branch and status. Preserve uncommitted and untracked user work, and never discard unrelated changes.
3. Use `rg --files` to inventory the repository. Read `package.json`, tests, GitHub workflows and the files directly involved in my request.
4. Reconstruct the live data flow from source rather than relying on prior assumptions:
   - `scripts/collect_candidates.py` creates the unverified discovery pool in `data/rss_candidates.json`;
   - `scripts/prepare_daily_brief.mjs` reduces it deterministically to `data/daily-brief.json`;
   - `data/editions.json` is the editable source for images and the three newspaper editions;
   - `scripts/render_edition.mjs` embeds that data into the self-contained `index.html`;
   - `data/upcoming-events.json`, `resources.html` and `poi/data/editorial-pois.json` are durable append/preserve stores governed by the daily prompt;
   - GitHub Pages publishes the static site.
5. Distinguish authored source from generated output. Never hand-edit the generated edition block in `index.html`; edit `data/editions.json` or the renderer and run `npm run render:edition`.
6. Identify the relevant invariants, tests, cache-busting rules, service-worker rules, accessibility requirements and publication boundaries before editing.

## Implement the requested change

- Make the smallest coherent change that fully solves my request, but update every directly affected script, test, prompt and piece of documentation so the system does not become internally inconsistent.
- Preserve the locked newspaper design unless I explicitly request a redesign.
- Preserve published archive records, future events, source cards and editorial POIs unless their governing rules explicitly permit a change.
- Prefer the existing static HTML, CSS, JavaScript, Node and Python architecture. Add a dependency or framework only when the request clearly justifies its ongoing cost.
- Keep expensive model judgement focused on research, ambiguity and editorial decisions. Use deterministic scripts for parsing, ranking, deduplication, rotation, rendering and validation.
- Keep `DAILY_NEWS_PROMPT.md` as Brian's single normal daily command. If the project architecture changes, update that prompt in the same task so it remains executable end to end.
- Do not publish a new daily edition merely because sample or fixture data is needed. Use the existing edition as the compatibility fixture unless my request explicitly authorizes publication.

## Validate proportionally

1. Run `npm run render:edition` whenever `data/editions.json` or the renderer changes.
2. Run `npm test`, `python -m py_compile scripts/collect_candidates.py`, and `git diff --check` for any structural workflow change.
3. Run the directly affected scripts with real repository data and inspect their generated output for size, correctness, determinism and useful failure messages.
4. For rendered changes, serve the site over HTTP and inspect affected pages at desktop and mobile widths. Check keyboard operation, overflow, images, direct links, console errors and accessible names.
5. Review the final diff and state precisely what changed, which checks passed and any residual risk or follow-up.

## Git and publication boundary

- Do not commit, push, merge, deploy or change GitHub settings unless my requested change explicitly authorizes it.
- If I request a branch, use a valid Git branch name, explain any necessary normalization, publish only the intended files and verify the remote branch SHA.
- Never force-push and never report success before requested remote work is verified.

When uncertain, investigate the repository and live behaviour first. Ask me only when a missing choice would materially change the intended product.
