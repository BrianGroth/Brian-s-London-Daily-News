import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { quickSourceAllowed, quickPaths, quickPolicy, prepareQuickBrief } from '../scripts/prepare_quick_brief.mjs';
import { collectSources } from '../scripts/collect_sources.mjs';
import { activitySources } from '../scripts/lib/source_adapters.mjs';
import { fingerprint } from '../scripts/daily_run.mjs';

const now = Date.parse('2026-10-28T10:00:00Z');
const resource = domain => `<article data-domain="${domain}" data-status="active"></article>`;

test('quick sources accept real institution subdomains and reject spoofed hosts or credentials', () => {
  assert.equal(quickSourceAllowed('https://www.ucl.ac.uk/news/2026'), true);
  for (const url of ['https://ucl.ac.uk.evil.example/news', 'https://evil-ucl.ac.uk/news', 'https://ucl.ac.uk@evil.example/', 'http://ucl.ac.uk/news', 'invalid']) assert.equal(quickSourceAllowed(url), false);
});

test('quick brief filters broad sources, caps selection and calendar, and preserves source data', () => {
  const items = Array.from({ length: 50 }, (_, number) => ({ title: `Hampstead guided walk number ${number}`, link: `https://www.heath-hands.org.uk/whatson/${number}`, category_hint: 'Near Home', publisher: 'Heath Hands', published_at: new Date(now).toISOString() }));
  items.push({ title: 'Forbidden exclusive London AI news', publisher_url: 'https://other.example', link: 'https://news.google.com/lead', published_at: new Date(now).toISOString() });
  const input = { rss: { items, generated_at: new Date(now).toISOString(), collection_status: 'ok' }, direct: { items: [] },
    editions: { issues: { today: { stories: [{ id: '2026-10-27-old', headline: 'Compare underlying story', sources: [] }] }, yesterday: { stories: [] } } },
    events: { events: Array.from({ length: 20 }, (_, n) => ({ id: `future-${n}`, title: 'Official activity', startDate: '2026-10-29', sourceUrl: 'https://www.barbican.org.uk/whats-on/example' })).concat([{ id: 'outside', startDate: '2026-10-29', sourceUrl: 'https://other.example/event' }]) },
    pois: { items: [] }, resourcesHtml: resource('heath-hands.org.uk') };
  const original = structuredClone(input), { full, reading } = prepareQuickBrief(input, now);
  assert.deepEqual(input, original);
  assert.equal(reading.profile, 'quick');
  assert.equal(full.sourceCandidateCount, 50);
  assert.equal(full.upcomingEvents.length, quickPolicy.maxCalendarOpportunities);
  assert.ok(full.upcomingEvents.every(event => event.id !== 'outside'));
  for (const [section, limit] of Object.entries(quickPolicy.candidateLimits)) {
    assert.ok(full.candidateSections[section].length <= limit);
    assert.ok(reading.candidates[section].length <= limit);
  }
  assert.equal(reading.adjacentStories.today[0].headline, 'Compare underlying story');
  assert.equal(reading.researchBudget.minutes, 12);
});

test('quick source restrictions never reactivate blocked domains or pad an empty section', () => {
  const input = { rss: { items: [], collection_status: 'failed' }, direct: { items: [{ title: 'Hampstead walk', link: 'https://heath-hands.org.uk/a' }] },
    editions: { issues: { today: { stories: [] }, yesterday: { stories: [] } } }, events: { events: [] }, pois: { items: [] },
    resourcesHtml: '<article data-domain="heath-hands.org.uk" data-status="do-not-use"></article>' };
  const { full } = prepareQuickBrief(input, now);
  assert.equal(full.candidateSections['Near Home'].length, 0);
  assert.ok(full.warnings.some(warning => warning.includes('Near Home')));
  assert.ok(full.warnings.some(warning => warning.includes('failed')));
});

test('quick listing discovery uses four usual sources, bounded requests and retained evidence', async () => {
  const calls = [];
  const client = { metrics: {}, get: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, body: JSON.stringify({ upcoming: Array.from({ length: 25 }, (_, n) => ({ title: `Walk ${n}`, urlId: `walk-${n}`, startDate: now + (n + 1) * 86400000 })) }), checkedAt: new Date(now).toISOString(), bodyFile: '/tmp/example.body' };
  } };
  const sources = [activitySources[0], { ...activitySources[0], id: 'extra-source', url: 'https://extra.example' }];
  const result = await collectSources({ client, sources, now, resourcesHtml: resource('heath-hands.org.uk'), quick: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.timeoutMs, 8000);
  assert.equal(calls[0].options.attempts, 1);
  assert.equal(result.items.length, 8);
  assert.ok(result.items.every(item => item.needs_live_verification && item.evidence_file));
  assert.equal(quickPolicy.activitySourceIds.length, 4);
});

test('quick files and CLI state are isolated; publication still refuses missing review', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'quick-run-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(new URL('../scripts', import.meta.url), path.join(directory, 'scripts'), { recursive: true });
  const paths = quickPaths(directory, '2026-10-28');
  assert.ok(Object.values(paths).every(file => file.startsWith(path.join(directory, '.daily-work', 'quick', '2026-10-28'))));
  const runner = path.join(directory, 'scripts/daily_run.mjs');
  const status = spawnSync(process.execPath, [runner, 'status', '--quick'], { cwd: directory, encoding: 'utf8', timeout: 10000 });
  assert.equal(status.status, 0, status.stderr);
  const result = spawnSync(process.execPath, [runner, 'publish', '--quick'], { cwd: directory, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /publish requires --reviewed/);
  const day = JSON.parse(status.stdout).day;
  const state = JSON.parse(await readFile(path.join(directory, '.daily-work', 'runs', day, 'quick', 'state.json'), 'utf8'));
  assert.equal(state.profile, 'quick');
  assert.equal(state.publication, undefined);
  const todayFiles = quickPaths(directory, day);
  await mkdir(path.dirname(todayFiles.brief), { recursive: true });
  await mkdir(path.join(directory, 'data'));
  const briefFor = id => JSON.stringify({ candidateSections: { 'Near Home': [{ id, title: id, alternateLeads: [] }] } });
  await writeFile(todayFiles.brief, briefFor('quick-only'));
  await writeFile(path.join(directory, 'data/daily-brief.json'), briefFor('full-only'));
  const lookup = path.join(directory, 'scripts/lookup_context.mjs');
  const quickResult = spawnSync(process.execPath, [lookup, 'candidates', 'quick-only', '--quick'], { cwd: directory, encoding: 'utf8', timeout: 10000 });
  assert.equal(quickResult.status, 0, quickResult.stderr);
  assert.equal(JSON.parse(quickResult.stdout).records[0].id, 'quick-only');
  const noFallback = spawnSync(process.execPath, [lookup, 'candidates', 'full-only', '--quick'], { cwd: directory, encoding: 'utf8', timeout: 10000 });
  assert.equal(JSON.parse(noFallback.stdout).count, 0);
  // Absolute quick paths must be read, not mistaken for missing files in checkpoints.
  const inputFile = path.join(directory, 'quick-input.json');
  await writeFile(inputFile, '{"version":1}');
  const before = await fingerprint(directory, [inputFile]);
  await writeFile(inputFile, '{"version":2}');
  assert.notEqual(await fingerprint(directory, [inputFile]), before);
});
