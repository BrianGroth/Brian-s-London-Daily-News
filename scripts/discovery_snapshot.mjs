import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { packSnapshot, importSnapshot } from './lib/discovery_snapshot.mjs';
const [command, ...args] = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
try {
  const result = command === 'pack'
    ? await packSnapshot(path.resolve(option('--input-dir', 'data')), path.resolve(option('--output', '.daily-work/discovery-snapshot')), { revision: process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), runId: process.env.GITHUB_RUN_ID })
    : command === 'import' && args.includes('--input')
      ? await importSnapshot(path.resolve(option('--input')), path.resolve(option('--data-dir', 'data')))
      : (() => { throw new Error('Use pack [--output DIR] or import --input DIR.'); })();
  console.log(JSON.stringify(result));
} catch (error) { console.error(error.message); process.exitCode = 1; }
