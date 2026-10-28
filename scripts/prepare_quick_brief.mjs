import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prepareBrief, readingBrief, londonDate, resourceContext } from './prepare_daily_brief.mjs';
import { readJson, saveJson } from './lib/source_access.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const quickPolicy = JSON.parse(await readFile(new URL('./quick_sources.json', import.meta.url), 'utf8'));
export function quickPaths(directory = root, day = londonDate(Date.now())) {
  const base = path.join(directory, '.daily-work', 'quick', day);
  return { rss: path.join(base, 'rss.json'), direct: path.join(base, 'direct.json'), brief: path.join(base, 'brief.json'), reading: path.join(base, 'reading.json') };
}
export function quickSourceAllowed(value, policy = quickPolicy) {
  try {
    const url = new URL(value), host = url.hostname.toLowerCase().replace(/^www\./, '');
    return url.protocol === 'https:' && !url.username && !url.password && policy.allowedDomains.some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch { return false; }
}
export function prepareQuickBrief(input, now = Date.now()) {
  const blocked = resourceContext(input.resourcesHtml).blockedResourceDomains;
  const allowedUrl = value => {
    if (!quickSourceAllowed(value)) return false;
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return !blocked.some(domain => host === domain || host.endsWith(`.${domain}`));
  };
  const allowed = item => {
    if (allowedUrl(item.link)) return true;
    try { return new URL(item.link).hostname === 'news.google.com' && allowedUrl(item.publisher_url); }
    catch { return false; }
  };
  const full = prepareBrief({ ...input,
    rss: { ...input.rss, items: (input.rss.items || []).filter(allowed) },
    direct: { ...input.direct, items: (input.direct.items || []).filter(allowed) },
    events: { ...input.events, events: input.events.events.filter(event => allowedUrl(event.sourceUrl)) },
  }, now);
  for (const [section, limit] of Object.entries(quickPolicy.candidateLimits)) {
    full.candidateSections[section] = full.candidateSections[section].slice(0, limit)
      .map(candidate => ({ ...candidate, alternateLeads: candidate.alternateLeads.slice(0, 1) }));
  }
  full.upcomingEvents = full.upcomingEvents.slice(0, quickPolicy.maxCalendarOpportunities);
  full.officialResearchSources = full.officialResearchSources.filter(source => quickSourceAllowed(source.url));
  full.profile = 'quick';
  full.researchBudget = { minutes: quickPolicy.maxResearchMinutes, candidateLimits: quickPolicy.candidateLimits,
    instruction: 'Stop at the first ten justified choices or the research limit. Report a shortfall; never broaden automatically or skip live verification.' };
  const reading = readingBrief(full);
  // Keep the complete bounded shortlist visible; the normal brief has different limits.
  for (const [section, candidates] of Object.entries(full.candidateSections)) {
    reading.candidates[section] = candidates.map(({ id, title, publisher, ageHours, eventStart }) => ({ id, title, publisher, ageHours, eventStart }));
  }
  return { full, reading: { ...reading, profile: full.profile, researchBudget: full.researchBudget, allowedDomains: quickPolicy.allowedDomains } };
}
export async function main() {
  const paths = quickPaths();
  const [rss, direct, editions, events, pois, resourcesHtml] = await Promise.all([
    readJson(paths.rss), readJson(paths.direct), readJson(path.join(root, 'data/editions.json')),
    readJson(path.join(root, 'data/upcoming-events.json')), readJson(path.join(root, 'poi/data/editorial-pois.json')),
    readFile(path.join(root, 'resources.html'), 'utf8'),
  ]);
  if (!rss || !direct) throw new Error('Run quick:prepare first; normal discovery is never substituted for quick inputs.');
  const { full, reading } = prepareQuickBrief({ rss, direct, editions, events, pois, resourcesHtml });
  await saveJson(paths.brief, full); await saveJson(paths.reading, reading);
  console.log(`Quick research: ${paths.reading}; ${Object.values(reading.candidates).flat().length} leads; ${quickPolicy.maxResearchMinutes}-minute editorial budget. Discovery only.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
