import { readFile, writeFile, rename, rm, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { renderIndex } from "./render_edition.mjs";
import { pruneCalendar } from "./calendar_housekeeping.mjs";
import { CATEGORY_IDS } from "../poi/js/lib/categories.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sections = ["Near home", "Near home", "Near home", "Near home", "Near work", "Near work", "London AI", "London technology", "Plan ahead", "Plan ahead"];
const normalize = (value) => value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
const host = (value) => new URL(value).hostname.toLowerCase().replace(/^www\./, "");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const escape = (value) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function fields(record, required, optional = []) {
  requireValue(record && typeof record === "object" && !Array.isArray(record), "Expected an object.");
  for (const key of required) requireValue(Object.hasOwn(record, key), `Missing ${key}.`);
  for (const key of Object.keys(record)) requireValue([...required, ...optional].includes(key), `Unknown field ${key}.`);
}

function text(value, name) {
  requireValue(typeof value === "string" && value.trim().length > 0, `${name} must be nonempty text.`);
}

function date(value) {
  requireValue(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, `Invalid ISO date: ${value}.`);
  return value;
}

function url(value, name, blocked, httpsOnly = false) {
  text(value, name);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} must be an absolute URL.`); }
  requireValue((httpsOnly ? ["https:"] : ["http:", "https:"]).includes(parsed.protocol) && !parsed.username && !parsed.password, `${name} must be a direct ${httpsOnly ? "HTTPS" : "HTTP(S)"} URL without credentials.`);
  const domain = host(value);
  requireValue(domain !== "news.google.com", `${name} must not use a Google News redirect.`);
  requireValue(![...blocked].some((entry) => domain === entry || domain.endsWith(`.${entry}`)), `${name} uses blocked source ${domain}.`);
  return value;
}

function canonicalUrl(value) {
  const parsed = new URL(value);
  parsed.hash = "";
  parsed.hostname = host(value);
  for (const key of [...parsed.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
  parsed.searchParams.sort();
  return parsed.href.replace(/\/$/, "");
}

function action(record, blocked) {
  if (record.action !== undefined) requireValue(["Walk", "Book", "Participate", "Avoid"].includes(record.action), "Unknown action.");
  if (["Book", "Participate"].includes(record.action)) url(record.actionUrl, "actionUrl", blocked, true);
  if (record.actionUrl !== undefined) url(record.actionUrl, "actionUrl", blocked, true);
}

function directory(html) {
  const entries = new Map();
  for (const match of html.matchAll(/<article\b[^>]*\bdata-domain="([^"]+)"[^>]*>/g)) {
    const domain = match[1].toLowerCase().replace(/^www\./, "");
    requireValue(!entries.has(domain), `Duplicate resource domain ${domain}.`);
    entries.set(domain, /data-status="do-not-use"/.test(match[0]) ? "do-not-use" : "active");
  }
  return entries;
}

function validateMorning(morning, blocked) {
  fields(morning, ["mode", "modeUrl", "temperature", "weatherUrl", "rain", "pollen", "transit"]);
  requireValue(morning.mode === "Nearby POI" && morning.modeUrl === "poi/", "Morning strip must retain Nearby POI.");
  for (const key of ["temperature", "rain", "pollen"]) {
    text(morning[key], key);
    requireValue(!/check live/i.test(morning[key]), `${key} cannot contain a placeholder.`);
  }
  url(morning.weatherUrl, "weatherUrl", blocked, true);
  requireValue(host(morning.weatherUrl) === "weather.metoffice.gov.uk", "Weather must link to the Met Office forecast.");
  requireValue(Array.isArray(morning.transit) && morning.transit.length === 2, "Morning strip needs Northern and Overground statuses.");
  morning.transit.forEach((item, index) => {
    requireValue(Array.isArray(item) && item.length === 4 && item[0] === ["Northern", "Overground"][index], "Invalid transit status tuple.");
    text(item[1], "Transit status");
    requireValue(!/check live/i.test(item[1]) && ["good", "check"].includes(item[2]), "Invalid transit status or styling.");
    url(item[3], "Transit URL", blocked, true);
    requireValue(host(item[3]) === "tfl.gov.uk" && new URL(item[3]).pathname.includes("status"), "Transit must link to TfL status.");
  });
}

function validateStories(stories, images, issueDate, blocked) {
  requireValue(Array.isArray(stories) && stories.length === 10, "Edition must contain exactly ten stories.");
  const ids = new Set();
  const headlines = new Set();
  stories.forEach((story, index) => {
    fields(story, ["id", "section", "headline", "location", "brief", "why", "sources", "imageKey"], ["action", "actionUrl"]);
    requireValue(typeof story.id === "string" && story.id.startsWith(`${issueDate}-`) && /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(story.id), "Story IDs must begin with the edition date.");
    requireValue(!ids.has(story.id), `Duplicate story ID ${story.id}.`);
    ids.add(story.id);
    requireValue(typeof story.section === "string" && story.section.toLowerCase() === sections[index].toLowerCase(), "Stories must use the adjacent 4/2/1/1/2 section mix.");
    requireValue(["Near NW3", "Near EC2N", "London-based", "Across London"].includes(story.location), "Invalid story location.");
    for (const key of ["headline", "brief", "why"]) text(story[key], key);
    requireValue(!headlines.has(normalize(story.headline)), `Duplicate story headline ${story.headline}.`);
    headlines.add(normalize(story.headline));
    requireValue(typeof story.imageKey === "string" && /^[A-Za-z0-9_-]+$/.test(story.imageKey) && Object.hasOwn(images, story.imageKey), `Unknown or invalid imageKey ${story.imageKey}.`);
    const image = images[story.imageKey];
    fields(image, ["src", "alt", "credit"]);
    url(image.src, "Image src", blocked, true);
    text(image.alt, "Image alt");
    text(image.credit, "Image credit");
    requireValue(Array.isArray(story.sources) && story.sources.length > 0, "Every story needs sources.");
    for (const source of story.sources) {
      requireValue(Array.isArray(source) && source.length === 2, "Sources must be [name, URL] pairs.");
      text(source[0], "Source name");
      url(source[1], "Source URL", blocked);
    }
    action(story, blocked);
  });
}

function distance(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const square = Math.sin(radians(b.lat - a.lat) / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lon - a.lon) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(square), Math.sqrt(1 - square));
}

function appendRecords(existing, additions, validate, similar, label) {
  requireValue(Array.isArray(existing) && Array.isArray(additions), `${label} must be arrays.`);
  const result = structuredClone(existing);
  const ids = new Set(existing.map((item) => item.id));
  requireValue(ids.size === existing.length, `Existing ${label} contain duplicate IDs.`);
  const added = [], unchanged = [];
  for (const record of additions) {
    validate(record);
    const exact = result.find((item) => item.id === record.id);
    if (exact) {
      requireValue(isDeepStrictEqual(exact, record), `${label} ID ${record.id} conflicts with an existing record; review manually.`);
      unchanged.push(record.id);
      continue;
    }
    const duplicate = result.find((item) => similar(item, record));
    requireValue(!duplicate, `${label} ${record.id} may duplicate ${duplicate?.id}; review manually rather than silently dropping it.`);
    result.push(structuredClone(record));
    added.push(record.id);
  }
  return { records: result, added, unchanged };
}

// Prepare and validate everything in memory before touching any target file.
export function buildEditionUpdate(input, current) {
  fields(input, ["date", "edition"], ["images", "events", "pois", "resources", "pruneExpired"]);
  const issueDate = date(input.date);
  fields(input.edition, ["morning", "stories"]);
  requireValue(current.editions.schemaVersion === 1 && current.events.version === 1 && current.pois.schemaVersion === 1, "Unsupported store schema.");
  const entries = directory(current.resources);
  const blocked = new Set([...entries].filter(([, status]) => status === "do-not-use").map(([domain]) => domain));
  const images = structuredClone(current.editions.images);
  fields(input.images ?? {}, [] , Object.keys(input.images ?? {}));
  for (const [key, image] of Object.entries(input.images ?? {})) {
    requireValue(/^[A-Za-z0-9_-]+$/.test(key) && !["__proto__", "constructor", "prototype"].includes(key), `Invalid image key ${key}.`);
    fields(image, ["src", "alt", "credit"]);
    url(image.src, "Image src", blocked, true);
    text(image.alt, "Image alt"); text(image.credit, "Image credit");
    requireValue(!Object.hasOwn(images, key) || isDeepStrictEqual(images[key], image), `Image ${key} already exists; use a new key to preserve archived images.`);
    images[key] = structuredClone(image);
  }
  validateMorning(input.edition.morning, blocked);
  validateStories(input.edition.stories, images, issueDate, blocked);
  const issues = current.editions.issues;
  for (const key of ["today", "yesterday", "day-before"]) requireValue(Array.isArray(issues?.[key]?.stories) && issues[key].stories.length > 0, `Missing ${key} archive.`);
  const previousDate = date(issues.today.stories[0].id.slice(0, 10));
  requireValue(issues.today.stories.every((story) => story.id.startsWith(previousDate)), "Current edition has inconsistent story dates.");
  requireValue(issueDate >= previousDate, "Cannot apply an edition older than today.");
  const sameDay = issueDate === previousDate;
  const yesterday = sameDay ? issues.yesterday : issues.today;
  for (const story of input.edition.stories) {
    const duplicate = yesterday.stories.find((prior) => prior.id === story.id || normalize(prior.headline) === normalize(story.headline));
    requireValue(!duplicate, `Story ${story.id} repeats yesterday's ID/headline ${duplicate?.id}; review underlying stories manually.`);
  }
  const footer = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(`${issueDate}T12:00:00Z`)).replace(",", "");
  const edition = { label: `London • ${footer}`, footer, ...structuredClone(input.edition) };
  const nextIssues = { today: edition, yesterday: structuredClone(yesterday), "day-before": structuredClone(sameDay ? issues["day-before"] : issues.yesterday) };
  const allIds = Object.values(nextIssues).flatMap((issue) => issue.stories.map((story) => story.id));
  requireValue(new Set(allIds).size === allIds.length, "Story IDs must be unique across the archive.");
  const editions = { ...structuredClone(current.editions), updatedAt: issueDate, images, issues: nextIssues };
  requireValue(input.pruneExpired === undefined || typeof input.pruneExpired === "boolean", "pruneExpired must be boolean.");
  const calendar = input.pruneExpired ? pruneCalendar(current.events, issueDate) : { store: current.events, removed: [] };
  const events = appendRecords(calendar.store.events, input.events ?? [], (event) => {
    fields(event, ["id", "title", "startDate", "section", "location", "sourceName", "sourceUrl", "summary", "addedOn"], ["endDate", "time", "venue", "action", "actionUrl"]);
    for (const key of ["title", "section", "location", "sourceName", "summary"]) text(event[key], key);
    date(event.startDate); date(event.addedOn);
    const end = date(event.endDate ?? event.startDate);
    requireValue(end >= event.startDate && end >= issueDate, "Added event must have a valid upcoming date range.");
    requireValue(event.addedOn === issueDate && new RegExp(`^${event.startDate}-[a-z0-9-]+$`).test(event.id), "Event ID/start date or addedOn is invalid.");
    if (event.time !== undefined) requireValue(/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time), "Event time must be HH:MM.");
    if (event.venue !== undefined) text(event.venue, "venue");
    url(event.sourceUrl, "Event sourceUrl", blocked, true); action(event, blocked);
  }, (a, b) => a.startDate <= (b.endDate ?? b.startDate) && b.startDate <= (a.endDate ?? a.startDate) && (normalize(a.title) === normalize(b.title) || canonicalUrl(a.sourceUrl) === canonicalUrl(b.sourceUrl)), "Events");
  const pois = appendRecords(current.pois.items, input.pois ?? [], (poi) => {
    fields(poi, ["id", "name", "category", "lat", "lon", "description", "url", "sourceUrl", "addedOn"]);
    requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(poi.id), "Invalid POI ID.");
    for (const key of ["name", "description"]) text(poi[key], key);
    requireValue(CATEGORY_IDS.includes(poi.category), "Invalid POI category.");
    requireValue(Number.isFinite(poi.lat) && poi.lat >= -90 && poi.lat <= 90 && Number.isFinite(poi.lon) && poi.lon >= -180 && poi.lon <= 180, "POI requires WGS84 numeric coordinates.");
    requireValue(date(poi.addedOn) === issueDate, "POI addedOn must match edition date.");
    url(poi.url, "POI url", blocked, true); url(poi.sourceUrl, "POI sourceUrl", blocked, true);
  }, (a, b) => canonicalUrl(a.url) === canonicalUrl(b.url) || canonicalUrl(a.sourceUrl) === canonicalUrl(b.sourceUrl) || (normalize(a.name) === normalize(b.name) && distance(a, b) <= 45), "POIs");
  let resources = current.resources;
  const resourceAdded = [], resourceUnchanged = [];
  requireValue(Array.isArray(input.resources ?? []), "resources must be an array.");
  for (const resource of input.resources ?? []) {
    fields(resource, ["name", "url", "description", "section"]);
    text(resource.name, "Resource name"); text(resource.description, "Resource description");
    url(resource.url, "Resource URL", blocked, true);
    const domain = host(resource.url);
    requireValue(["local-sources", "poi-sources", "institutions-sources", "reporting-sources"].includes(resource.section), "Invalid resource section.");
    if (entries.has(domain)) { resourceUnchanged.push(domain); continue; }
    const section = new RegExp(`(<section class="resource-section" aria-labelledby="${resource.section}">[\\s\\S]*?)(\\s*</div>\\s*</section>)`);
    requireValue(section.test(resources), `Missing resource section ${resource.section}.`);
    const card = `\n          <article class="resource-card" data-domain="${escape(domain)}" data-status="active">\n            <a href="${escape(resource.url)}">${escape(resource.name)}</a>\n            <p>${escape(resource.description)}</p>\n            <div class="resource-meta"><span class="status">In use</span><span class="domain">${escape(domain)}</span></div>\n          </article>`;
    resources = resources.replace(section, (_, before, after) => before + card + after);
    entries.set(domain, "active"); resourceAdded.push(domain);
  }
  for (const story of edition.stories) for (const [, source] of story.sources) requireValue(entries.has(host(source)), `Missing resource card for ${host(source)}; supply a verified resources entry.`);
  return {
    editions,
    index: renderIndex(current.index, editions),
    events: events.added.length || calendar.removed.length ? { ...current.events, updatedAt: issueDate, events: events.records } : current.events,
    pois: pois.added.length ? { ...current.pois, updatedAt: issueDate, items: pois.records } : current.pois,
    resources,
    summary: { date: issueDate, archive: sameDay ? "same-day replacement" : "rotated once", events: { added: events.added, unchanged: events.unchanged, removed: calendar.removed.map(({ id, title }) => ({ id, title })) }, pois: { added: pois.added, unchanged: pois.unchanged }, resources: { added: resourceAdded, unchanged: resourceUnchanged } },
  };
}

const targets = { editions: "data/editions.json", index: "index.html", events: "data/upcoming-events.json", pois: "poi/data/editorial-pois.json", resources: "resources.html" };

export async function applyEdition(repositoryRoot, input, { write = false } = {}) {
  const original = Object.fromEntries(await Promise.all(Object.entries(targets).map(async ([key, filename]) => [key, await readFile(path.join(repositoryRoot, filename), "utf8")])));
  const current = Object.fromEntries(Object.entries(original).map(([key, value]) => [key, ["editions", "events", "pois"].includes(key) ? JSON.parse(value) : value]));
  const update = buildEditionUpdate(input, current);
  const changed = Object.entries(targets).map(([key, filename]) => ({ key, filename, value: ["editions", "events", "pois"].includes(key) ? (isDeepStrictEqual(current[key], update[key]) ? original[key] : json(update[key])) : update[key] })).filter(({ key, value }) => value !== original[key]);
  const report = { ...update.summary, write, changedFiles: changed.map(({ filename }) => filename) };
  if (!write || !changed.length) return report;
  const staging = await mkdtemp(path.join(repositoryRoot, ".edition-update-"));
  const installed = [];
  let retainBackup = false;
  try {
    for (const entry of changed) await writeFile(path.join(staging, entry.key), entry.value, "utf8");
    // Catch edits made during validation/staging before replacing any files.
    for (const [key, filename] of Object.entries(targets)) requireValue(await readFile(path.join(repositoryRoot, filename), "utf8") === original[key], `${filename} changed during preparation; rerun against the latest files.`);
    for (const entry of changed) {
      const target = path.join(repositoryRoot, entry.filename);
      const backup = path.join(staging, `${entry.key}.backup`);
      await rename(target, backup);
      const state = { target, backup, installed: false };
      installed.push(state);
      await rename(path.join(staging, entry.key), target);
      state.installed = true;
    }
  } catch (error) {
    for (const entry of installed.reverse()) {
      try {
        if (entry.installed) await rm(entry.target);
        await rename(entry.backup, entry.target);
      } catch (rollbackError) {
        retainBackup = true;
        error.message += ` Rollback failed: ${rollbackError.message}. Recover backups from ${staging}.`;
      }
    }
    throw error;
  } finally {
    if (!retainBackup) await rm(staging, { recursive: true, force: true });
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    requireValue(args.length >= 1 && args.length <= 2 && !args[0].startsWith("--") && (args.length === 1 || args[1] === "--write"), "Usage: node scripts/apply_edition.mjs input.json [--write]");
    const input = JSON.parse(await readFile(path.resolve(args[0]), "utf8"));
    console.log(json(await applyEdition(root, input, { write: args.includes("--write") })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
