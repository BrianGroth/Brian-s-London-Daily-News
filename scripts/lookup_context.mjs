import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quickPaths } from "./prepare_quick_brief.mjs";
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (file) => JSON.parse(await readFile(path.resolve(root, file), "utf8"));
const normalize = (value) => String(value ?? "").normalize("NFKC").toLowerCase();

export function selectRecords(records, query) {
  if (!query?.trim()) throw new Error("Supply an ID, domain or search phrase; unbounded record dumps are not supported.");
  const term = normalize(query.trim());
  const exact = records.filter((record) => [record.id, record.domain, record.key].some((value) => normalize(value) === term));
  return exact.length ? exact : records.filter((record) => normalize(JSON.stringify(record)).includes(term));
}

export function imageMatches(records, query, key) {
  if (key) return records.filter(record => normalize(record.key) === normalize(key)).map(record => ({ ...record, rightsStatus: record.provenance?.rightsVerifiedAt ? 'reviewed; confirm applicable use' : 'unreviewed legacy image' }));
  if (!query?.trim()) throw new Error('Supply an image subject or --key for an exact legacy key.');
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return records.filter(record => record.provenance?.rightsVerifiedAt && record.provenance?.license && record.provenance?.author)
    .filter(record => terms.every(term => normalize(`${record.provenance.subject} ${(record.provenance.tags || []).join(' ')} ${record.alt}`).includes(term)));
}

export function compactRecord(record) {
  if (record.candidate) return record;
  const fields = ['id', 'key', 'domain', 'section', 'title', 'headline', 'publisher', 'publishedAt', 'eventStart', 'eventEnd', 'startDate', 'endDate', 'time', 'venue', 'sourceName', 'nextActionDate', 'actionKind', 'discoveryUrl', 'sourceUrl', 'summary', 'reviewFlags', 'priorStoryIds', 'geography', 'selectionStatus', 'alternativeIds', 'src', 'alt', 'credit', 'provenance', 'rightsStatus', 'label', 'storyIds', 'status'];
  return Object.fromEntries(fields.filter(field => record[field] !== undefined).map(field => [field, record[field]]));
}

export async function lookup(kind, query, { quick = false, ids, key } = {}) {
  if (ids) {
    if (kind === 'editions') throw new Error('Use editions without --ids to list the three archive slots.');
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !id.trim())) throw new Error('--ids requires comma-separated identifiers.');
    return [...new Map((await Promise.all(ids.map(id => lookup(kind, id, { quick, key: kind === 'images' ? id : key })))).flat().map(record => [record.id || record.key || record.domain || record.candidate?.id, record])).values()];
  }
  if (kind === 'package') {
    const candidates = await lookup('candidates', query, { quick });
    const data = await readJson('data/editions.json');
    const calendar = (await readJson('data/upcoming-events.json')).events;
    const library = await readJson('data/image-library.json');
    const images = Object.entries(data.images).map(([key, image]) => ({ key, ...image, provenance: library.images[key] }));
    return Promise.all(candidates.map(async candidate => {
      const url = candidate.discoveryUrl;
      const file = path.join(root, '.daily-work/evidence', createHash('sha256').update(url).digest('hex') + '.extracted.json');
      let evidence = null;
      try { const saved = await readJson(file); const { textExcerpt, ...availability } = saved.availability || {}; evidence = { checkedAt: saved.checkedAt, cacheState: saved.cacheState, bodyFile: saved.bodyFile, extractedFile: file, evidence: saved.evidence, availability: saved.availability ? availability : undefined }; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const terms = candidate.title.toLowerCase().match(/\b(?:hampstead|kenwood|heath|barbican|spitalfields|imperial|ucl|burgh|freud)\b/g) || [];
      return { candidate: compactRecord(candidate), priorCoverage: Object.values(data.issues).flatMap(issue => issue.stories).filter(story => candidate.priorStoryIds?.includes(story.id) || story.sources?.some(([, source]) => source === url)),
        calendarMatches: calendar.filter(event => event.sourceUrl === url),
        imageOptions: terms.length ? imageMatches(images, terms[0]).slice(0, 4) : [], evidence,
        note: 'Cached evidence is labelled with its observation time; this package does not refresh or verify claims.' };
    }));
  }
  if (kind === "candidates") {
    const brief = await readJson(quick ? quickPaths(root).brief : "data/daily-brief.json");
    const records = Object.entries(brief.candidateSections).flatMap(([section, items]) => items.flatMap(item => [{ section, ...item }, ...(item.alternateLeads || []).map(alternate => ({ section, ...alternate }))]));
    for (const [section, items] of Object.entries(brief.verificationQueue || {})) records.push(...items.map(item => ({ section, ...item, selectionStatus: 'needs geographic verification' })));
    const matched = selectRecords(records, query).map(({ alternateLeads, ...item }) => ({ ...item, alternativeIds: (alternateLeads || []).map(a => a.id) }));
    // One topic may appear in several sections; retain the first full record once.
    return [...new Map(matched.map(record => [record.id, record])).values()];
  }
  if (kind === "editions" || kind === "stories" || kind === "images") {
    const data = await readJson("data/editions.json");
    if (kind === "editions") return Object.entries(data.issues).map(([key, issue]) => ({ key, label: issue.label, storyIds: issue.stories.map(({ id }) => id) }));
    if (kind === "images") {
      const library = await readJson("data/image-library.json");
      return imageMatches(Object.entries(data.images).map(([key, image]) => ({ key, ...image, provenance: library.images[key] })), query, key);
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
  throw new Error("Use editions, stories, candidates, package, images, events, pois or resources. Example: npm run lookup:context -- images heath");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(3), quickAt = args.indexOf("--quick"), quick = quickAt >= 0;
    if (quick) args.splice(quickAt, 1);
    const take = name => { const at = args.indexOf(name); if (at < 0) return undefined; const value = args[at + 1]; if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`); args.splice(at, 2); return value; };
    const ids = take('--ids')?.split(',').map(id => id.trim());
    const key = take('--key');
    const format = take('--format') || 'compact';
    if (!['compact', 'full'].includes(format)) throw new Error('--format must be compact or full');
    if (key && process.argv[2] !== 'images') throw new Error('--key is only supported for images');
    const limitAt = args.indexOf("--limit");
    const limit = limitAt < 0 ? 5 : Number(args[limitAt + 1]);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("--limit must be 1–50");
    if (limitAt >= 0) args.splice(limitAt, 2);
    const result = await lookup(process.argv[2], args.join(" "), { quick, ids, key });
    const records = result.slice(0, limit).map(record => format === 'compact' ? compactRecord(record) : record);
    console.log(JSON.stringify({ count: result.length, shown: records.length, records }, null, format === 'full' ? 2 : undefined));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
