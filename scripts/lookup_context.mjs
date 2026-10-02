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
  if (kind === "candidates") {
    const brief = await readJson("data/daily-brief.json");
    const records = Object.entries(brief.candidateSections).flatMap(([section, items]) => items.flatMap(item => [{ section, ...item }, ...item.alternateLeads.map(alternate => ({ section, ...alternate }))]));
    const matched = selectRecords(records, query).map(({ alternateLeads, ...item }) => ({ ...item, alternativeIds: (alternateLeads || []).map(a => a.id) }));
    // One topic may appear in several sections; retain the first full record once.
    return [...new Map(matched.map(record => [record.id, record])).values()];
  }
  if (kind === "editions" || kind === "stories" || kind === "images") {
    const data = await readJson("data/editions.json");
    if (kind === "editions") return Object.entries(data.issues).map(([key, issue]) => ({ key, label: issue.label, storyIds: issue.stories.map(({ id }) => id) }));
    if (kind === "images") {
      const library = await readJson("data/image-library.json");
      return selectRecords(Object.entries(data.images).map(([key, image]) => ({ key, ...image, provenance: library.images[key] })), query);
    }
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
  throw new Error("Use editions, stories, candidates, images, events, pois or resources. Example: npm run lookup:context -- resources heath");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(3), limitAt = args.indexOf("--limit");
    const limit = limitAt < 0 ? 5 : Number(args[limitAt + 1]);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("--limit must be 1–50");
    if (limitAt >= 0) args.splice(limitAt, 2);
    const result = await lookup(process.argv[2], args.join(" "));
    console.log(JSON.stringify({ count: result.length, shown: Math.min(limit, result.length), records: result.slice(0, limit) }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
