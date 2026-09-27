import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { renderDataBlock } from "../scripts/render_edition.mjs";

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
