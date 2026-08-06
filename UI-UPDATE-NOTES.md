# UI-Update branch — developer notes

Written for whoever turns this branch into a PR. Context: Brian reviewed the live site with a design critique, then compared three mobile-first mockups, and picked one ("Fleet Street, Fixed") with three specific changes: real photography instead of placeholder art, the redundant "Points of Interest" footer link removed, and the daily edition expanded from 5 stories to 10. This branch implements the parts of that decision that are safe to make as static shell/instruction edits, and documents the parts that still need a live content-generation run.

Everything below was verified with `npm test` (`node --test tests/site.test.mjs && npm --prefix poi test`) before commit.

## What changed, file by file

### `index.html` — shell/CSS/JS only, no story content touched
- Added a visible **"Rolling 3-day edition · today, yesterday, day before"** line under the issue date (`.issue-rolling`), so the 3-day archive limit is a stated design choice instead of a surprise when an old top story disappears.
- Split the action-button styling in two, and fixed a real bug: previously `Book`/`Participate` (a live link) and `Walk`/`Avoid` (plain text, no link) rendered with the **identical** bordered/colored `.action-label` box, so readers couldn't tell which ones were tappable. Now:
  - `.action-label.action-link` (unchanged) — bordered accent CTA, used only when there's a real `actionUrl`.
  - `.action-plain` (new) — muted plain text, no border, used for `Walk`/`Avoid`/anything without a verified link.
  - The one JS line that renders the non-link case now emits `class="action-plain"` instead of `class="action-label"` (`renderStory()`, the `requiresActionUrl` branch).
- Added a left accent rule to `.why` (the "Why it matters" paragraph) — this is the specific "Brief vs. Why breakout" treatment Brian called out as his favorite part of the mockup.
- **Removed** the footer's "Points of Interest" link. The morning strip already links to `poi/` via its "Nearby POI" fact, so the footer link was pointing at the same destination a second time. Footer nav is now Upcoming Events / About & method / Sources (3 links in a 3-column grid — previously 4 links awkwardly sat in a `repeat(3, 1fr)` grid, which is also now fixed as a side effect).
- **No change** to the actual story content (still 5 stories × 3 editions) — see "What's deliberately not done" below.

### `tests/site.test.mjs`
- Updated the footer-link tests to match the new footer (no more "Points of Interest" on the daily page; `poi/index.html` keeps its own separate 3-link footer, which is unaffected and still correct).
- Fixed two tests that asserted a **literal** `href="poi/"` string in the raw HTML. That string only ever existed because the old footer had it as static markup — the morning strip's POI link is built by JavaScript at render time (`modeUrl: "poi/"` in the data, expanded by `renderMorning()`), so it was never literal text in the file. Updated both tests to check for `modeUrl: "poi/"` instead, which actually verifies the link Brian is keeping.
- Changed the story-count assertion from 5 to 10. **This test currently fails on this branch** — see the callout below, that's intentional and documented inline in the test file.

### `DAILY_NEWS_PROMPT.md` (the file Brian said is the key one)
- "Build exactly five stories" → **"Build exactly ten stories, two per section, in this order."** Sections stay the same five (Near Home, Near Work, London AI, London Technology, Plan Ahead), each now filled twice, run as adjacent pairs. Added an explicit rule that the two stories in a pair must be genuinely distinct (not two angles on one event), and that a section should be left at one story with a stated reason rather than padded with a weak second pick.
- Clarified the existing `actionUrl` rule to spell out the new visual consequence: a story with `Walk`/`Avoid` (or any action without a verified link) now renders as plain text, not a button — so there's no situation where inventing a placeholder URL is a workaround.
- Bumped "25 semantic comparisons" (5×5, comparing today's proposed stories against yesterday's) to "100 semantic comparisons" (10×10).
- "Keep exactly five stories in each archived edition" → **ten**.
- Rewrote the **Design lock** section to describe the actual current design precisely: the CTA-vs-plain-text split, the "Why" accent rule, the rolling-edition line, and the corrected 3-link footer (explicitly telling future runs *not* to re-add a Points of Interest footer link). This section is what stops a future daily run from silently reverting this redesign — it's important it stays accurate.
- Added a footer-verification line to the validation checklist (step 5) so a future run visually confirms the button/plain-text split rendered correctly.
- Two internal cross-references ("...even when the place is not selected as one of the five stories") updated to "ten stories."

### `NEWS_CONTEXT.md`
- "Each edition contains exactly: 1. Near Home 2. Near Work..." → same five sections, now explicitly "two per section, run as adjacent pairs," 10 total.
- Completion checklist: "Exactly five stories" → "Exactly ten stories, two per section."

### `README.md`
- "select, analyse, categorise, and write the five stories" → "...the ten stories (two per section)."

### `about.html`
- The reader-facing description ("Each edition turns... into five concise choices") updated to describe ten choices across five themes. This page is hand-maintained, not regenerated by the daily prompt, so it needed a direct edit to stay accurate once 10-story editions start publishing.

## Real photography — no code change needed, but read this

Brian asked for real photos instead of the mockup's placeholder gradients. **The live site already does this** — `index.html`'s existing story data uses real hotlinked photos from each story's own source (Unsplash, the venue's own site, news CDNs, etc.), and `DAILY_NEWS_PROMPT.md` already required "one properly licensed, hotlink-safe editorial image" per story. I added one clarifying phrase — "real photography or official artwork from the story's own source, never a generic stock stand-in for a specific place or event" — to make that intent explicit, since a couple of existing stories currently reuse the same generic Unsplash skyline photo for unrelated stories.

What I did **not** change: the site still hotlinks images live from third-party domains at read time. That's a separate, pre-existing risk flagged in the original design critique (a source image can disappear, get rate-limited, or change without warning, with no fallback). Fixing that would mean adding an image-download/mirroring step to the daily pipeline (a new script, plus repo storage for images) — a real infrastructure change, not a copy or CSS fix, and out of scope for what was asked here. Worth a separate decision with Brian before building it.

## Round 2: prompt-quality review (requested separately, same branch)

After the design work landed, Brian asked for a review of `DAILY_NEWS_PROMPT.md` itself — the actual prompt he pastes into Codex each morning — now that it asks for double the stories. Four issues came out of that review, all fixed here:

1. **A real contradiction between "exactly ten" and the old escape hatch.** The previous wording let a section fall back to one story "rather than padding it," but the archive rule still demanded exactly ten and the test hard-asserts `length === 10`. Resolved by keeping ten as a hard requirement and turning a genuine shortfall into a publishing blocker (stop, preserve work, report why) instead of a silent 9-story exception — consistent with how every other blocker in this prompt is already handled.
2. **The raw candidate pool wasn't sized for two stories per section.** `scripts/collect_candidates.py` ran a single search query for Near Work, London Technology, and Plan Ahead (Near Home and London AI already had two). Added a second query to each of the other three sections, and a third to Near Home specifically since it's the most geographically constrained section and now needs two non-overlapping stories daily. Ran the script end-to-end to confirm all 11 queries execute cleanly (445 candidates written on the test run); the refreshed `data/rss_candidates.json` from that test run was discarded before committing, since a candidate refresh belongs to an actual daily run, not this edit.
3. **No rule for ordering the two stories within a pair.** Added: the more time-critical story (nearer deadline, sooner event, more perishable news) runs first in each section.
4. **Freshness pressure doubled silently.** London AI and London Technology now each need two genuinely fresh (36–72h) stories a day instead of one. Added a line to the Freshness section naming this explicitly and pointing at the existing 72-hour extension as the intended relief valve for the second slot, rather than leaving Codex to either invent the pressure-handling itself or quietly accept a weaker story.

Two smaller items came up in the same review but were **not** acted on, by design — flag to Brian if he wants them done too:
- The "compare every proposed story with every story in yesterday: 100 semantic comparisons" line is restated arithmetic (10×10) with no real instructional content; could be simplified or dropped.
- `about.html`'s "ten concise choices" copy isn't in Codex's "Start here" read list, so if the story count ever changes again it can go stale silently. Low priority since the count is now expected to be stable.

## What's deliberately NOT done in this branch, and why

1. **`index.html`'s actual three editions still have 5 stories each, not 10.** Writing 5 new, dated, verifiably-real London stories per edition (15 new stories total across today/yesterday/day-before) requires the same live web research the daily Codex run does — I'm not able to respons‍ibly fabricate specific venues, prices, dates, and source URLs for a public site. The instruction-layer files (prompt, context, README, about page) are now all correctly set to "ten," so the **next daily Codex run**, using the updated `DAILY_NEWS_PROMPT.md`, will regenerate all three editions at 10 stories each and bring `index.html` in line with its own instructions.

2. **`tests/site.test.mjs`'s story-count test now expects 10 and currently fails**, because of point 1. This is intentional — it's the correct, honest state for this branch: the instructions say ten, the content still says five, and the test says so out loud instead of silently passing on stale content. **Do not treat this as a bug to silently revert.** The fix is to run a daily edition once this branch (or its content) is live, which will make the test pass again. If you want a green `npm test` on this branch specifically before merging, the options are: (a) merge as-is and regenerate content immediately after, accepting a briefly red main, or (b) hold this branch until a content-regeneration run can land in the same PR.

3. **`poi/index.html`'s own footer** still shows a self-referencing "Points of Interest" link (pointing at itself, marked `aria-current="page"`). Brian's ask was specifically about the daily page's footer duplicating the morning strip's link — that logic doesn't apply to the POI page itself, so I left it untouched. Flagging in case you want a second opinion on whether a self-link there is useful or should also go.

4. **`assets/design-concept-desktop.png` / `assets/design-concept-mobile.png`** are referenced in `NEWS_CONTEXT.md` as "the reference concepts" for the design and predate this change — they still show the old (pre-fix) action-button and footer treatment. Not updated here since it requires re-rendering and re-exporting real screenshots; worth doing once the live site reflects this branch, so future daily runs have an accurate visual reference instead of a stale one.

## Suggested order of operations for the actual PR

1. Review/merge this branch's shell + instruction changes on their own — they're self-contained, tested (aside from the one documented, expected story-count failure), and don't depend on new content.
2. Immediately run a daily edition (`DAILY_NEWS_PROMPT.md`) against the merged result, which will regenerate all three editions to 10 stories each and turn the story-count test green.
3. Re-export `assets/design-concept-*.png` from the live result so `NEWS_CONTEXT.md`'s reference images match reality again.
4. Separately, decide whether to invest in self-hosting/mirroring story images — not required for this change, but the underlying hotlinking risk is still live.
