import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const resources = await readFile(new URL("../resources.html", import.meta.url), "utf8");
const potentialResources = await readFile(new URL("../PotentialUnusedResources.html", import.meta.url), "utf8");
const about = await readFile(new URL("../about.html", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const dailyPrompt = await readFile(new URL("../DAILY_NEWS_PROMPT.md", import.meta.url), "utf8");
const contextGuide = await readFile(new URL("../NEWS_CONTEXT.md", import.meta.url), "utf8");
const collector = await readFile(new URL("../scripts/collect_candidates.py", import.meta.url), "utf8");
const poiReadme = await readFile(new URL("../poi/README.md", import.meta.url), "utf8");
const upcomingEventsPage = await readFile(new URL("../upcoming-events.html", import.meta.url), "utf8");
const upcomingEventsScript = await readFile(new URL("../upcoming-events.js", import.meta.url), "utf8");
const upcomingEventsData = JSON.parse(await readFile(new URL("../data/upcoming-events.json", import.meta.url), "utf8"));

function extractIssues() {
  const start = index.indexOf("    const images =");
  const end = index.indexOf("    const escapeHtml");
  assert.ok(start >= 0 && end > start, "edition data block is present");
  const source = `${index.slice(start, end)}\nthis.result = issues;`;
  const context = {};
  vm.runInNewContext(source, context);
  return context.result;
}

test("brand and required palette are present", () => {
  assert.match(index, /BRIAN'S LONDON DAILY NEWS/);
  assert.match(index, /--navy:\s*#08264a/i);
  assert.match(index, /--paper:\s*#f3f5f7/i);
  assert.match(index, /--ink:\s*#101820/i);
  assert.match(about, /BRIAN'S LONDON DAILY NEWS/);
});

test("today has ten paired stories and archived issues remain valid and non-repeating", () => {
  const issues = extractIssues();
  const order = ["today", "yesterday", "day-before"];
  const expectedCounts = { today: 10, yesterday: 5, "day-before": 5 };
  for (const key of order) {
    assert.equal(issues[key].stories.length, expectedCounts[key], `${key} preserves its expected story count`);
    for (const story of issues[key].stories) {
      assert.match(story.id, /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
      assert.ok(story.headline && story.brief && story.why);
      assert.ok(Array.isArray(story.sources) && story.sources.length > 0);
      if (["Book", "Participate"].includes(story.action)) {
        assert.match(story.actionUrl, /^https:\/\//);
      }
    }
  }

  for (let i = 0; i < order.length - 1; i += 1) {
    const current = new Set(issues[order[i]].stories.map(({ id }) => id));
    const repeats = issues[order[i + 1]].stories.filter(({ id }) => current.has(id));
    assert.equal(repeats.length, 0);
  }

  assert.deepEqual(
    Array.from(issues.today.stories, ({ section }) => section.toLowerCase()),
    [
      "near home", "near home",
      "near work", "near work",
      "london ai", "london ai",
      "london technology", "london technology",
      "plan ahead", "plan ahead",
    ],
    "today has exactly two adjacent stories per section",
  );
});

test("source directory is unique and covers current edition hostnames", () => {
  const domains = [...resources.matchAll(/data-domain="([^"]+)"/g)]
    .map((match) => match[1].replace(/^www\./, "").toLowerCase());
  assert.equal(new Set(domains).size, domains.length, "resource hostnames are unique");

  const issues = extractIssues();
  for (const story of issues.today.stories) {
    for (const [, url] of story.sources) {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      assert.ok(domains.includes(hostname), `resources includes ${hostname}`);
    }
  }
});

test("the active shortlist and separate potential-resource backlog are explicit", () => {
  for (const hostname of [
    "londonist.com", "secretldn.com", "visitlondon.com", "open-city.org.uk",
    "artrabbit.com", "camdennewjournal.co.uk", "easterncity.co.uk",
    "openplaques.org", "data.london.gov.uk", "museumdata.uk",
  ]) {
    assert.match(resources, new RegExp(`data-domain="${hostname.replaceAll(".", "\\.")}"`));
  }
  assert.match(resources, /id="poi-sources"/);
  assert.match(potentialResources, /Not production inputs/);
  assert.match(potentialResources, /r\/london/);
});

test("daily workflow persists newly discovered POIs", () => {
  assert.match(dailyPrompt, /Persist every new point of interest/);
  assert.match(dailyPrompt, /poi\/data\/editorial-pois\.json/);
  assert.match(dailyPrompt, /matching names within 45 metres/);
});

test("upcoming events use valid dates, unique IDs, and authoritative links", () => {
  assert.ok(Array.isArray(upcomingEventsData.events));
  assert.equal(new Set(upcomingEventsData.events.map(({ id }) => id)).size, upcomingEventsData.events.length);
  for (const event of upcomingEventsData.events) {
    assert.match(event.id, /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
    assert.match(event.startDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(event.sourceUrl, /^https:\/\//);
    assert.ok(event.title && event.section && event.location && event.summary && event.addedOn);
    if (event.endDate) assert.ok(event.endDate >= event.startDate);
    if (["Book", "Participate"].includes(event.action)) assert.match(event.actionUrl, /^https:\/\//);
  }
});

test("calendar page and daily prompt share the editorial event store", () => {
  assert.match(upcomingEventsScript, /data\/upcoming-events\.json/);
  assert.match(upcomingEventsPage, /id="calendarUpdated"/);
  assert.match(upcomingEventsScript, /payload\.updatedAt/);
  assert.match(upcomingEventsPage, /Month/);
  assert.match(upcomingEventsPage, /Agenda/);
  assert.match(dailyPrompt, /Persist every upcoming event/);
  assert.match(dailyPrompt, /data\/upcoming-events\.json/);
  assert.match(dailyPrompt, /Update the calendar page every run/i);
  assert.match(dailyPrompt, /calendar as an editorial planning source/);
});

test("daily page uses the locked three-link footer and keeps POI in primary navigation", async () => {
  const poiIndex = await readFile(new URL("../poi/index.html", import.meta.url), "utf8");
  const footer = index.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)?.[1] ?? "";
  for (const label of ["Upcoming Events", "About &amp; method", "Sources"]) {
    assert.match(footer, new RegExp(label));
  }
  assert.doesNotMatch(footer, /Points of Interest/);
  for (const label of ["Points of Interest", "About &amp; method", "Sources"]) {
    assert.match(poiIndex, new RegExp(label));
  }
});

test("Walk and Avoid render as plain muted text", () => {
  assert.match(index, /\.action-plain\s*\{/);
  assert.match(index, /<span class="action-plain">/);
});

test("primary navigation reaches the merged companion pages", () => {
  assert.match(index, /modeUrl:\s*"poi\/"/);
  assert.match(index, /href="upcoming-events\.html"/);
  assert.match(index, /href="about\.html"/);
  assert.match(index, /href="resources\.html"/);
});

test("the project is self-contained and contains no archived-project references", () => {
  const maintainedText = [readme, dailyPrompt, contextGuide, collector, poiReadme].join("\n");
  const retiredNames = [
    ["Brian", "_Daily_", "News"].join(""),
    ["NW3", "-", "News"].join(""),
    ["Brian", " Daily ", "News"].join(""),
  ];
  for (const retiredName of retiredNames) {
    assert.equal(maintainedText.includes(retiredName), false);
  }
});

test("the one-prompt workflow owns collection, validation, and two-clock freshness", () => {
  assert.match(readme, /one required action/i);
  assert.match(readme, /does \*\*not\*\* need to run Python or npm separately/i);
  assert.match(dailyPrompt, /python scripts\/collect_candidates\.py/);
  assert.match(dailyPrompt, /previous \*\*36 hours\*\*/);
  assert.match(dailyPrompt, /important date is the event, availability, deadline, or action date/i);
  assert.match(contextGuide, /Freshness uses two clocks/);
  assert.match(collector, /key=item_timestamp/);
});
