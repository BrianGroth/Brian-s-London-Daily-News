import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const resources = await readFile(new URL("../resources.html", import.meta.url), "utf8");
const about = await readFile(new URL("../about.html", import.meta.url), "utf8");

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

test("each archived issue has exactly five valid, non-repeating stories", () => {
  const issues = extractIssues();
  const order = ["today", "yesterday", "day-before"];
  for (const key of order) {
    assert.equal(issues[key].stories.length, 5, `${key} has five stories`);
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

test("primary navigation reaches the merged companion pages", () => {
  assert.match(index, /href="poi\/"/);
  assert.match(index, /href="about\.html"/);
  assert.match(index, /href="resources\.html"/);
});
