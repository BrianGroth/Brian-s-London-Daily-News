import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { renderDataBlock, renderIndex } from "../scripts/render_edition.mjs";

test("renderer safely embeds source text containing closing script markup", () => {
  const text = '</script><script>alert("source text")</script>';
  const issue = { stories: [{ id: "test", headline: text, imageKey: "example" }] };
  const data = { schemaVersion: 1, images: { example: { src: "https://example.com/image.jpg", alt: text, credit: text } }, issues: { today: issue, yesterday: issue, "day-before": issue } };
  const block = renderDataBlock(data);
  assert.equal(block.includes("</script>"), false);
  const context = {};
  vm.runInNewContext(`${block}\nthis.result = issues.today.stories[0];`, context);
  assert.equal(context.result.headline, text);
  assert.equal(context.result.image.alt, text);
});

test("renderer preserves Windows line endings without reporting a false data mismatch", () => {
  const issue = { label: "London • Wednesday 28 October 2026", stories: [{ imageKey: "venue" }] };
  const data = { schemaVersion: 1, images: { venue: { src: "https://example.org/photo.jpg" } }, issues: { today: issue, yesterday: issue, "day-before": issue } };
  const page = '<script>\r\n    /* GENERATED DAILY DATA: run npm run render:edition */\r\n    /* END GENERATED DAILY DATA */\r\n</script>';
  const result = renderIndex(page, data);
  assert.equal(result.replaceAll("\r\n", "").includes("\n"), false);
  assert.equal(renderIndex(result, data), result);
});
