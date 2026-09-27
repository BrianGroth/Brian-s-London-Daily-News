import test from "node:test";
import assert from "node:assert/strict";
import { prepareBrief, resourceContext, scoreForSection, likelySameTopic, londonDate, officialResearchSources } from "../scripts/prepare_daily_brief.mjs";

const now = "2026-09-27T08:00:00Z";
const lead = (title, link, extra = {}) => ({ title, link, publisher: "Publisher", published_at: now, category_hint: "Near Home", ...extra });
const input = (items = []) => ({
  rss: { generated_at: "2026-09-25T08:00:00Z", items },
  editions: { issues: { today: { stories: [] }, yesterday: { stories: [] } } },
  events: { events: [] }, pois: { items: [] }, resourcesHtml: "",
});

test("runtime clock ages stale leads and uses London calendar boundaries", () => {
  const data = input([lead("Hampstead news", "https://example.com/1", { published_at: "2026-09-25T08:00:00Z" })]);
  const brief = prepareBrief(data, now);
  assert.equal(brief.candidateSections["Near Home"][0].ageHours, 48);
  assert.equal(brief.generatedAt, "2026-09-27T08:00:00.000Z");
  assert.equal(brief.sourceCollectedAt, data.rss.generated_at);
  assert.ok(brief.warnings.some((warning) => warning.includes("older than 24 hours")));
  assert.equal(londonDate("2026-06-30T23:30:00Z"), "2026-07-01");
  assert.equal(londonDate("2026-12-31T23:30:00Z"), "2026-12-31");
});

test("activity and approved primary signals improve discovery without claiming verification", () => {
  const ordinary = lead("Hampstead Heath celebrity morning routine", "https://example.com/news");
  const activity = lead("Hampstead Heath guided walk tickets", "https://heath-hands.org.uk/events");
  const timestamp = Date.parse(now);
  assert.ok(scoreForSection(activity, "Near Home", timestamp).score > scoreForSection(ordinary, "Near Home", timestamp).score);
  assert.equal(scoreForSection(activity, "Near Home", timestamp).primarySourceSignal, false);
  assert.equal(scoreForSection(activity, "Near Home", timestamp, ["heath-hands.org.uk"]).primarySourceSignal, true);
});

test("topic grouping keeps alternate reporting and does not merge differing dates", () => {
  const a = lead("Hampstead Heath guided autumn wildlife walk opens booking", "https://a.example");
  const b = lead("Hampstead Heath guided autumn wildlife walk opens booking - Other", "https://b.example", { publisher: "Other" });
  assert.equal(likelySameTopic(a, b), true);
  assert.equal(likelySameTopic({ ...a, title: a.title + " 27 September" }, { ...b, title: a.title + " 28 September" }), false);
  const brief = prepareBrief(input([a, b]), now);
  assert.equal(brief.candidateSections["Near Home"].length, 1);
  assert.equal(brief.candidateSections["Near Home"][0].alternateLeads.length, 1);
  assert.ok(brief.warnings.some((warning) => warning.includes("distinct leads")));
});

test("blocked source context survives attribute order and excludes known blocked leads", () => {
  const html = `<article data-status='do-not-use' class='resource-card' data-domain='www.blocked.example'></article>
    <article data-domain="www.active.example" data-status="active"></article>`;
  assert.deepEqual(resourceContext(html), { activeResourceDomains: ["active.example"], blockedResourceDomains: ["blocked.example"] });
  const data = input([lead("Hampstead walk", "https://blocked.example/event"), lead("Hampstead class", "https://news.google.com/redirect", { publisher_url: "https://news.blocked.example" }), lead("Hampstead tour", "https://events.blocked.example/tour")]);
  data.resourcesHtml = html;
  assert.equal(prepareBrief(data, now).candidateSections["Near Home"].length, 0);
});

test("calendar opportunities use action clock and retain ongoing events for reverification", () => {
  const data = input();
  data.events.events = [
    { id: "past", title: "Past", startDate: "2026-09-25" },
    { id: "ongoing", title: "Exhibition", startDate: "2026-09-01", endDate: "2026-10-01", section: "Near Home", sourceUrl: "https://example.com" },
    { id: "future", title: "Walk", startDate: "2026-10-02" },
  ];
  const brief = prepareBrief(data, now);
  assert.deepEqual(brief.upcomingEvents.map(({ id }) => id), ["ongoing", "future"]);
  assert.ok(brief.upcomingEvents.every((event) => event.needsLiveReverification));
  assert.equal(data.events.events.length, 3);
});

test("fixed inputs and explicit clock give repeatable output with collection warnings", () => {
  const data = input([lead("Hampstead walk", "https://example.com")]);
  data.rss.collection_status = "failed";
  data.rss.last_success_at = "2026-09-24T08:00:00Z";
  assert.deepEqual(prepareBrief(data, now), prepareBrief(data, now));
  assert.ok(prepareBrief(data, now).warnings.some((warning) => warning.includes("collection failed")));
});

test("official research links come only from approved existing cards", () => {
  const html = `<article data-domain="heath-hands.org.uk" data-status="active"><a href="https://www.heath-hands.org.uk/whatson">Heath Hands</a></article>
    <article data-domain="cityoflondon.gov.uk" data-status="do-not-use"><a href="https://www.cityoflondon.gov.uk/events">City events</a></article>`;
  const sources = officialResearchSources(html, resourceContext(html).activeResourceDomains);
  assert.deepEqual(sources, [{ name: "Heath Hands", url: "https://www.heath-hands.org.uk/whatson", domain: "heath-hands.org.uk", needsLiveVerification: true }]);
});

test("archive dates include all issues without exposing complete story bodies", () => {
  const data = input();
  data.editions.issues.today = { label: "London • Sunday 27 September 2026", stories: [{ id: "2026-09-27-walk", section: "Near Home", headline: "Walk", brief: "Full text" }] };
  const brief = prepareBrief(data, now);
  assert.equal(brief.archiveDates.today.date, "2026-09-27");
  assert.equal(brief.archiveDates.today.storyCount, 1);
  assert.equal(brief.adjacentEditionStories.today[0].brief, undefined);
});
