// Scheduled discovery is a cache of leads, never editorial verification.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { digest, readJson, saveJson } from './source_access.mjs';

export const discoveryFiles = ['rss_candidates.json', 'direct-candidates.json'];
export const discoveryRepository = 'BrianGroth/Brian-s-London-Daily-News';
const londonDay = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(now));

export async function packSnapshot(inputDir, outputDir, { now = Date.now(), revision, runId } = {}) {
  if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('Snapshot requires a full source revision.');
  const manifest = { schemaVersion: 1, repository: discoveryRepository, revision, runId: String(runId || ''), createdAt: new Date(now).toISOString(), files: {} };
  const bodies = await Promise.all(discoveryFiles.map(async name => [name, await readFile(path.join(inputDir, name))]));
  for (const [name, body] of bodies) manifest.files[name] = { sha256: digest(body), bytes: body.length };
  await mkdir(outputDir, { recursive: true });
  for (const [name, body] of bodies) await writeFile(path.join(outputDir, name), body);
  await saveJson(path.join(outputDir, 'manifest.json'), manifest);
  return manifest;
}

export async function inspectSnapshot(directory, { now = Date.now(), maxAgeMs = 12 * 3600000, revision, runId } = {}) {
  const manifest = await readJson(path.join(directory, 'manifest.json'));
  if (manifest?.schemaVersion !== 1 || manifest.repository !== discoveryRepository || !/^[a-f0-9]{40}$/.test(manifest.revision || '')) throw new Error('Unsupported discovery snapshot manifest.');
  if (revision && manifest.revision !== revision || runId && manifest.runId !== String(runId)) throw new Error('Snapshot workflow provenance mismatch.');
  const age = now - Date.parse(manifest.createdAt);
  if (!Number.isFinite(age) || age < -300000 || age > maxAgeMs || londonDay(manifest.createdAt) !== londonDay(now)) throw new Error('Discovery snapshot is stale or future-dated.');
  if (JSON.stringify(Object.keys(manifest.files || {}).sort()) !== JSON.stringify([...discoveryFiles].sort())) throw new Error('Unexpected discovery snapshot files.');
  const files = [];
  for (const name of discoveryFiles) {
    const meta = manifest.files[name];
    if (!Number.isInteger(meta.bytes) || meta.bytes < 2 || meta.bytes > 12_000_000) throw new Error('Invalid snapshot size.');
    const body = await readFile(path.join(directory, name));
    if (body.length !== meta.bytes || digest(body) !== meta.sha256) throw new Error(`Snapshot hash mismatch: ${name}`);
    const data = JSON.parse(body);
    const sourceAge = now - Date.parse(data.generated_at);
    if (!Array.isArray(data.items) || data.items.length > 20000 || !['ok', 'partial'].includes(data.collection_status) || !Number.isFinite(sourceAge) || sourceAge < -300000 || sourceAge > maxAgeMs || londonDay(data.generated_at) !== londonDay(now)) throw new Error(`Invalid or stale discovery data: ${name}`);
    files.push({ name, body });
  }
  return { manifest, files };
}

export async function importSnapshot(directory, dataDir, options = {}) {
  // Validate the complete allowlist before writing either discovery file.
  const { manifest, files } = await inspectSnapshot(directory, options);
  await mkdir(dataDir, { recursive: true });
  for (const { name, body } of files) await writeFile(path.join(dataDir, name), body);
  return { imported: true, createdAt: manifest.createdAt, revision: manifest.revision, runId: manifest.runId, note: 'Unverified discovery only; rebuild brief locally and verify selected facts live.' };
}

export async function downloadSnapshot(root, { now = Date.now(), execute = (args) => execFileSync('gh', args, { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 2_000_000 }) } = {}) {
  const payload = JSON.parse(await execute(['api', `repos/${discoveryRepository}/actions/workflows/collect-candidates.yml/runs?branch=main&status=success&per_page=5`]));
  const runs = (payload.workflow_runs || []).filter(run => Number.isSafeInteger(run.id) && run.id > 0 && /^[a-f0-9]{40}$/.test(run.head_sha || '') && run.head_branch === 'main' && run.head_repository?.full_name === discoveryRepository && ['schedule', 'workflow_dispatch'].includes(run.event) && run.conclusion === 'success' && now - Date.parse(run.created_at) >= 0 && now - Date.parse(run.created_at) <= 12 * 3600000 && londonDay(run.created_at) === londonDay(now));
  for (const run of runs) {
    const directory = path.join(root, '.daily-work', 'snapshots', `${run.id}-${Date.now()}`);
    try {
      await execute(['run', 'download', String(run.id), '--repo', discoveryRepository, '--name', 'london-discovery', '--dir', directory]);
      return await importSnapshot(directory, path.join(root, 'data'), { now, revision: run.head_sha, runId: run.id });
    } catch { /* An old workflow may have no artifact; try the next, then collect locally. */ }
  }
  return { imported: false, note: 'No compatible fresh artifact; collect live discovery locally.' };
}
