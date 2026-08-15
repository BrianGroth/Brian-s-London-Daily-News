import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (...parts) => path.join(repositoryRoot, "data", ...parts);
const readJson = async (...parts) => JSON.parse(await readFile(dataPath(...parts), "utf8"));
const sections = ["Near Home", "Near Work", "London AI", "London Technology", "Plan Ahead"];
const candidatesPerSection = 10;

const sectionTerms = {
  "Near Home": [
    "hampstead", "heath", "nw3", "camden", "belsize", "finchley road",
    "gospel oak", "south end green", "swiss cottage", "kenwood", "keats",
  ],
  "Near Work": [
    "city of london", "liverpool street", "bishopsgate", "broadgate", "spitalfields",
    "square mile", "moorgate", "barbican", "guildhall", "bank station", "ec2",
  ],
  "London AI": [
    "artificial intelligence", "machine learning", " ai ", "deepmind", "foundation model",
    "large language model", "robotics", "autonomous", "computer vision", "agentic",
  ],
  "London Technology": [
    "technology", "science", "quantum", "cyber", "biotech", "engineering", "research",
    "startup", "semiconductor", "fibre", "connectivity", "computing", "software",
  ],
  "Plan Ahead": [
    "booking", "bookings", "ticket", "deadline", "festival", "consultation", "closure",
    "opens", "opening", "performance", "exhibition", "tour", "register", "applications",
  ],
};

function normalizedTitle(item) {
  const publisherSuffix = item.publisher ? new RegExp(`\\s+-\\s+${escapeRegExp(item.publisher)}$`, "i") : null;
  return item.title
    .replace(publisherSuffix || /$^/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hoursOld(item, referenceTime) {
  const published = Date.parse(item.published_at || "");
  if (!Number.isFinite(published)) return 999;
  return Math.max(0, (referenceTime - published) / 3_600_000);
}

function scoreForSection(item, section, referenceTime) {
  const haystack = ` ${item.title} ${item.summary || ""} `.toLowerCase();
  const signals = [];
  let score = item.category_hint === section ? 6 : 0;
  if (item.category_hint === section) signals.push("collector category");

  for (const term of sectionTerms[section]) {
    if (haystack.includes(term)) {
      score += term.length > 8 ? 7 : 4;
      signals.push(term.trim());
    }
  }

  const age = hoursOld(item, referenceTime);
  score += Math.max(0, 12 - age / 6);
  if (haystack.includes("london")) score += 2;
  if (age > 72 && !["Near Home", "Near Work", "Plan Ahead"].includes(section)) score -= 20;

  return { score: Number(score.toFixed(2)), ageHours: Number(age.toFixed(1)), signals: [...new Set(signals)].slice(0, 5) };
}

function compactStory(story) {
  return {
    id: story.id,
    section: story.section,
    headline: story.headline,
    sourceUrls: (story.sources || []).map(([, url]) => url),
  };
}

const rss = await readJson("rss_candidates.json");
const editions = await readJson("editions.json");
const events = await readJson("upcoming-events.json");
const pois = await readJson("..", "poi", "data", "editorial-pois.json");
const resourcesHtml = await readFile(path.join(repositoryRoot, "resources.html"), "utf8");
const referenceTime = Date.parse(rss.generated_at) || Date.now();
const referenceDate = new Date(referenceTime).toISOString().slice(0, 10);

const deduplicated = [];
const seenTitles = new Set();
const seenLinks = new Set();
for (const item of rss.items || []) {
  const titleKey = normalizedTitle(item);
  if (!titleKey || seenTitles.has(titleKey) || seenLinks.has(item.link)) continue;
  seenTitles.add(titleKey);
  seenLinks.add(item.link);
  deduplicated.push(item);
}

const candidateSections = Object.fromEntries(sections.map((section) => {
  const ranked = deduplicated
    .map((item) => ({ item, ranking: scoreForSection(item, section, referenceTime) }))
    .sort((a, b) => b.ranking.score - a.ranking.score || a.ranking.ageHours - b.ranking.ageHours)
    .slice(0, candidatesPerSection)
    .map(({ item, ranking }) => ({
      title: item.title,
      publisher: item.publisher,
      publishedAt: item.published_at,
      discoveryUrl: item.link,
      discoverySource: item.discovery_source,
      summary: (item.summary || "").replace(/\s+/g, " ").trim().slice(0, 400),
      needsDestinationResolution: /news\.google\.com/i.test(item.link),
      ...ranking,
    }));
  return [section, ranked];
}));

const upcomingEvents = (events.events || [])
  .filter((event) => (event.endDate || event.startDate) >= referenceDate)
  .map((event) => ({
    id: event.id,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    time: event.time,
    location: event.location,
    sourceUrl: event.sourceUrl,
  }));

const activeResourceDomains = [...resourcesHtml.matchAll(/data-domain="([^"]+)"\s+data-status="active"/g)]
  .map((match) => match[1].replace(/^www\./, "").toLowerCase())
  .sort();

const brief = {
  schemaVersion: 1,
  generatedAt: new Date(referenceTime).toISOString(),
  sourceCandidateCount: rss.items?.length || 0,
  deduplicatedCandidateCount: deduplicated.length,
  candidatesPerSection,
  notice: "Discovery shortlist only. Open destination pages, verify every volatile claim live, and prefer primary sources before publication.",
  candidateSections,
  adjacentEditionStories: {
    today: editions.issues.today.stories.map(compactStory),
    yesterday: editions.issues.yesterday.stories.map(compactStory),
  },
  upcomingEvents,
  editorialPois: (pois.items || []).map(({ id, name, lat, lon, sourceUrl }) => ({ id, name, lat, lon, sourceUrl })),
  activeResourceDomains,
};

await writeFile(dataPath("daily-brief.json"), JSON.stringify(brief, null, 2) + "\n", "utf8");
console.log(
  `Prepared data/daily-brief.json: ${rss.items?.length || 0} raw candidates -> ` +
  `${deduplicated.length} unique -> ${sections.length * candidatesPerSection} ranked shortlist entries.`,
);
