// Resumable operations, not an autonomous editor. An agent supplies verified editorial input.
import { spawn, execFileSync } from 'node:child_process';
import { readFile, mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, readJson, saveJson } from './lib/source_access.mjs';
import { londonDate } from './prepare_daily_brief.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicationFiles = ['data/editions.json', 'index.html', 'data/upcoming-events.json', 'poi/data/editorial-pois.json', 'resources.html', 'data/image-library.json', 'data/rss_candidates.json', 'data/direct-candidates.json', 'data/daily-brief.json', 'data/reading-brief.json'];
export async function fingerprint(directory, files) {
  return digest(JSON.stringify(await Promise.all(files.map(async file => {
    try { return [file, digest(await readFile(path.join(directory, file)))]; }
    catch (e) { if (e.code === 'ENOENT') return [file, null]; throw e; }
  }))));
}
async function treeFiles(directory) {
  const found = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory() && !['node_modules', '__pycache__', '.git'].includes(entry.name)) found.push(...await treeFiles(file)); else if (entry.isFile()) found.push(file);
  }
  return found.sort();
}
export function phaseFresh(phase, hash, outputHash, now, maxAgeMs = Infinity) {
  return phase?.status === 'passed' && phase.inputHash === hash && phase.outputHash === outputHash && now >= Date.parse(phase.completedAt) && now - Date.parse(phase.completedAt) < maxAgeMs;
}
export async function main(args = process.argv.slice(2)) {
  const command = args[0], has = flag => args.includes(flag), option = flag => args[args.indexOf(flag) + 1];
  if (!['prepare', 'apply', 'validate', 'publish', 'maintain', 'status'].includes(command)) throw new Error('Use prepare, apply, validate, publish, maintain or status. See docs/DAILY_RUN.md.');
  const day = londonDate(Date.now()), work = path.join(root, '.daily-work/runs', day), stateFile = path.join(work, 'state.json');
  await mkdir(work, { recursive: true });
  if (command === 'status') { console.log(JSON.stringify(await readJson(stateFile, { day, phases: {} }), null, 2)); return; }
  const lock = path.join(root, '.daily-work/runner.lock');
  await mkdir(lock).catch(e => { if (e.code === 'EEXIST') throw new Error('Another runner owns .daily-work/runner.lock; inspect it before removing a stale lock.'); throw e; });
  await saveJson(path.join(lock, 'owner.json'), { pid: process.pid, day, command, startedAt: new Date().toISOString() });
  const state = await readJson(stateFile, { schemaVersion: 1, day, phases: {}, note: 'Editorial truth and image rights are reviewed by the agent. Successful commands do not establish factual verification.' });
  const tools = ['package.json', 'package-lock.json', ...await treeFiles('scripts')];
  async function run(executable, parameters, logName) {
    const started = performance.now(), chunks = [];
    const result = await new Promise((resolve, reject) => {
      const child = spawn(executable, parameters, { cwd: root, env: { ...process.env, NODE_USE_ENV_PROXY: '1', SMOKE_ARTIFACT_DIR: path.join(work, logName + '-browser') }, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', b => chunks.push(b)); child.stderr.on('data', b => chunks.push(b));
      child.once('error', reject); child.once('close', code => resolve(code));
    });
    const output = Buffer.concat(chunks).toString();
    await saveJson(path.join(work, logName + '.json'), { executable, parameters, exitCode: result, durationMs: Math.round(performance.now() - started), outputBytes: Buffer.byteLength(output), output });
    state.toolOutputBytes = (state.toolOutputBytes || 0) + Buffer.byteLength(output);
    if (result !== 0) throw new Error(`${logName} failed (${result}). Read ${path.join(work, logName + '.json')}; do not repeat unrelated checks.`);
    return output;
  }
  const node = (script, ...parameters) => [process.execPath, ['--use-env-proxy', script, ...parameters]];
  async function phase(name, inputs, outputs, operation, maxAgeMs = Infinity) {
    const inputHash = await fingerprint(root, [...tools, ...inputs]), outputHash = await fingerprint(root, outputs);
    if (!has('--refresh') && phaseFresh(state.phases[name], inputHash, outputHash, Date.now(), maxAgeMs)) { console.log(`${name}: reused successful checkpoint`); return; }
    const startedAt = new Date().toISOString(), started = performance.now();
    state.phases[name] = { status: 'running', startedAt }; await saveJson(stateFile, state);
    try {
      await operation();
      state.phases[name] = { status: 'passed', startedAt, completedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started),
        inputHash: await fingerprint(root, [...tools, ...inputs]), outputHash: await fingerprint(root, outputs) };
      console.log(`${name}: passed (${state.phases[name].durationMs} ms)`);
    } catch (error) {
      state.phases[name] = { status: 'failed', startedAt, completedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started), error: error.message }; throw error;
    } finally { await saveJson(stateFile, state); }
  }
  const contextFiles = ['data/editions.json', 'data/upcoming-events.json', 'poi/data/editorial-pois.json', 'resources.html'];
  async function startup() {
    await phase('preflight', ['data/editions.json'], ['.daily-work/preflight.json'], async () => {
      await run(...node('scripts/preflight.mjs'), 'preflight');
    }, 30 * 60000);
  }
  async function brief() { await run(...node('scripts/prepare_daily_brief.mjs'), 'brief'); }
  async function validate() {
    await startup();
    const assets = [...contextFiles, 'data/daily-brief.json', 'data/direct-candidates.json', 'data/reading-brief.json', 'data/image-library.json', 'README.md', 'NEWS_CONTEXT.md', 'DAILY_NEWS_PROMPT.md', 'NEWSPAPER_MAINTENANCE_PROMPT.md', 'index.html', 'about.html', 'secondary.css', 'upcoming-events.html', 'upcoming-events.js', 'upcoming-events.css', ...await treeFiles('docs'), ...await treeFiles('.github/workflows'), ...await treeFiles('poi'), ...await treeFiles('tests')];
    await phase('validation', assets, [], async () => {
      await brief();
      await phase('node-tests', assets, [], () => run('npm', ['test'], 'node-tests'));
      await phase('collector-tests', ['scripts/collect_candidates.py', 'tests/collector_test.py'], [], () => run('npm', ['run', 'test:collector'], 'collector-tests'));
      await phase('python-compile', ['scripts/collect_candidates.py'], [], () => run('python', ['-m', 'py_compile', 'scripts/collect_candidates.py'], 'python-compile'));
      await phase('diff-check', assets, [], () => run('git', ['diff', '--check'], 'diff-check'));
      const ready = await readJson(path.join(root, '.daily-work/preflight.json'));
      // Use the actual archive date for maintenance; daily publish separately requires today's date.
      const edition = await readJson(path.join(root, 'data/editions.json'));
      await phase('live-browser', assets, [], () => run(...node('scripts/browser_smoke.mjs', '--live', '--network-mode', ready.networkMode, '--expected-date', edition.issues.today.stories[0].id.slice(0, 10)), 'live-browser'), 30 * 60000);
    }, 30 * 60000);
  }
  try {
    if (has('--usage')) {
      const usage = await readJson(path.resolve(root, option('--usage')));
      if (!usage || !['inputTokens', 'outputTokens'].every(k => Number.isInteger(usage[k]) && usage[k] >= 0)) throw new Error('Usage JSON requires nonnegative integer inputTokens/outputTokens from actual telemetry');
      state.modelUsage = { ...usage, origin: 'Provided Codex/API telemetry; not inferred from payload bytes' };
    }
    if (command === 'prepare' || command === 'maintain') {
      await startup();
      await phase('discovery', [...contextFiles], ['data/rss_candidates.json', 'data/direct-candidates.json'], async () => {
        let failures = [];
        try { await run('python', ['scripts/collect_candidates.py'], 'rss-collection'); } catch (e) { failures.push(e.message); }
        try { await run(...node('scripts/collect_sources.mjs', ...(has('--refresh') ? ['--refresh'] : [])), 'direct-collection'); } catch (e) { failures.push(e.message); }
        state.discoveryFailures = failures;
        if (failures.length) console.log('Discovery has gaps; use live fallback research. Details are in state.json.');
      }, 2 * 3600000);
      await phase('brief', [...contextFiles, 'data/rss_candidates.json', 'data/direct-candidates.json'], ['data/daily-brief.json', 'data/reading-brief.json'], brief);
      if (command === 'maintain') {
        await phase(has('--write') ? 'housekeeping-write' : 'housekeeping-dry-run', ['data/upcoming-events.json'], ['data/upcoming-events.json'], async () => {
          await run(...node('scripts/calendar_housekeeping.mjs', ...(has('--write') ? ['--write'] : [])), 'calendar-housekeeping');
        });
        if (has('--write')) await brief();
        console.log('Weekly discovery queue prepared. New events/places require editorial verification; only expired calendar entries can be removed mechanically.');
      }
      if (!state.research?.startedAt) state.research = { startedAt: new Date().toISOString(), note: 'Wall-clock editorial span includes idle time; not model compute or token usage.' };
      console.log(`Read data/reading-brief.json; look up selected candidate IDs. State: ${stateFile}`);
    }
    if (command === 'apply') {
      if (!has('--input')) throw new Error('apply requires --input PATH; --write applies after dry-run review.');
      const file = path.resolve(root, option('--input')), input = await readJson(file);
      if (input.date !== day) throw new Error(`Input must use today's London date ${day}`);
      const prepared = path.join(work, 'edition-input.json'); await saveJson(prepared, { ...input, pruneExpired: true });
      const summary = await run(...node('scripts/apply_edition.mjs', prepared, ...(has('--write') ? ['--write'] : [])), 'apply-' + (has('--write') ? 'write' : 'dry-run'));
      console.log(summary);
      if (has('--write')) {
        if (state.research?.startedAt) state.research = { ...state.research, completedAt: new Date().toISOString(), elapsedWallMs: Date.now() - Date.parse(state.research.startedAt) };
        delete state.phases.validation; await brief();
      }
    }
    if (command === 'validate') await validate();
    if (command === 'publish') {
      if (!has('--reviewed')) throw new Error('publish requires --reviewed after factual, image-rights, duplicate and screenshot review.');
      const edition = await readJson(path.join(root, 'data/editions.json'));
      if (edition.issues.today.stories.some(s => !s.id.startsWith(day + '-'))) throw new Error('Publication needs the current London edition.');
      const hosting = JSON.parse(await run('gh', ['api', 'repos/BrianGroth/Brian-s-London-Daily-News/pages'], 'pages-source'));
      if (hosting.build_type !== 'workflow') throw new Error('Activate the validated GitHub Actions Pages pipeline first; see docs/PUBLISHING.md. No publication commit was created.');
      await validate();
      const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).trim();
      if (staged) throw new Error('Existing staged changes must be reviewed separately; runner will not mix them into the publication.');
      await run('git', ['fetch', 'origin', 'main'], 'git-fetch');
      const behind = execFileSync('git', ['rev-list', '--count', 'HEAD..origin/main'], { cwd: root, encoding: 'utf8' }).trim();
      if (behind !== '0') throw new Error('origin/main advanced; reconcile the changes and revalidate before publishing. No force push.');
      const files = has('--paths') ? option('--paths').split(',') : publicationFiles;
      for (const file of files) if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error('Publication paths must stay in the repository');
      await run('git', ['add', '--', ...files], 'git-stage');
      const diff = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).trim();
      if (diff) await run('git', ['commit', '-m', `Publish London edition ${day}`], 'git-commit');
      await run('git', ['push', 'origin', 'HEAD:main'], 'git-push');
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
      if (execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim() !== head) throw new Error('Remote HEAD mismatch');
      if (state.publication?.commit !== head) delete state.phases['public-verification'];
      await phase('public-verification', ['index.html', ...contextFiles, '.git/HEAD'], [], async () => {
        const url = has('--url') ? option('--url') : 'https://briangroth.github.io/Brian-s-London-Daily-News/';
        state.publication = JSON.parse(await run(...node('scripts/verify_public.mjs', '--url', url, '--wait'), 'public-verification'));
      }, 5 * 60000);
      console.log(`Published and verified ${head}`);
    }
  } finally { await saveJson(stateFile, state); await rm(lock, { recursive: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
