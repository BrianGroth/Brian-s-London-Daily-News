import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { packSnapshot, importSnapshot, inspectSnapshot, discoveryFiles, downloadSnapshot, discoveryRepository } from '../scripts/lib/discovery_snapshot.mjs';
import { repositoryReadiness, assertPublicationAncestry, evidenceMetrics } from '../scripts/lib/run_support.mjs';

const now = Date.parse('2026-11-27T08:00:00Z'), revision = 'a'.repeat(40);
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'discovery-snapshot-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), output = path.join(root, 'snapshot'), target = path.join(root, 'data');
  await mkdir(source); await mkdir(target);
  for (const name of discoveryFiles) await writeFile(path.join(source, name), JSON.stringify({ collection_status: 'ok', generated_at: new Date(now).toISOString(), items: [{ title: 'Unverified lead' }] }));
  await packSnapshot(source, output, { now, revision, runId: 123 });
  return { source, output, target };
}
test('fresh scheduled snapshot imports only allowlisted lead files and validates provenance', async t => {
  const { output, target } = await fixture(t);
  const result = await importSnapshot(output, target, { now, revision, runId: 123 });
  assert.equal(result.imported, true);
  assert.equal(JSON.parse(await readFile(path.join(target, discoveryFiles[0]))).items[0].title, 'Unverified lead');
  await assert.rejects(inspectSnapshot(output, { now, revision: 'b'.repeat(40) }), /provenance/);
  await assert.rejects(inspectSnapshot(output, { now, runId: 124 }), /provenance/);
});
test('stale, tampered, unexpected and failed snapshots are rejected before touching targets', async t => {
  const { source, output, target } = await fixture(t);
  const sentinel = 'preserve local discovery';
  await writeFile(path.join(target, discoveryFiles[0]), sentinel);
  await assert.rejects(importSnapshot(output, target, { now: now + 13 * 3600000 }), /stale/);
  await writeFile(path.join(output, discoveryFiles[1]), '{}');
  await assert.rejects(importSnapshot(output, target, { now }), /hash mismatch/);
  assert.equal(await readFile(path.join(target, discoveryFiles[0]), 'utf8'), sentinel);
  await packSnapshot(source, output, { now, revision });
  const manifestFile = path.join(output, 'manifest.json'), manifest = JSON.parse(await readFile(manifestFile));
  manifest.files['../index.html'] = manifest.files[discoveryFiles[0]];
  await writeFile(manifestFile, JSON.stringify(manifest));
  await assert.rejects(inspectSnapshot(output, { now }), /Unexpected/);
  await writeFile(path.join(source, discoveryFiles[0]), JSON.stringify({ collection_status: 'failed', generated_at: new Date(now).toISOString(), items: [] }));
  await packSnapshot(source, output, { now, revision });
  await assert.rejects(inspectSnapshot(output, { now }), /Invalid or stale/);
});

test('scheduled snapshot download requires the intended repository, branch, event and revision', async t => {
  const { output, target } = await fixture(t);
  const run = { id: 123, head_sha: revision, created_at: new Date(now).toISOString(), head_branch: 'main', head_repository: { full_name: discoveryRepository }, event: 'schedule', conclusion: 'success' };
  let downloads = 0;
  const execute = async args => {
    if (args[0] === 'api') return JSON.stringify({ workflow_runs: [{ ...run, id: 456, event: 'pull_request' }, run] });
    assert.equal(args[2], '123'); downloads++;
    await cp(output, args[args.indexOf('--dir') + 1], { recursive: true });
    return '';
  };
  const result = await downloadSnapshot(target, { now, execute });
  assert.equal(result.imported, true); assert.equal(downloads, 1);
  assert.equal(JSON.parse(await readFile(path.join(target, 'data', discoveryFiles[0]))).items[0].title, 'Unverified lead');
  const rejected = await downloadSnapshot(target, { now, execute: async () => JSON.stringify({ workflow_runs: [{ ...run, head_repository: { full_name: 'someone/else' } }] }) });
  assert.equal(rejected.imported, false);
});
test('publication rejects unexpected reachable commits, stale main and staged work', () => {
  for (const status of [{ ahead: 1 }, { behind: 1 }, { staged: true }]) assert.throws(() => assertPublicationAncestry(status));
  assert.doesNotThrow(() => assertPublicationAncestry({ ahead: 0, behind: 0, staged: false }));
  assert.doesNotThrow(() => assertPublicationAncestry({ ahead: 1, behind: 0, staged: false, pendingOnly: true }));
  const results = { 'diff --cached --name-only': '', 'rev-list --left-right --count HEAD...origin/main': '1\t0', 'rev-parse HEAD': revision, 'diff --name-only': '' };
  const status = repositoryReadiness('/not-used', { pendingCommit: revision, read: args => results[args.join(' ')] });
  assert.equal(status.pendingOnly, true);
});

test('reader metrics count append-only requests rather than latest source verification timestamps', async t => {
  const { target } = await fixture(t);
  const directory = path.join(target, 'requests'); await mkdir(directory);
  for (const [i, metrics] of [[1, { requests: 1, bytes: 100 }], [2, { cacheHits: 1, bytes: 0 }]]) await writeFile(path.join(directory, `${i}.json`), JSON.stringify({ requestId: String(i), recordedAt: new Date(now).toISOString(), checkedAt: '2026-11-01T00:00:00Z', requestMetrics: metrics }));
  await writeFile(path.join(directory, 'broken.json'), '{');
  const result = await evidenceMetrics(target, new Date(now - 1000).toISOString());
  assert.equal(result.records, 2); assert.equal(result.requests, 1); assert.equal(result.cacheHits, 1); assert.equal(result.bytes, 100); assert.equal(result.unreadableRecords, 1);
});

test('runner releases an acquired lock after setup failure and preserves the original error', async t => {
  const { target } = await fixture(t);
  await cp(new URL('../scripts', import.meta.url), path.join(target, 'scripts'), { recursive: true });
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const stateDir = path.join(target, '.daily-work/runs', day);
  await mkdir(stateDir, { recursive: true }); await writeFile(path.join(stateDir, 'state.json'), '{');
  const result = spawnSync(process.execPath, [path.join(target, 'scripts/daily_run.mjs'), 'mark', 'review', 'start'], { cwd: target, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 1); assert.match(result.stderr, /JSON|property|position/i);
  await assert.rejects(access(path.join(target, '.daily-work/runner.lock')), { code: 'ENOENT' });
});

test('explicit editorial markers persist a wall interval without mutating published files', async t => {
  const { target } = await fixture(t);
  await cp(new URL('../scripts', import.meta.url), path.join(target, 'scripts'), { recursive: true });
  const runner = path.join(target, 'scripts/daily_run.mjs');
  for (const action of ['start', 'end']) {
    const result = spawnSync(process.execPath, [runner, 'mark', 'drafting', action], { cwd: target, encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout); assert.equal(output.phase, 'drafting');
    if (action === 'end') assert.ok(output.elapsedWallMs >= 0);
  }
  await assert.rejects(access(path.join(target, '.daily-work/runner.lock')), { code: 'ENOENT' });
});
