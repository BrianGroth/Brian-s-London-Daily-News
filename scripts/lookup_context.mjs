import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const normalize = (value) => String(value ?? "").normalize("NFKC").toLowerCase();

export function selectRecords(records, query) {
  if (!query?.trim()) throw new Error("Supply an ID, domain or search phrase; unbounded record dumps are not supported.");
  const term = normalize(query.trim());
  const exact = records.filter((record) => [record.id, record.domain, record.key].some((value) => normalize(value) === term));
  return exact.length ? exact : records.filter((record) => normalize(JSON.stringify(record)).includes(term));
}

export async function lookup(kind, query) {
  if (kind === "editions" || kind === "stories" || kind === "images") {
    const data = await readJson("data/editions.json");
    if (kind === "editions") return Object.entries(data.issues).map(([key, issue]) => ({ key, label: issue.label, storyIds: issue.stories.map(({ id }) => id) }));
    if (kind === "images") return selectRecords(Object.entries(data.images).map(([key, image]) => ({ key, ...image })), query);
    return selectRecords(Object.entries(data.issues).flatMap(([edition, issue]) => issue.stories.map((story) => ({ edition, ...story, image: data.images[story.imageKey] }))), query);
  }
  if (kind === "events") return selectRecords((await readJson("data/upcoming-events.json")).events, query);
  if (kind === "pois") return selectRecords((await readJson("poi/data/editorial-pois.json")).items, query);
  if (kind === "resources") {
    const html = await readFile(path.join(root, "resources.html"), "utf8");
    const records = [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)].flatMap(([card, attributes]) => {
      const domain = attributes.match(/data-domain=["']([^"']+)["']/i)?.[1];
      return domain ? [{ domain: domain.replace(/^www\./i, "").toLowerCase(), status: attributes.match(/data-status=["']([^"']+)["']/i)?.[1] || "unknown", html: card }] : [];
    });
    return selectRecords(records, query);
  }
  throw new Error("Use editions, stories, images, events, pois or resources. Example: npm run lookup:context -- resources heath");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await lookup(process.argv[2], process.argv.slice(3).join(" "));
    console.log(JSON.stringify({ count: result.length, records: result }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
