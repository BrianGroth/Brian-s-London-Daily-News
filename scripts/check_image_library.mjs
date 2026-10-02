// Review stored rights separately from daily decoding. This command never invents licences.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvidenceClient, mapLimit, saveJson } from './lib/source_access.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = JSON.parse(await readFile(path.join(root, 'data/image-library.json')));
const client = new EvidenceClient({ cacheDir: path.join(root, '.daily-work/evidence') });
const checks = await mapLimit(Object.entries(library.images), 3, async ([key, image]) => {
  const page = await client.get(image.sourceUrl, { maxAgeMs: 7 * 86400000, refresh: process.argv.includes('--refresh') });
  const licencePath = image.licenseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const namedLicense = image.license === 'Public domain' ? /public domain/i.test(page.body) : page.body.includes(licencePath);
  return { key, sourceUrl: image.sourceUrl, checkedAt: page.checkedAt, cacheState: page.cacheState, status: page.ok && namedLicense ? 'licence-still-listed' : 'editorial-review-needed',
    note: 'Page and named licence check only; review authorship, special conditions and accurate subject before selecting an image.' };
});
await saveJson(path.join(root, '.daily-work/image-library-check.json'), { checkedAt: new Date().toISOString(), checks, metrics: client.metrics });
console.log(JSON.stringify({ checks, metrics: client.metrics }));
if (checks.some(c => c.status === 'editorial-review-needed')) process.exitCode = 1;
