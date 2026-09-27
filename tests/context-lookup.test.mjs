import assert from "node:assert/strict";
import test from "node:test";
import { selectRecords, lookup } from "../scripts/lookup_context.mjs";

test("lookup prefers exact identifiers without losing complete record fields", () => {
  const records = [{ id: "heath", description: "complete evidence" }, { id: "other", description: "near heath" }];
  assert.deepEqual(selectRecords(records, "HEATH"), [records[0]]);
  assert.deepEqual(selectRecords(records, "near heath"), [records[1]]);
  assert.throws(() => selectRecords(records, " "), /Supply an ID/);
});

test("edition lookup lists all archive slots without dumping article bodies", async () => {
  const result = await lookup("editions");
  assert.deepEqual(result.map(({ key }) => key), ["today", "yesterday", "day-before"]);
  assert.ok(result.every(({ label, storyIds }) => label && storyIds.length === 10));
  assert.equal(result[0].stories, undefined);
});
