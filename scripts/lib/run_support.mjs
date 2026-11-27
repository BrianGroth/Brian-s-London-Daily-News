import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { readJson } from './source_access.mjs';

export function repositoryReadiness(root, { pendingCommit, read = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim() } = {}) {
  const staged = read(['diff', '--cached', '--name-only']);
  const counts = read(['rev-list', '--left-right', '--count', 'HEAD...origin/main']).split(/\s+/).map(Number);
  if (counts.length !== 2 || counts.some(n => !Number.isInteger(n) || n < 0)) throw new Error('Cannot determine repository ancestry.');
  const [ahead, behind] = counts;
  const head = read(['rev-parse', 'HEAD']);
  return { ahead, behind, head, staged: Boolean(staged), dirty: Boolean(read(['diff', '--name-only'])), pendingOnly: ahead === 1 && head === pendingCommit };
}

export function assertPublicationAncestry(status) {
  if (status.staged) throw new Error('Existing staged changes must be reviewed separately.');
  if (status.behind) throw new Error('origin/main advanced; reconcile safely and revalidate before publication.');
  if (status.ahead && !status.pendingOnly) throw new Error('Unexpected local commits would be pushed with HEAD. Reconcile/review them separately before daily publication.');
}

export async function evidenceMetrics(directory, startedAt) {
  const totals = { scope: 'Saved source-reader request records in this edition attempt; excludes other tools and is not a token count.', requests: 0, cacheHits: 0, failures: 0, bytes: 0, records: 0 };
  const seen = new Set();
  const requestDirectory = path.join(directory, 'requests');
  for (const entry of await readdir(requestDirectory).catch(e => { if (e.code === 'ENOENT') return []; throw e; })) {
    if (!entry.endsWith('.json')) continue;
    let record;
    try { record = await readJson(path.join(requestDirectory, entry)); }
    catch (error) { if (error instanceof SyntaxError) { totals.unreadableRecords = (totals.unreadableRecords || 0) + 1; continue; } throw error; }
    if (!record || Date.parse(record.recordedAt) < Date.parse(startedAt) || !Number.isFinite(Date.parse(record.recordedAt))) continue;
    const id = record.requestId || `${record.url}|${record.checkedAt}`;
    if (seen.has(id)) continue; seen.add(id);
    const metrics = record.requestMetrics;
    if (!metrics) continue;
    totals.records++;
    for (const key of ['requests', 'cacheHits', 'failures', 'bytes']) if (Number.isFinite(metrics[key]) && metrics[key] >= 0) totals[key] += metrics[key];
  }
  return totals;
}
