import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = (...parts) => path.join(repositoryRoot, "data", ...parts);
export const sections = ["Near Home", "Near Work", "London AI", "London Technology", "Plan Ahead"];
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

export function normalizedTitle(item) {
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

const activityPattern = /\b(walks?|tours?|workshops?|performances?|exhibitions?|festivals?|tickets?|bookings?|concerts?|volunteer|classes|screenings?|open day|guided|register)\b/i;
const primarySeeds = new Set(["heath-hands.org.uk", "hampsteadtheatre.com", "english-heritage.org.uk", "barbican.org.uk", "turing.ac.uk"]);

function hostname(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function isBlockedDomain(domain, blocked) {
  return [...blocked].some((entry) => domain === entry || domain.endsWith(`.${entry}`));
}

export function resourceContext(html) {
  const active = new Set();
  const blocked = new Set();
  for (const tag of html.matchAll(/<[^>]+\bdata-domain\s*=[^>]+>/gi)) {
    const domain = tag[0].match(/\bdata-domain\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase().replace(/^www\./, "");
    const status = tag[0].match(/\bdata-status\s*=\s*["']([^"']+)["']/i)?.[1];
    if (domain && status === "active") active.add(domain);
    if (domain && status === "do-not-use") blocked.add(domain);
  }
  return { activeResourceDomains: [...active].filter((domain) => !isBlockedDomain(domain, blocked)).sort(), blockedResourceDomains: [...blocked].sort() };
}

export function officialResearchSources(html, activeDomains) {
  const sources = [];
  for (const card of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
    const domain = card[1].match(/\bdata-domain\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase().replace(/^www\./, "");
    if (!activeDomains.includes(domain) || (!primarySeeds.has(domain) && !/\.(gov|ac)\.uk$/.test(domain))) continue;
    const anchor = card[2].match(/<a\b[^>]*href=["'](https:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor || hostname(anchor[1]) !== domain) continue;
    sources.push({ name: anchor[2].replace(/<[^>]*>/g, "").replaceAll("&amp;", "&").trim(), url: anchor[1].replaceAll("&amp;", "&"), domain, needsLiveVerification: true });
  }
  const priority = ["heath-hands.org.uk", "cityoflondon.gov.uk", "english-heritage.org.uk", "hampsteadtheatre.com", "barbican.org.uk"];
  const rank = (domain) => priority.includes(domain) ? priority.indexOf(domain) : priority.length;
  return sources.sort((a, b) => rank(a.domain) - rank(b.domain) || a.domain.localeCompare(b.domain));
}

export function londonDate(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

export function scoreForSection(item, section, referenceTime, activeDomains = []) {
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
  const activity = activityPattern.test(haystack);
  const sectionMatch = item.category_hint === section || sectionTerms[section].some((term) => haystack.includes(term));
  if (activity && sectionMatch && ["Near Home", "Near Work", "Plan Ahead"].includes(section)) {
    score += 14;
    signals.unshift("activity/action wording: verify upcoming date");
  }
  const domain = hostname(item.publisher_url || item.link);
  const primary = activeDomains.includes(domain) && (/\.(gov|ac)\.uk$/.test(domain) || primarySeeds.has(domain));
  const eventEnd = Date.parse(item.event_end || item.event_start || "");
  const datedActivity = Number.isFinite(eventEnd) && eventEnd >= referenceTime;
  if (datedActivity && sectionMatch && ["Near Home", "Near Work", "Plan Ahead"].includes(section)) {
    score += 24 + Math.max(0, 14 - Math.max(0, (Date.parse(item.event_start) - referenceTime) / 86400000)); signals.unshift("source lists an upcoming date: reverify availability");
  }
  if (item.discovery_source === "Official activity listing" && sectionMatch) score += 18;
  if (/\bweather forecast\b/i.test(item.title) && section === "Near Home") score -= 30;
  if (primary) { score += 5; signals.unshift("approved primary-source lead"); }

  return { datedActivitySignal: datedActivity, score: Number(score.toFixed(2)), ageHours: item.published_at ? Number(age.toFixed(1)) : null, activitySignal: activity, primarySourceSignal: primary, signals: [...new Set(signals)].slice(0, 5) };
}

// Group only highly similar wording. Different dates/numbers remain distinct;
// every alternate survives and still needs editorial comparison.
export function likelySameTopic(left, right) {
  return sameTopicSignatures(topicSignature(left), topicSignature(right));
}

function topicSignature(item) {
  const title = normalizedTitle(item);
  return {
    title,
    numbers: (title.match(/\b\d+\b/g) || []).join(),
    actionDate: item.event_start?.slice(0, 10) || null,
    tokens: new Set(title.split(" ").filter((word) => word.length > 2 && !["the", "and", "for", "with", "from", "london"].includes(word))),
  };
}

function sameTopicSignatures(a, b) {
  if (a.title === b.title) return true;
  if (a.numbers !== b.numbers || a.actionDate !== b.actionDate) return false;
  let common = 0;
  for (const word of a.tokens) if (b.tokens.has(word)) common += 1;
  return common >= 5 && common / (a.tokens.size + b.tokens.size - common) >= 0.65;
}

function compactStory(story) {
  return {
    id: story.id,
    section: story.section,
    headline: story.headline,
    sourceUrls: (story.sources || []).map(([, url]) => url),
  };
}

export function prepareBrief({ rss, direct = { items: [] }, editions, events, pois, resourcesHtml }, now = Date.now()) {
  const referenceTime = new Date(now).getTime();
  if (!Number.isFinite(referenceTime)) throw new Error("Invalid briefing time");
  const referenceDate = londonDate(referenceTime);
  const domains = resourceContext(resourcesHtml);
  const blocked = new Set(domains.blockedResourceDomains);

  const deduplicated = [];
  const seenLinks = new Set();
  for (const item of [...(direct.items || []), ...(rss.items || [])]) {
    const titleKey = normalizedTitle(item);
    if (!titleKey || !item.link || seenLinks.has(item.link)) continue;
    if (isBlockedDomain(hostname(item.link), blocked) || isBlockedDomain(hostname(item.publisher_url), blocked)) continue;
    seenLinks.add(item.link);
    deduplicated.push(item);
  }

  const candidateSections = Object.fromEntries(sections.map((section) => {
    const ranked = deduplicated
      .map((item) => ({ item, signature: topicSignature(item), ranking: scoreForSection(item, section, referenceTime, domains.activeResourceDomains) }))
      .filter(({ item, ranking }) => !["London AI", "London Technology"].includes(section) || (item.published_at && ranking.ageHours <= 72))
      .sort((a, b) => b.ranking.score - a.ranking.score || a.ranking.ageHours - b.ranking.ageHours || a.item.link.localeCompare(b.item.link));
    const groups = [];
    for (const candidate of ranked) {
      const group = groups.find(({ signature }) => sameTopicSignatures(signature, candidate.signature));
      if (group) group.alternates.push(candidate);
      else if (groups.length < candidatesPerSection) groups.push({ ...candidate, alternates: [] });
    }
    const compact = ({ item, ranking }) => ({
        id: item.id || "lead-" + createHash("sha256").update(item.link).digest("hex").slice(0, 16),
        title: item.title,
        eventStart: item.event_start, eventEnd: item.event_end,
        evidenceFile: item.evidence_file, checkedAt: item.checked_at,
        publisher: item.publisher,
        publishedAt: item.published_at,
        discoveryUrl: item.link,
        discoverySource: item.discovery_source,
        publisherUrl: item.publisher_url || undefined,
        summary: (item.summary || "").replace(/\s+/g, " ").trim().slice(0, 400),
        needsDestinationResolution: /news\.google\.com/i.test(item.link),
        ...ranking,
      });
    return [section, groups.slice(0, candidatesPerSection).map((group) => ({
      ...compact(group), alternateLeads: group.alternates.map(compact),
    }))];
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
      section: event.section,
      sourceUrl: event.sourceUrl,
      needsLiveReverification: true,
    })).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));

  const warnings = [];
  const sourceAgeHours = (referenceTime - Date.parse(rss.generated_at)) / 3_600_000;
  if (!Number.isFinite(sourceAgeHours) || sourceAgeHours > 24) warnings.push("Discovery collection is missing a timestamp or older than 24 hours; refresh or broaden live research.");
  if (!rss.collection_status) warnings.push("Feed health is unknown for this legacy discovery file.");
  else if (rss.collection_status !== "ok") warnings.push(`Feed collection ${rss.collection_status}; inspect collectionHealth and research failed sections live.`);
  for (const feed of direct.feeds || []) if (feed.status !== "ok") warnings.push(`Direct source ${feed.id}: ${feed.error || feed.status}; broaden research.`);
  for (const section of sections) {
    if (candidateSections[section].length < candidatesPerSection) warnings.push(`${section}: fewer than ${candidatesPerSection} distinct leads; broaden research.`);
  }

  const brief = {
    schemaVersion: 1,
    generatedAt: new Date(referenceTime).toISOString(),
    londonDate: referenceDate,
    sourceCollectedAt: rss.generated_at || null,
    collectionHealth: { status: rss.collection_status || "unknown", lastSuccessAt: rss.last_success_at || null, feeds: rss.feeds || [] },
    warnings,
    sourceCandidateCount: (rss.items?.length || 0) + (direct.items?.length || 0),
    directCollectionHealth: { status: direct.collection_status || "not-collected", feeds: direct.feeds || [] },
    deduplicatedCandidateCount: deduplicated.length,
    candidatesPerSection,
    notice: "Discovery shortlist only. Open destination pages, verify every volatile claim live, and prefer primary sources before publication.",
    candidateSections,
    officialResearchSources: officialResearchSources(resourcesHtml, domains.activeResourceDomains),
    archiveDates: Object.fromEntries(Object.entries(editions.issues).map(([key, issue]) => [key, {
      date: issue.date || issue.stories[0]?.id?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null,
      label: issue.label || null,
      storyCount: issue.stories.length,
    }])),
    adjacentEditionStories: {
      today: editions.issues.today.stories.map(compactStory),
      yesterday: editions.issues.yesterday.stories.map(compactStory),
    },
    upcomingEvents,
    editorialPois: (pois.items || []).map(({ id, name, lat, lon, sourceUrl }) => ({ id, name, lat, lon, sourceUrl })),
    ...domains,
  };
  return brief;
}

// Model-facing view: no opaque redirect URLs, article bodies or unlimited catalogues.
export function readingBrief(brief) {
  const limits = { "Near Home": 6, "Near Work": 4, "London AI": 3, "London Technology": 3, "Plan Ahead": 4 };
  const candidates = Object.fromEntries(sections.map(section => [section, brief.candidateSections[section].slice(0, limits[section]).map(c => ({
    id: c.id, title: c.title.slice(0, 150), publisher: c.publisher, ageHours: c.ageHours,
    ...(c.eventStart ? { eventStart: c.eventStart, eventEnd: c.eventEnd } : {}),
    primary: c.primarySourceSignal, alternatives: c.alternateLeads.length,
  }))]));
  return { schemaVersion: 1, londonDate: brief.londonDate,
    notice: "Discovery only. Read selected full records with lookup:context candidates ID. Reverify facts live; alternatives and the full pool remain on disk.",
    health: { rss: brief.collectionHealth.status, direct: brief.directCollectionHealth?.status, rawCount: brief.sourceCandidateCount },
    warnings: brief.warnings, archiveDates: brief.archiveDates,
    adjacentStories: Object.fromEntries(Object.entries(brief.adjacentEditionStories).map(([key, stories]) => [key, stories.map(({ id, section, headline }) => ({ id, section, headline }))])),
    candidates, upcoming: brief.upcomingEvents.slice(0, 12).map(({ id, title, startDate, endDate }) => ({ id, title, startDate, endDate })),
    counts: { calendar: brief.upcomingEvents.length, pois: brief.editorialPois.length, resources: brief.activeResourceDomains.length },
    blockedResourceDomains: brief.blockedResourceDomains,
    lookup: "Use editions, stories, candidates, images, events, pois or resources with an ID or search phrase. Never dump the full pool by default." };
}

export async function main(args = process.argv.slice(2)) {
  const started = performance.now();
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--output", "--reading-output", "--now"].includes(args[i]) || !args[i + 1]) throw new Error("Usage: prepare_daily_brief.mjs [--output PATH] [--reading-output PATH] [--now ISO_TIMESTAMP]");
    options[args[i]] = args[i + 1];
  }
  const paths = [dataPath("rss_candidates.json"), dataPath("editions.json"), dataPath("upcoming-events.json"), path.join(repositoryRoot, "poi/data/editorial-pois.json"), path.join(repositoryRoot, "resources.html")];
  const loaded = await Promise.all(paths.map((file) => readFile(file, "utf8")));
  const [rss, editions, events, pois] = loaded.slice(0, 4).map(JSON.parse);
  const direct = JSON.parse(await readFile(dataPath("direct-candidates.json"), "utf8").catch(error => { if (error.code === "ENOENT") return '{"items":[]}'; throw error; }));
  const brief = prepareBrief({ rss, direct, editions, events, pois, resourcesHtml: loaded[4] }, options["--now"] || Date.now());
  const output = options["--output"] || dataPath("daily-brief.json");
  await writeFile(output, JSON.stringify(brief, null, 2) + "\n", "utf8");
  const readingOutput = options["--reading-output"] || path.join(path.dirname(output), "reading-brief.json");
  const reading = readingBrief(brief);
  await writeFile(readingOutput, JSON.stringify(reading) + "\n", "utf8");
  console.log(`Reading brief: ${readingOutput} (${Buffer.byteLength(JSON.stringify(reading))} bytes); full records remain in ${output}.`);
  console.log(`Prepared ${output}: ${brief.sourceCandidateCount} raw candidates -> ${Object.values(brief.candidateSections).flat().length} topic leads in ${((performance.now() - started) / 1000).toFixed(2)}s.`);
  for (const warning of brief.warnings) console.warn(warning);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
