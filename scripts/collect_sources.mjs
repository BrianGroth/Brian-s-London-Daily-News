import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { EvidenceClient, mapLimit, saveJson, digest } from './lib/source_access.mjs';
import { activitySources, extractSource } from './lib/source_adapters.mjs';
import { resourceContext, londonDate } from './prepare_daily_brief.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function collectSources({ client = new EvidenceClient({ cacheDir: path.join(root, '.daily-work/evidence') }), sources = activitySources, now = Date.now(), resourcesHtml, refresh = false } = {}) {
  const domains = resourceContext(resourcesHtml ?? await readFile(path.join(root, 'resources.html'), 'utf8'));
  const checks = await mapLimit(sources, 3, async source => {
    const host = new URL(source.url).hostname.replace(/^www\./, '');
    if (!domains.activeResourceDomains.includes(host) || domains.blockedResourceDomains.some(h => host === h || host.endsWith(`.${h}`))) return { id: source.id, status: 'excluded', error: 'Source is not approved in resources.html', items: [] };
    const evidence = await client.get(source.url, { refresh });
    let items = [], error;
    if (evidence.ok) try {
      items = extractSource(source, evidence.body, now).map(e => ({ ...e, id: 'direct-' + digest(e.link + '\n' + (e.event_start || '')).slice(0, 16), category_hint: source.section,
        publisher: source.name, publisher_url: source.url, published_at: '', discovered_at: evidence.checkedAt, discovery_source: 'Official activity listing',
        checked_at: evidence.checkedAt, evidence_file: path.relative(root, evidence.bodyFile), needs_live_verification: true }));
      if (!items.length) error = 'No event records extracted; inspect source or broaden research';
    } catch (e) { error = e.message; }
    return { id: source.id, url: source.url, status: evidence.ok && !error ? 'ok' : 'error', error: error || evidence.error,
      checkedAt: evidence.checkedAt, cacheState: evidence.cacheState, durationMs: evidence.elapsedMs, items };
  });
  const feeds = checks.map(({ items, ...check }) => ({ ...check, itemCount: items.length }));
  return { schemaVersion: 1, generated_at: new Date(now).toISOString(), londonDate: londonDate(now), collection_status: feeds.every(f => f.status === 'ok') ? 'ok' : 'partial',
    feeds, metrics: client.metrics, items: checks.flatMap(c => c.items) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--output');
  const output = index >= 0 ? process.argv[index + 1] : path.join(root, 'data/direct-candidates.json');
  const payload = await collectSources({ refresh: process.argv.includes('--refresh') });
  await saveJson(output, payload);
  console.log(JSON.stringify({ output, candidates: payload.items.length, status: payload.collection_status, feeds: payload.feeds, metrics: payload.metrics }));
}
