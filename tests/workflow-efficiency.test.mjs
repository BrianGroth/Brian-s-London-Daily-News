import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EvidenceClient, publicUrl } from '../scripts/lib/source_access.mjs';
import { extractSource, structuredEvents, plainText, activitySources, extractEvidence } from '../scripts/lib/source_adapters.mjs';
import { readingBrief, prepareBrief, scoreForSection } from '../scripts/prepare_daily_brief.mjs';
import { bridgeRequest } from '../scripts/lib/browser_network.mjs';
import { phaseFresh } from '../scripts/daily_run.mjs';
import { pruneCalendar } from '../scripts/calendar_housekeeping.mjs';
import { collectSources } from '../scripts/collect_sources.mjs';
const now = Date.parse('2026-10-02T08:00:00Z');

test('evidence revalidates cached pages and does not turn a blocked response into success', async () => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'evidence-test-')); let calls = 0, clock = now;
  const client = new EvidenceClient({ cacheDir, now: () => clock, fetcher: async (url, options) => {
    calls++;
    if (url.hostname === 'blocked.example') return new Response('', { status: 403 });
    if (options.headers['If-None-Match']) return new Response(null, { status: 304 });
    return new Response('source body', { headers: { etag: 'version1' } });
  } });
  try {
    assert.equal((await client.get('https://source.example/article')).cacheState, 'fetched');
    assert.equal((await client.get('https://source.example/article')).cacheState, 'cached-needs-reverification');
    assert.equal(calls, 1);
    clock += 3 * 3600000;
    const checked = await client.get('https://source.example/article', { refresh: true });
    assert.equal(checked.cacheState, 'revalidated'); assert.equal(checked.body, 'source body');
    const blocked = await client.get('https://blocked.example/article');
    assert.equal(blocked.ok, false); assert.equal(blocked.attempts, 1);
    assert.equal((await client.get('https://blocked.example/article')).cacheState, 'failure-cooldown');
    assert.equal(calls, 3);
  } finally { await rm(cacheDir, { recursive: true }); }
});

test('credentialed/private evidence URLs and arbitrary browser POSTs are refused', () => {
  for (const url of ['http://example.com', 'https://name:secret@example.com', 'https://127.0.0.1', 'https://169.254.169.254', 'https://server.internal']) assert.throws(() => publicUrl(url));
  const request = (url, method = 'GET', body = '') => ({ url: () => url, method: () => method, postData: () => body });
  assert.equal(bridgeRequest(request('https://www.barbican.org.uk/account')), null);
  assert.equal(bridgeRequest(request('https://api.tfl.gov.uk/anything', 'POST', 'secret')), null);
  assert.equal(bridgeRequest(request('https://overpass-api.de/api/interpreter', 'POST', 'data=unbounded')), null);
  const body = 'data=' + encodeURIComponent('[out:json][timeout:30];(nwr["historic"](around:800,51.5,-0.1););out center;');
  assert.equal(bridgeRequest(request('https://overpass-api.de/api/interpreter', 'POST', body)).method, 'POST');
  assert.equal(bridgeRequest(request('https://unknown.example/image.jpg')), null);
});

test('official event extraction uses action dates, keeps evidence and does not invent availability', () => {
  const source = activitySources[0];
  const payload = { upcoming: [
    { title: 'Future walk', urlId: 'walk', startDate: now + 86400000, endDate: now + 86400000, body: '<p>Free, no booking.</p>' },
    { title: 'Past walk', urlId: 'past', startDate: now - 86400000 },
  ] };
  const events = extractSource(source, JSON.stringify(payload), now);
  assert.equal(events.length, 1); assert.equal(events[0].link, 'https://www.heath-hands.org.uk/whatson/walk');
  assert.equal(events[0].summary, 'Free, no booking.'); assert.equal(events[0].availability, undefined);
  const jsonld = '<script type="application/ld+json">{"@graph":[{"@type":"Event","name":"Exhibition","startDate":"2026-10-03","url":"/event","location":{"name":"Venue"}}]}</script>';
  assert.equal(structuredEvents(jsonld, 'https://example.com/events')[0].link, 'https://example.com/event');
  assert.equal(plainText('<script>secret()</script><p>£10 &amp; free</p>'), '£10 & free');
  const settings = '<script data-drupal-selector="drupal-settings-json">{"event":{"bookingButtonUrl":"https://tickets.example/event/123"}}</script>';
  assert.equal(extractEvidence(settings, 'https://www.barbican.org.uk/event').actions[0].url, 'https://tickets.example/event/123');
});

test('direct upcoming activities outrank incidental news, without filtering old future listings', () => {
  const item = { title: 'Hampstead guided walk', category_hint: 'Near Home', link: 'https://heath-hands.org.uk/whatson/walk', publisher_url: 'https://heath-hands.org.uk', published_at: '2026-09-01', event_start: '2026-10-04', discovery_source: 'Official activity listing' };
  const activity = scoreForSection(item, 'Near Home', now, ['heath-hands.org.uk']);
  const weather = scoreForSection({ ...item, title: 'Hampstead Heath weather forecast', event_start: undefined, discovery_source: 'RSS' }, 'Near Home', now);
  assert.ok(activity.score > weather.score); assert.equal(activity.datedActivitySignal, true);
  const data = { rss: { generated_at: new Date(now).toISOString(), collection_status: 'ok', items: [] }, direct: { items: [item], collection_status: 'ok' }, editions: { issues: { today: { stories: [] }, yesterday: { stories: [] } } }, events: { events: [] }, pois: { items: [] }, resourcesHtml: '' };
  const full = prepareBrief(data, now), small = readingBrief(full);
  assert.ok(small.candidates['Near Home'][0].id);
  assert.equal(small.candidates['Near Home'][0].discoveryUrl, undefined);
  assert.ok(full.candidateSections['Near Home'][0].discoveryUrl);
});

test('recurring event occurrences have distinct lookup IDs even when sharing a booking page', async () => {
  const body = JSON.stringify({ upcoming: [1, 2].map(days => ({ title: 'Recurring walk', urlId: 'walk', startDate: now + days * 86400000 })) });
  const client = { metrics: {}, get: async () => ({ ok: true, body, bodyFile: '/tmp/evidence.body', checkedAt: new Date(now).toISOString() }) };
  const result = await collectSources({ client, sources: [activitySources[0]], now, resourcesHtml: '<article data-domain="heath-hands.org.uk" data-status="active"></article>' });
  assert.equal(result.items.length, 2);
  assert.notEqual(result.items[0].id, result.items[1].id);
});

test('resume requires matching inputs, outputs and freshness; failed work never skips', () => {
  const phase = { status: 'passed', inputHash: 'input', outputHash: 'output', completedAt: new Date(now).toISOString() };
  assert.equal(phaseFresh(phase, 'input', 'output', now + 1000, 2000), true);
  assert.equal(phaseFresh(phase, 'different', 'output', now), false);
  assert.equal(phaseFresh(phase, 'input', 'changed', now), false);
  assert.equal(phaseFresh(phase, 'input', 'output', now + 3000, 2000), false);
  assert.equal(phaseFresh({ ...phase, status: 'failed' }, 'input', 'output', now), false);
});

test('calendar housekeeping preserves today, ongoing events and future records verbatim', () => {
  const store = { version: 1, updatedAt: '2026-10-01', events: [
    { id: 'past', startDate: '2026-10-01' }, { id: 'today', startDate: '2026-10-02' },
    { id: 'ongoing', startDate: '2026-09-01', endDate: '2026-10-03' }, { id: 'future', startDate: '2027-01-01' },
  ] };
  const result = pruneCalendar(store, '2026-10-02');
  assert.deepEqual(result.removed.map(e => e.id), ['past']); assert.deepEqual(result.store.events, store.events.slice(1));
  assert.equal(store.events.length, 4); assert.equal(result.store.updatedAt, '2026-10-02');
  assert.throws(() => pruneCalendar({ events: [{ id: 'broken', startDate: '2026-02-30' }] }, '2026-10-02'));
});
