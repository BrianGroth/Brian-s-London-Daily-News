import assert from "node:assert/strict";
import test from "node:test";
import { selectRecords, lookup } from "../scripts/lookup_context.mjs";
import { readFile } from 'node:fs/promises';

test("lookup prefers exact identifiers without losing complete record fields", () => {
  const records = [{ id: "heath", description: "complete evidence" }, { id: "other", description: "near heath" }];
  assert.deepEqual(selectRecords(records, "HEATH"), [records[0]]);
  assert.deepEqual(selectRecords(records, "near heath"), [records[1]]);
  assert.throws(() => selectRecords(records, " "), /Supply an ID/);
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
