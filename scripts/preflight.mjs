import { launchBrowser } from './lib/browser_runtime.mjs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { installBrowserNetwork } from './lib/browser_network.mjs';
import { publicFetch, boundedBody, mapLimit, saveJson } from './lib/source_access.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function preflight({ output = path.join(root, '.daily-work/preflight.json'), forcedMode } = {}) {
  const started = performance.now();
  const policy = JSON.parse(await readFile('/etc/codex/network-policy.json', 'utf8').catch(() => 'null'));
  const editions = JSON.parse(await readFile(path.join(root, 'data/editions.json')));
  const photo = editions.images[editions.issues.today.stories[0].imageKey].src;
  const checks = await mapLimit([
    ['transport', 'https://api.tfl.gov.uk/Line/northern/Status'],
    ['activities', 'https://www.heath-hands.org.uk/whatson?format=json'],
    ['image', photo],
  ], 3, async ([name, url]) => {
    try { const { response } = await publicFetch(url, { timeoutMs: 10000 }); await boundedBody(response);
      return { name, host: new URL(url).hostname, ok: response.ok, status: response.status };
    } catch (error) { return { name, host: new URL(url).hostname, ok: false, error: error.cause?.code || error.message }; }
  });
  let browser, networkMode = forcedMode || 'direct', browserCheck;
  try {
    browser = await launchBrowser();
    async function probe(mode) {
      const context = await browser.newContext(); await installBrowserNetwork(context, { mode });
      const page = await context.newPage();
      try {
        const response = await page.goto(photo, { timeout: 15000, waitUntil: 'load' });
        return { ok: Boolean(response?.ok()), connectionOk: Boolean(response), status: response?.status(), mode, ...(response?.ok() ? {} : { error: `Image HTTP ${response?.status()}` }) };
      } catch (error) { return { ok: false, mode, error: error.message.split('\n')[0] }; }
      finally { await context.close(); }
    }
    browserCheck = await probe(networkMode);
    // Retry once only for the known browser/environment CA mismatch, with TLS still verified in Node.
    if (!forcedMode && !browserCheck.ok && /CERT_AUTHORITY_INVALID/.test(browserCheck.error) && Boolean(checks.find(c => c.name === 'image').status)) {
      networkMode = 'proxy-bridge'; browserCheck = await probe(networkMode);
    }
  } catch (error) { browserCheck = { ok: false, error: error.message.split('\n')[0], hint: 'Install the pinned Playwright browser once: npx playwright install chromium' }; }
  finally { await browser?.close(); }
  const result = { schemaVersion: 1, checkedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started),
    nodeMajor: Number(process.versions.node.split('.')[0]), proxyConfigured: Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY),
    policyMode: policy?.http_network_policy?.type || 'not-provided', networkMode,
    checks, browser: browserCheck, ready: Number(process.versions.node.split('.')[0]) >= 24 && (browserCheck.ok || browserCheck.connectionOk) && checks.some(c => c.ok),
    warnings: checks.filter(c => !c.ok).map(c => `${c.name}: ${c.error || c.status}; use a live fallback`),
    note: 'Readiness only. Source-specific failures still require a fallback; selected weather, transit, events and news must be verified live.' };
  await saveJson(output, result); return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const i = process.argv.indexOf('--output'), result = await preflight({ output: i < 0 ? undefined : process.argv[i + 1] });
  console.log(JSON.stringify(result)); if (!result.ready) process.exitCode = 1;
}
