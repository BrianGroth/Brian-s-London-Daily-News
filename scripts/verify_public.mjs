import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, publicFetch, boundedBody, mapLimit } from './lib/source_access.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function verifyPublic({ baseUrl, commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), attempts = 1 } = {}) {
  const base = new URL(baseUrl); if (!base.pathname.endsWith('/')) base.pathname += '/';
  const localIndex = digest(await readFile(path.join(root, 'index.html')));
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const { response } = await publicFetch(new URL(`deployment.json?revision=${commit}`, base).href);
      if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
      const manifest = JSON.parse((await boundedBody(response)).toString());
      if (manifest.commit !== commit || manifest.indexSha256 !== localIndex) throw new Error('Public commit or homepage hash does not match local HEAD');
      const expected = manifest.files || { 'index.html': localIndex };
      const checks = await mapLimit(Object.entries(expected), 4, async ([file, sha]) => {
        if (file.includes('..') || file.startsWith('/') || /[?#]/.test(file)) throw new Error('Invalid manifest path');
        const local = digest(await readFile(path.join(root, file)));
        const { response } = await publicFetch(new URL(`${file}?revision=${commit}`, base).href);
        const bytes = await boundedBody(response);
        if (!response.ok || digest(bytes) !== sha || sha !== local) throw new Error(`Public asset mismatch: ${file}`);
        return file;
      });
      return { ok: true, commit, issueLabel: manifest.issueLabel, url: base.href, checkedFiles: checks, checkedAt: new Date().toISOString() };
    } catch (error) { lastError = error; if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 5000)); }
  }
  throw lastError;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), option = name => args[args.indexOf(name) + 1];
  const result = await verifyPublic({ baseUrl: args.includes('--url') ? option('--url') : 'https://briangroth.github.io/Brian-s-London-Daily-News/', attempts: args.includes('--wait') ? 60 : 1 });
  console.log(JSON.stringify(result));
}
