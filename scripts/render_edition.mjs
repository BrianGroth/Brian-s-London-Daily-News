import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const editionsPath = path.join(repositoryRoot, "data", "editions.json");
const indexPath = path.join(repositoryRoot, "index.html");
const startMarker = "    /* GENERATED DAILY DATA: run npm run render:edition */";
const endMarker = "    /* END GENERATED DAILY DATA */";

function assertEditionData(data) {
  if (data?.schemaVersion !== 1 || !data.images || !data.issues) {
    throw new Error("data/editions.json must contain schemaVersion 1, images and issues.");
  }

  for (const issueKey of ["today", "yesterday", "day-before"]) {
    const issue = data.issues[issueKey];
    if (!issue || !Array.isArray(issue.stories)) {
      throw new Error(`Missing ${issueKey} issue or stories array.`);
    }
    for (const story of issue.stories) {
      if (!story.imageKey || !data.images[story.imageKey]) {
        throw new Error(`Story ${story.id || "(missing id)"} has an unknown imageKey.`);
      }
    }
  }
}

function indent(value, spaces) {
  const prefix = " ".repeat(spaces);
  return value.split("\n").map((line) => `${prefix}${line}`).join("\n");
}

export function renderDataBlock(data) {
  assertEditionData(data);
  const imagesSource = JSON.stringify(data.images, null, 2);
  const issuesSource = JSON.stringify(data.issues, null, 2)
    .replace(/^(\s*)"imageKey": "([A-Za-z0-9_-]+)"/gm, '$1image: images["$2"]');

  return [
    startMarker,
    "    const images = " + indent(imagesSource, 4).trimStart() + ";",
    "",
    "    const issues = " + indent(issuesSource, 4).trimStart() + ";",
    `    ${endMarker.trim()}`,
  ].join("\n");
}

function replaceGeneratedData(index, renderedBlock) {
  if (index.includes(startMarker) && index.includes(endMarker)) {
    const start = index.indexOf(startMarker);
    const end = index.indexOf(endMarker, start) + endMarker.length;
    return index.slice(0, start) + renderedBlock + index.slice(end);
  }

  const legacyStart = index.indexOf("    const images =");
  const legacyEnd = index.indexOf("    const escapeHtml", legacyStart);
  if (legacyStart < 0 || legacyEnd < 0) {
    throw new Error("Could not locate the edition data block in index.html.");
  }
  return index.slice(0, legacyStart) + renderedBlock + "\n\n" + index.slice(legacyEnd);
}

function updateVisibleDate(index, today) {
  const dateLabel = today.label.replace(/^London\s*•\s*/, "");
  const shortDate = dateLabel.match(/^[A-Za-z]+\s+(\d{1,2}\s+[A-Za-z]+)\s+\d{4}$/)?.[1];
  if (!shortDate) throw new Error(`Could not derive the Today tab date from ${today.label}.`);

  return index
    .replace(
      /<p class="issue-line" id="issue-line">[\s\S]*?<\/p>/,
      `<p class="issue-line" id="issue-line">London <span class="dot">•</span> ${dateLabel}</p>`,
    )
    .replace(
      /(<button class="date-tab" id="tab-today"[^>]*>)[^<]*(<\/button>)/,
      `$1Today ${shortDate}$2`,
    );
}

export function renderIndex(index, data) {
  const withData = replaceGeneratedData(index, renderDataBlock(data));
  return updateVisibleDate(withData, data.issues.today);
}

const data = JSON.parse(await readFile(editionsPath, "utf8"));
const currentIndex = await readFile(indexPath, "utf8");
const renderedIndex = renderIndex(currentIndex, data);
const checkOnly = process.argv.includes("--check");

if (checkOnly) {
  if (renderedIndex !== currentIndex) {
    console.error("index.html is out of sync with data/editions.json. Run npm run render:edition.");
    process.exitCode = 1;
  } else {
    console.log("index.html is in sync with data/editions.json.");
  }
} else if (renderedIndex !== currentIndex) {
  await writeFile(indexPath, renderedIndex, "utf8");
  console.log("Rendered data/editions.json into index.html.");
} else {
  console.log("index.html is already current.");
}
