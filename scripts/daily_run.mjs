// Resumable operations, not an autonomous editor. An agent supplies verified editorial input.
import { spawn, execFileSync } from 'node:child_process';
import { readFile, mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, readJson, saveJson } from './lib/source_access.mjs';
import { londonDate } from './prepare_daily_brief.mjs';
import { quickPaths } from './prepare_quick_brief.mjs';
import { randomUUID } from 'node:crypto';
import { downloadSnapshot } from './lib/discovery_snapshot.mjs';
import { repositoryReadiness, assertPublicationAncestry, evidenceMetrics } from './lib/run_support.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicationFiles = ['data/editions.json', 'index.html', 'data/upcoming-events.json', 'poi/data/editorial-pois.json', 'resources.html', 'data/image-library.json', 'data/rss_candidates.json', 'data/direct-candidates.json', 'data/daily-brief.json', 'data/reading-brief.json'];
export async function fingerprint(directory, files) {
  return digest(JSON.stringify(await Promise.all(files.map(async file => {
    try { return [file, digest(await readFile(path.resolve(directory, file)))]; }
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
  if (!['prepare', 'apply', 'validate', 'publish', 'maintain', 'status', 'mark'].includes(command)) throw new Error('Use prepare, apply, validate, publish, maintain, mark or status. See docs/DAILY_RUN.md.');
  const quick = has('--quick');
  if (quick && command === 'maintain') throw new Error('Weekly catalogue maintenance is outside quick-update scope.');
  const day = londonDate(Date.now()), work = path.join(root, '.daily-work/runs', day, ...(quick ? ['quick'] : [])), stateFile = path.join(work, 'state.json');
  const quickFiles = quickPaths(root, day);
  await mkdir(work, { recursive: true });
  if (command === 'status') { console.log(JSON.stringify(await readJson(stateFile, { day, phases: {} }), null, 2)); return; }
  const lock = path.join(root, '.daily-work/runner.lock');
  await mkdir(lock).catch(e => { if (e.code === 'EEXIST') throw new Error('Another runner owns .daily-work/runner.lock; inspect it before removing a stale lock.'); throw e; });
  try {
    await saveJson(path.join(lock, 'owner.json'), { pid: process.pid, day, command, startedAt: new Date().toISOString() });
    const state = await readJson(stateFile, { schemaVersion: 2, day, profile: quick ? 'quick' : 'full', phases: {}, note: 'Editorial truth and image rights are reviewed by the agent. Successful commands do not establish factual verification.' });
    state.schemaVersion = 2;
    if (!state.runId || command === 'prepare' && (has('--new-run') || state.research?.completedAt)) {
      if (state.runId) await saveJson(path.join(work, 'attempts', state.runId, 'state.json'), state);
      state.runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
      state.runStartedAt = new Date().toISOString();
      state.research = null;
      state.phaseAttempts = [];
      state.measurements = [];
      state.editorialPhases = {};
      state.toolOutputBytes = 0;
      delete state.modelUsage;
      delete state.publication;
    }
    const commandId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    const commandStarted = performance.now(), commandStartedAt = new Date().toISOString();
    const commandWork = path.join(work, 'attempts', state.runId, commandId);
    const tools = ['package.json', 'package-lock.json', ...await treeFiles('scripts')];
    let logSequence = 0;
    async function run(executable, parameters, logName) {
      // npm.cmd cannot be spawned directly on Windows; use npm's current CLI via Node.
      if (executable === 'npm' && process.env.npm_execpath) { parameters = [process.env.npm_execpath, ...parameters]; executable = process.execPath; }
      const started = performance.now(), chunks = [];
      const result = await new Promise((resolve, reject) => {
        const child = spawn(executable, parameters, { cwd: root, env: { ...process.env, NODE_USE_ENV_PROXY: '1', SMOKE_ARTIFACT_DIR: process.env.SMOKE_ARTIFACT_DIR || path.join(commandWork, logName + '-browser') }, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', b => chunks.push(b)); child.stderr.on('data', b => chunks.push(b));
        child.once('error', reject); child.once('close', code => resolve(code));
      });
      const output = Buffer.concat(chunks).toString();
      const logFile = path.join(commandWork, `${String(++logSequence).padStart(3, '0')}-${logName}.json`);
      await saveJson(logFile, { executable, parameters, exitCode: result, durationMs: Math.round(performance.now() - started), outputBytes: Buffer.byteLength(output), output });
      state.lastCommandLog = logFile;
      state.toolOutputBytes = (state.toolOutputBytes || 0) + Buffer.byteLength(output);
      if (result !== 0) throw new Error(`${logName} failed (${result}). Read ${logFile}; do not repeat unrelated checks.`);
      return output;
    }
    const node = (script, ...parameters) => [process.execPath, ['--use-env-proxy', script, ...parameters]];
    async function phase(name, inputs, outputs, operation, maxAgeMs = Infinity) {
      const dependencies = ['scripts/daily_run.mjs', 'scripts/lib/run_support.mjs', ...inputs];
      const inputHash = await fingerprint(root, dependencies), outputHash = await fingerprint(root, outputs);
      if (!has('--refresh') && phaseFresh(state.phases[name], inputHash, outputHash, Date.now(), maxAgeMs)) { console.log(`${name}: reused successful checkpoint`); return; }
      const startedAt = new Date().toISOString(), started = performance.now();
      state.phases[name] = { status: 'running', startedAt }; await saveJson(stateFile, state);
      try {
        await operation();
        state.phases[name] = { status: 'passed', startedAt, completedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started),
          inputHash: await fingerprint(root, dependencies), outputHash: await fingerprint(root, outputs) };
        console.log(`${name}: passed (${state.phases[name].durationMs} ms)`);
      } catch (error) {
        state.phases[name] = { status: 'failed', startedAt, completedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started), error: error.message }; throw error;
      } finally { state.phaseAttempts ||= []; state.phaseAttempts.push({ name, ...state.phases[name], commandId, logFile: state.lastCommandLog }); await saveJson(stateFile, state); }
    }
    const contextFiles = ['data/editions.json', 'data/upcoming-events.json', 'poi/data/editorial-pois.json', 'resources.html'];
    async function startup() {
      await phase('preflight', ['data/editions.json', 'scripts/preflight.mjs', 'scripts/lib/browser_runtime.mjs', 'scripts/lib/browser_network.mjs', 'scripts/lib/source_access.mjs'], ['.daily-work/preflight.json'], async () => {
        await run(...node('scripts/preflight.mjs'), 'preflight');
      }, 30 * 60000);
    }
    async function brief() { await run(...node(quick ? 'scripts/prepare_quick_brief.mjs' : 'scripts/prepare_daily_brief.mjs'), 'brief'); }
    async function quickBrief() {
      await phase('brief', [...contextFiles, quickFiles.rss, quickFiles.direct, 'scripts/prepare_daily_brief.mjs', 'scripts/prepare_quick_brief.mjs', 'scripts/quick_sources.json'], [quickFiles.brief, quickFiles.reading], brief);
    }
    async function gitStartup({ publish = false } = {}) {
      await run('git', ['fetch', 'origin', 'main'], 'git-fetch');
      let status = repositoryReadiness(root, { pendingCommit: state.pendingPublicationCommit });
      if (status.staged) throw new Error('Existing staged work must be reviewed separately before preparation/publication.');
      if (!publish && status.behind && !status.ahead && !status.dirty) {
        const updatedFiles = execFileSync('git', ['diff', '--name-only', 'HEAD..origin/main'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
        await run('git', ['merge', '--ff-only', 'origin/main'], 'git-fast-forward');
        if (updatedFiles.some(file => file.startsWith('scripts/') || ['package.json', 'package-lock.json'].includes(file))) throw new Error('Updated preparation code from main; rerun prepare to load the new runtime policy before research.');
        status = repositoryReadiness(root, { pendingCommit: state.pendingPublicationCommit });
      }
      if (status.behind) throw new Error('Checkout is behind main with local work or divergent commits. Preserve/reconcile it before researching; no files were discarded.');
      if (publish) assertPublicationAncestry(status);
      else if (status.ahead) console.log(`Preparation notice: ${status.ahead} unpublished local commit(s); daily publish will require separate reconciliation.`);
      state.repository = status;
    }
    async function validate() {
      await startup();
      if (quick) await quickBrief();
      const runtimeAssets = ['index.html', 'about.html', 'resources.html', 'secondary.css', 'upcoming-events.html', 'upcoming-events.js', 'upcoming-events.css', 'data/upcoming-events.json', ...await treeFiles('assets'), ...await treeFiles('poi')];
      const browserInputs = [...runtimeAssets, 'data/editions.json', 'scripts/browser_smoke.mjs', 'scripts/lib/browser_runtime.mjs', 'scripts/lib/browser_network.mjs', 'scripts/lib/source_access.mjs', 'package.json', 'package-lock.json'];
      const assets = [...tools, ...contextFiles, 'data/daily-brief.json', 'data/direct-candidates.json', 'data/reading-brief.json', 'data/image-library.json', 'README.md', 'AGENTS.md', 'NEWS_CONTEXT.md', 'DAILY_NEWS_PROMPT.md', 'QUICK_NEWS_PROMPT.md', 'NEWSPAPER_MAINTENANCE_PROMPT.md', ...runtimeAssets, ...await treeFiles('docs'), ...await treeFiles('.github/workflows'), ...await treeFiles('tests')];
      if (quick) assets.push(quickFiles.rss, quickFiles.direct, quickFiles.brief, quickFiles.reading, 'QUICK_NEWS_PROMPT.md');
      await phase('validation', assets, [], async () => {
        if (!quick) await brief();
        await phase('node-tests', assets, [], () => run('npm', ['test'], 'node-tests'));
        await phase('collector-tests', ['scripts/collect_candidates.py', 'tests/collector_test.py'], [], () => run('npm', ['run', 'test:collector'], 'collector-tests'));
        await phase('python-compile', ['scripts/collect_candidates.py'], [], () => run('python', ['-m', 'py_compile', 'scripts/collect_candidates.py'], 'python-compile'));
        await phase('diff-check', assets, [], () => run('git', ['diff', '--check'], 'diff-check'));
        const ready = await readJson(path.join(root, '.daily-work/preflight.json'));
        // Use the actual archive date for maintenance; daily publish separately requires today's date.
        const edition = await readJson(path.join(root, 'data/editions.json'));
        await phase('live-browser', browserInputs, [], () => run(...node('scripts/browser_smoke.mjs', '--live', '--network-mode', ready.networkMode, '--expected-date', edition.issues.today.stories[0].id.slice(0, 10)), 'live-browser'), 30 * 60000);
      }, 30 * 60000);
    }
    let operationError;
    try {
      if (command === 'mark') {
        const name = args[1], action = args[2];
        if (!['research', 'drafting', 'review'].includes(name) || !['start', 'end'].includes(action)) throw new Error('Use mark research|drafting|review start|end.');
        state.editorialPhases ||= {};
        if (action === 'start') {
          if (state.editorialPhases[name]?.startedAt && !state.editorialPhases[name]?.completedAt) throw new Error(`${name} is already running.`);
          state.editorialPhases[name] = { startedAt: new Date().toISOString() };
        } else {
          const current = state.editorialPhases[name];
          if (!current?.startedAt || current.completedAt) throw new Error(`${name} has no open start marker.`);
          Object.assign(current, { completedAt: new Date().toISOString(), elapsedWallMs: Date.now() - Date.parse(current.startedAt) });
        }
        console.log(JSON.stringify({ runId: state.runId, phase: name, ...state.editorialPhases[name], note: 'Explicit wall-clock marker; not model compute or token telemetry.' }));
      }
      if (has('--usage')) {
        const usage = await readJson(path.resolve(root, option('--usage')));
        if (!usage || !['inputTokens', 'outputTokens'].every(k => Number.isInteger(usage[k]) && usage[k] >= 0)) throw new Error('Usage JSON requires nonnegative integer inputTokens/outputTokens from actual telemetry');
        state.modelUsage = { ...usage, origin: 'Provided Codex/API telemetry; not inferred from payload bytes' };
      }
      if (command === 'prepare' || command === 'maintain') {
        await gitStartup();
        await startup();
        await phase('discovery', ['resources.html', 'scripts/collect_candidates.py', 'scripts/collect_sources.mjs', 'scripts/lib/source_adapters.mjs', 'scripts/lib/source_access.mjs', 'scripts/lib/discovery_snapshot.mjs', 'scripts/quick_sources.json'], quick ? [quickFiles.rss, quickFiles.direct] : ['data/rss_candidates.json', 'data/direct-candidates.json'], async () => {
          if (!quick && command === 'prepare' && !has('--refresh')) {
            try { state.discoverySnapshot = await downloadSnapshot(root); }
            catch (error) { state.discoverySnapshot = { imported: false, note: `Snapshot unavailable: ${error.message}; collecting locally.` }; }
            console.log(state.discoverySnapshot.note || `Imported unverified discovery from workflow ${state.discoverySnapshot.runId}.`);
            if (state.discoverySnapshot.imported) { state.discoveryFailures = []; return; }
          }
          let failures = [];
          try { await run('python', ['scripts/collect_candidates.py', ...(quick ? ['--quick', '--output', quickFiles.rss] : [])], 'rss-collection'); } catch (e) { failures.push(e.message); }
          try { await run(...node('scripts/collect_sources.mjs', ...(quick ? ['--quick', '--output', quickFiles.direct] : []), ...(has('--refresh') ? ['--refresh'] : [])), 'direct-collection'); } catch (e) { failures.push(e.message); }
          state.discoveryFailures = failures;
          if (failures.length) console.log(quick ? 'Quick discovery has gaps; use only the remaining usual sources within budget or report a shortfall. Details are in state.json.' : 'Discovery has gaps; use live fallback research. Details are in state.json.');
        }, 2 * 3600000);
        if (quick) await quickBrief();
        else await phase('brief', [...contextFiles, 'data/rss_candidates.json', 'data/direct-candidates.json', 'scripts/prepare_daily_brief.mjs'], ['data/daily-brief.json', 'data/reading-brief.json'], brief);
        if (command === 'maintain') {
          await phase(has('--write') ? 'housekeeping-write' : 'housekeeping-dry-run', ['data/upcoming-events.json'], ['data/upcoming-events.json'], async () => {
            await run(...node('scripts/calendar_housekeeping.mjs', ...(has('--write') ? ['--write'] : [])), 'calendar-housekeeping');
          });
          if (has('--write')) await brief();
          console.log('Weekly discovery queue prepared. New events/places require editorial verification; only expired calendar entries can be removed mechanically.');
        }
        if (!state.research?.startedAt) state.research = { startedAt: new Date().toISOString(), note: 'Wall-clock editorial span includes idle time; not model compute or token usage.' };
        console.log(`Read ${quick ? quickFiles.reading : 'data/reading-brief.json'}; look up selected candidate IDs${quick ? ' with --quick' : ''}. State: ${stateFile}`);
      }
      if (command === 'apply') {
        if (!has('--input')) throw new Error('apply requires --input PATH; --write applies after dry-run review.');
        const file = path.resolve(root, option('--input')), input = await readJson(file);
        if (input.date !== day) throw new Error(`Input must use today's London date ${day}`);
        const prepared = path.join(work, 'edition-input.json'); await saveJson(prepared, { ...input, pruneExpired: true });
        const summary = await run(...node('scripts/apply_edition.mjs', prepared, ...(has('--write') ? ['--write'] : [])), 'apply-' + (has('--write') ? 'write' : 'dry-run'));
        console.log(summary);
        if (has('--write')) {
          if (state.research?.startedAt && !state.research.completedAt) state.research = { ...state.research, completedAt: new Date().toISOString(), elapsedWallMs: Date.now() - Date.parse(state.research.startedAt) };
          delete state.phases.validation;
          if (quick) await quickBrief(); else await brief();
        }
      }
      if (command === 'validate') await validate();
      if (command === 'publish') {
        if (!has('--reviewed')) throw new Error('publish requires --reviewed after factual, image-rights, duplicate and screenshot review.');
        await gitStartup({ publish: true });
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
        assertPublicationAncestry(repositoryReadiness(root, { pendingCommit: state.pendingPublicationCommit }));
        const files = has('--paths') ? option('--paths').split(',') : publicationFiles.filter(file => !quick || !['data/rss_candidates.json', 'data/direct-candidates.json', 'data/daily-brief.json', 'data/reading-brief.json'].includes(file));
        for (const file of files) if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error('Publication paths must stay in the repository');
        await run('git', ['add', '--', ...files], 'git-stage');
        const diff = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).trim();
        if (diff) {
          await run('git', ['commit', '-m', `Publish London edition ${day}`], 'git-commit');
          state.pendingPublicationCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
          await saveJson(stateFile, state);
        }
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
    } catch (error) { operationError = error; throw error; }
    finally {
      try {
        state.measurements ||= [];
        state.measurements.push({ command, commandId, startedAt: commandStartedAt, completedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - commandStarted), logDirectory: commandWork });
        try { state.evidenceMetrics = await evidenceMetrics(path.join(root, '.daily-work/evidence'), state.runStartedAt); }
        catch (error) { state.evidenceMetrics = { error: error.message, note: 'Metrics unavailable; editorial outcome unchanged.' }; }
        await saveJson(stateFile, state);
        await saveJson(path.join(work, 'attempts', state.runId, 'state.json'), state);
      } catch (error) {
        if (!operationError) throw error;
        console.error(`Could not save diagnostics: ${error.message}`);
      }
    }
  } finally { await rm(lock, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
