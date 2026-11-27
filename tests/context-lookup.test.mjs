import assert from "node:assert/strict";
import test from "node:test";
import { selectRecords, lookup, imageMatches, compactRecord } from "../scripts/lookup_context.mjs";
import { readFile } from 'node:fs/promises';

test("lookup prefers exact identifiers without losing complete record fields", () => {
  const records = [{ id: "heath", description: "complete evidence" }, { id: "other", description: "near heath" }];
  assert.deepEqual(selectRecords(records, "HEATH"), [records[0]]);
  assert.deepEqual(selectRecords(records, "near heath"), [records[1]]);
  assert.throws(() => selectRecords(records, " "), /Supply an ID/);
});

test('reviewed image subject search cannot be shadowed by an unreviewed legacy key', () => {
  const records = [{ key: 'heath', alt: 'Summer concert crowd' }, { key: 'accurate', alt: 'Hampstead Heath', provenance: { subject: 'Hampstead Heath', author: 'Photographer', license: 'CC BY', rightsVerifiedAt: '2026-10-01' } }];
  assert.deepEqual(imageMatches(records, 'heath'), [records[1]]);
  assert.equal(imageMatches(records, '', 'heath')[0].rightsStatus, 'unreviewed legacy image');
  assert.equal(imageMatches(records, 'unknown').length, 0);
});

test('batch record lookup retains complete fields and rejects empty IDs', async () => {
  const data = JSON.parse(await readFile(new URL('../data/editions.json', import.meta.url)));
  const ids = data.issues.today.stories.slice(0, 2).map(s => s.id);
  const results = await lookup('stories', '', { ids });
  assert.deepEqual(results.map(s => s.id), ids);
  assert.ok(results.every(s => s.brief));
  await assert.rejects(lookup('stories', '', { ids: [''] }), /comma-separated/);
  assert.equal(compactRecord({ id: 'a', summary: 'fact', html: '<body>noise</body>', reviewFlags: ['verify'] }).html, undefined);
});

test('candidate package bundles existing context without fetching or discarding candidates in a batch', async () => {
  const brief = JSON.parse(await readFile(new URL('../data/daily-brief.json', import.meta.url)));
  const ids = [...new Set(Object.values(brief.candidateSections).flat().map(c => c.id))].slice(0, 2);
  const results = await lookup('package', '', { ids });
  assert.deepEqual(results.map(record => record.candidate.id), ids);
  for (const record of results) {
    assert.ok(Array.isArray(record.priorCoverage));
    assert.ok(Array.isArray(record.calendarMatches));
    assert.ok(record.imageOptions.every(image => image.provenance.rightsVerifiedAt));
    assert.match(record.note, /does not refresh or verify/);
  }
});

test("edition lookup lists all archive slots without dumping article bodies", async () => {
  const result = await lookup("editions");
  assert.deepEqual(result.map(({ key }) => key), ["today", "yesterday", "day-before"]);
  const source = JSON.parse(await readFile(new URL('../data/editions.json', import.meta.url)));
  for (const item of result) {
    assert.ok(item.label);
    assert.deepEqual(item.storyIds, source.issues[item.key].stories.map(story => story.id));
  }
  assert.equal(result[0].stories, undefined);
});
