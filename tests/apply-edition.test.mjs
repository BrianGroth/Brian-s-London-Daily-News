import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { applyEdition, buildEditionUpdate } from "../scripts/apply_edition.mjs";

const mix = ["Near home", "Near home", "Near home", "Near home", "Near work", "Near work", "London AI", "London technology", "Plan ahead", "Plan ahead"];
function edition(day) {
  return {
    label: `London • Monday ${Number(day.slice(-2))} September 2026`,
    footer: "unused",
    morning: {
      mode: "Nearby POI", modeUrl: "poi/", temperature: "20° / 12°", rain: "Dry morning", pollen: "Low pollen",
      weatherUrl: "https://weather.metoffice.gov.uk/forecast/test",
      transit: [["Northern", "Good service", "good", "https://tfl.gov.uk/tube-dlr-overground/status/"], ["Overground", "Good service", "good", "https://tfl.gov.uk/tube-dlr-overground/status/"]],
    },
    stories: mix.map((section, number) => ({
      id: `${day}-story-${number}`, section, headline: `${day} distinct story ${number}`, location: "Across London",
      brief: "Verified description", why: "A useful reader decision", imageKey: "venue",
      sources: [["Official listing", `https://example.org/${day}/${number}`]],
    })),
  };
}

function fixture() {
  const current = {
    editions: { schemaVersion: 1, updatedAt: "2026-09-26", images: { venue: { src: "https://example.org/image.jpg", alt: "The venue", credit: "Venue press office" } }, issues: { today: edition("2026-09-26"), yesterday: edition("2026-09-25"), "day-before": edition("2026-09-24") } },
    index: '<p class="issue-line" id="issue-line">old</p>\n<button class="date-tab" id="tab-today">Today</button>\n<script>\n    /* GENERATED DAILY DATA: run npm run render:edition */\n    /* END GENERATED DAILY DATA */\n</script>',
    events: { version: 1, updatedAt: "2026-09-26", events: [] },
    pois: { schemaVersion: 1, updatedAt: "2026-09-26", items: [] },
    resources: '<section class="resource-section" aria-labelledby="local-sources">\n<div class="resource-grid">\n<article class="resource-card" data-domain="example.org" data-status="active"><p>Preserve me verbatim</p></article>\n</div>\n</section>',
  };
  const { label, footer, ...proposed } = edition("2026-09-27");
  return { current, input: { date: "2026-09-27", edition: proposed } };
}

function event(overrides = {}) {
  return { id: "2026-09-28-venue-talk", title: "Venue talk", startDate: "2026-09-28", section: "Near home", location: "Hampstead", sourceName: "Venue", sourceUrl: "https://example.org/talk", summary: "A verified talk", addedOn: "2026-09-27", ...overrides };
}

function poi(overrides = {}) {
  return { id: "venue", name: "Venue", category: "culture", lat: 51.55, lon: -0.16, description: "A permanent venue", url: "https://example.org/venue", sourceUrl: "https://example.org/venue-guide", addedOn: "2026-09-27", ...overrides };
}

test("rotates once, derives London labels, and preserves archives and unused images", () => {
  const { current, input } = fixture();
  const original = structuredClone(current);
  const result = buildEditionUpdate(input, current);
  assert.equal(result.editions.issues.today.label, "London • Sunday 27 September 2026");
  assert.deepEqual(result.editions.issues.yesterday, current.editions.issues.today);
  assert.deepEqual(result.editions.issues["day-before"], current.editions.issues.yesterday);
  assert.deepEqual(result.editions.images, current.editions.images);
  assert.deepEqual(current, original);
  const repeated = buildEditionUpdate(input, { ...current, ...result });
  assert.deepEqual(repeated.editions, result.editions);
  assert.equal(repeated.summary.archive, "same-day replacement");
});

test("rejects backward dates, impossible dates, invalid story count and wrong section order", () => {
  for (const modify of [
    (input) => { input.date = "2026-09-23"; input.edition.stories = edition(input.date).stories; },
    (input) => { input.date = "2026-02-30"; },
    (input) => { input.edition.stories.pop(); },
    (input) => { input.edition.stories[0].section = "London AI"; },
  ]) {
    const { current, input } = fixture(); modify(input);
    assert.throws(() => buildEditionUpdate(input, current));
  }
});

test("rejects missing direct action URLs, unknown images, duplicate IDs and changed archive images", () => {
  for (const modify of [
    (input) => { input.edition.stories[0].action = "Book"; },
    (input) => { input.edition.stories[0].imageKey = "missing"; },
    (input) => { input.edition.stories[1].id = input.edition.stories[0].id; },
    (input) => { input.images = { venue: { src: "https://example.org/new.jpg", alt: "new", credit: "new" } }; },
    (input) => { input.edition.stories[0].sources[0][1] = "https://news.google.com/articles/123"; },
    (input) => { input.edition.stories[0].actionUrl = "javascript:alert(1)"; },
    (input) => { input.edition.morning.rain = "Check live"; },
  ]) {
    const { current, input } = fixture(); modify(input);
    assert.throws(() => buildEditionUpdate(input, current));
  }
});

test("rejects yesterday's normalized headline even under another ID", () => {
  const { current, input } = fixture();
  input.edition.stories[0].headline = current.editions.issues.today.stories[0].headline.toUpperCase() + "!";
  assert.throws(() => buildEditionUpdate(input, current), /repeats yesterday/);
});

test("appends stores without rewriting existing records and reports idempotent additions", () => {
  const { current, input } = fixture();
  current.events.events.push(event({ id: "2026-09-01-old", title: "Past event", startDate: "2026-09-01", sourceUrl: "https://example.org/old", addedOn: "2026-09-01" }));
  input.events = [event()]; input.pois = [poi()];
  const result = buildEditionUpdate(input, current);
  assert.deepEqual(result.events.events[0], current.events.events[0]);
  assert.equal(result.events.updatedAt, input.date);
  assert.equal(result.pois.updatedAt, input.date);
  const repeated = buildEditionUpdate(input, { ...current, ...result });
  assert.deepEqual(repeated.events, result.events);
  assert.deepEqual(repeated.pois, result.pois);
  assert.deepEqual(repeated.summary.events.unchanged, [event().id]);
  assert.deepEqual(repeated.summary.pois.unchanged, [poi().id]);
});

test("conflicting existing event IDs and overlapping names or canonical URLs require review", () => {
  for (const incoming of [
    event({ summary: "Changed" }),
    event({ id: "2026-09-28-other", title: "Venue Talk!", sourceUrl: "https://example.org/other" }),
    event({ id: "2026-09-28-other", title: "Another angle", sourceUrl: "https://www.example.org/talk?utm_source=feed" }),
  ]) {
    const { current, input } = fixture(); current.events.events = [event()]; input.events = [incoming];
    assert.throws(() => buildEditionUpdate(input, current), /review manually/);
  }
  const { current, input } = fixture(); current.events.events = [event()];
  input.events = [event({ id: "2026-09-29-venue-talk", startDate: "2026-09-29" })];
  assert.equal(buildEditionUpdate(input, current).events.events.length, 2);
});

test("POI name plus 45m proximity and matching URL conflicts require review", () => {
  for (const incoming of [
    poi({ id: "second-venue", name: "Venue!", lat: 51.5501, url: "https://example.org/different", sourceUrl: "https://example.org/different-source" }),
    poi({ id: "second-venue", name: "Another venue", lat: 52, url: "https://www.example.org/venue?utm_campaign=day" }),
  ]) {
    const { current, input } = fixture(); current.pois.items = [poi()]; input.pois = [incoming];
    assert.throws(() => buildEditionUpdate(input, current), /review manually/);
  }
});

test("validates event dates/time and POI coordinates/category before applying", () => {
  for (const invalid of [event({ endDate: "2026-09-20" }), event({ time: "25:00" }), event({ addedOn: "2026-09-26" }), event({ unsupported: true })]) {
    const { current, input } = fixture(); input.events = [invalid];
    assert.throws(() => buildEditionUpdate(input, current));
  }
  for (const invalid of [poi({ lat: "51.55" }), poi({ lat: 91 }), poi({ category: "invented" })]) {
    const { current, input } = fixture(); input.pois = [invalid];
    assert.throws(() => buildEditionUpdate(input, current));
  }
});

test("appends escaped resource cards, deduplicates normalized hosts and preserves existing HTML", () => {
  const { current, input } = fixture();
  input.edition.stories[0].sources = [["New source", "https://new.example.org/story"]];
  input.resources = [{ name: "Venue <news>", url: "https://www.new.example.org/?a=1&b=2", description: "Art & talks", section: "local-sources" }];
  const result = buildEditionUpdate(input, current);
  assert.match(result.resources, /Venue &lt;news&gt;/);
  assert.match(result.resources, /Art &amp; talks/);
  assert.match(result.resources, /<p>Preserve me verbatim<\/p>/);
  assert.equal((result.resources.match(/data-domain="new.example.org"/g) ?? []).length, 1);
  assert.deepEqual(buildEditionUpdate(input, { ...current, ...result }).resources, result.resources);
});

test("missing source cards and blocked domains cannot enter sources or be reactivated", () => {
  const { current, input } = fixture();
  input.edition.stories[0].sources = [["Unknown", "https://unknown.example/story"]];
  assert.throws(() => buildEditionUpdate(input, current), /Missing resource card/);
  current.resources += '<article data-domain="unknown.example" data-status="do-not-use"></article>';
  assert.throws(() => buildEditionUpdate(input, current), /blocked source/);
  input.edition.stories[0].sources = [["Allowed", "https://example.org/story"]];
  input.resources = [{ name: "Blocked", url: "https://unknown.example/", description: "Blocked", section: "local-sources" }];
  assert.throws(() => buildEditionUpdate(input, current), /blocked source/);
});

test("rendering preserves embedded text without introducing a script close tag", () => {
  const { current, input } = fixture();
  input.edition.stories[0].brief = 'A </script><script>alert("unsafe")</script> literal';
  const { index } = buildEditionUpdate(input, current);
  assert.equal((index.match(/<\/script>/g) ?? []).length, 1);
  const script = index.match(/<script>([\s\S]*)<\/script>/)[1];
  const context = {};
  vm.runInNewContext(script + "\nthis.result = issues.today.stories[0].brief", context);
  assert.equal(context.result, input.edition.stories[0].brief);
});

async function temporaryRepository(t) {
  const repository = await mkdtemp(path.join(os.tmpdir(), "edition-helper-test-"));
  t.after(() => rm(repository, { recursive: true, force: true }));
  await mkdir(path.join(repository, "data"));
  await mkdir(path.join(repository, "poi", "data"), { recursive: true });
  const { current, input } = fixture();
  const originals = {
    "data/editions.json": JSON.stringify(current.editions), "index.html": current.index,
    "data/upcoming-events.json": JSON.stringify(current.events), "poi/data/editorial-pois.json": JSON.stringify(current.pois), "resources.html": current.resources,
  };
  for (const [filename, value] of Object.entries(originals)) await writeFile(path.join(repository, filename), value);
  return { repository, input, originals };
}

test("dry run writes nothing; explicit write updates files; rerun writes nothing", async (t) => {
  const { repository, input, originals } = await temporaryRepository(t);
  input.events = [event()]; input.pois = [poi()];
  const dry = await applyEdition(repository, input);
  assert.equal(dry.write, false); assert.equal(dry.changedFiles.length, 4);
  for (const [filename, value] of Object.entries(originals)) assert.equal(await readFile(path.join(repository, filename), "utf8"), value);
  await applyEdition(repository, input, { write: true });
  assert.deepEqual((await applyEdition(repository, input, { write: true })).changedFiles, []);
  assert.equal((await readdir(repository)).some((name) => name.startsWith(".edition-update-")), false);
});

test("a late validation failure leaves every target unchanged even with --write", async (t) => {
  const { repository, input, originals } = await temporaryRepository(t);
  input.pois = [poi({ category: "invalid" })];
  await assert.rejects(applyEdition(repository, input, { write: true }), /category/);
  for (const [filename, value] of Object.entries(originals)) assert.equal(await readFile(path.join(repository, filename), "utf8"), value);
});

test("a failure installing a later file rolls earlier replacements back", async (t) => {
  const { repository, input, originals } = await temporaryRepository(t);
  const originalRename = fs.rename;
  let renames = 0;
  fs.rename = async (...args) => {
    renames += 1;
    if (renames === 4) throw new Error("Simulated installation failure");
    return originalRename(...args);
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(applyEdition(repository, input, { write: true }), /Simulated installation failure/);
  } finally {
    fs.rename = originalRename;
    syncBuiltinESMExports();
  }
  for (const [filename, value] of Object.entries(originals)) assert.equal(await readFile(path.join(repository, filename), "utf8"), value);
  assert.equal((await readdir(repository)).some((name) => name.startsWith(".edition-update-")), false);
});
