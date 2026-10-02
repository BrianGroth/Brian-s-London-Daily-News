// Public, credential-free evidence access. Cache is research material, never verification by itself.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const digest = value => createHash('sha256').update(value).digest('hex');
export function publicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' ||
      /^(localhost|.*\.(localhost|local|internal)|0\..*|127\..*|10\..*|192\.168\..*|169\.254\..*|172\.(1[6-9]|2\d|3[01])\..*|\[.*\])$/i.test(url.hostname)) {
    throw new Error('Evidence requires a public HTTPS URL without credentials.');
  }
  return url;
}
export async function readJson(file, fallback = null) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
export async function saveJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n');
}
export async function boundedBody(response, limit = 12_000_000) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > limit) { throw new Error(`Response exceeds ${limit} bytes`); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
// No browser cookies, authorization headers or private account requests are forwarded.
export async function publicFetch(value, { fetcher = fetch, timeoutMs = 20000, headers = {}, method = 'GET', body } = {}) {
  let url = publicUrl(value);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetcher(url, { method, body, redirect: 'manual', credentials: 'omit',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrianLondonDailyNews/2.0)', ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      url = publicUrl(new URL(response.headers.get('location'), url));
      continue;
    }
    return { response, url: url.href };
  }
  throw new Error('Too many source redirects');
}
export class EvidenceClient {
  constructor({ cacheDir = '.daily-work/evidence', fetcher = fetch, now = () => Date.now() } = {}) {
    this.cacheDir = cacheDir; this.fetcher = fetcher; this.now = now;
    this.metrics = { requests: 0, cacheHits: 0, failures: 0, bytes: 0 };
    this.pending = new Map();
  }
  async get(value, { refresh = false, maxAgeMs = 2 * 3600000, failureCooldownMs = 15 * 60000, attempts = 2, timeoutMs = 20000 } = {}) {
    const url = publicUrl(value).href;
    if (this.pending.has(url)) return this.pending.get(url);
    const promise = this.load(url, { refresh, maxAgeMs, failureCooldownMs, attempts: Math.min(2, Math.max(1, attempts)), timeoutMs });
    this.pending.set(url, promise);
    try { return await promise; } finally { this.pending.delete(url); }
  }
  async load(url, options) {
    const key = digest(url), metadataFile = path.join(this.cacheDir, `${key}.json`), bodyFile = path.join(this.cacheDir, `${key}.body`);
    const prior = await readJson(metadataFile);
    const age = prior ? this.now() - Date.parse(prior.checkedAt) : Infinity;
    if (prior && age >= 0 && !options.refresh && (prior.ok ? age < options.maxAgeMs : age < options.failureCooldownMs)) {
      this.metrics.cacheHits++;
      return { ...prior, cacheState: prior.ok ? 'cached-needs-reverification' : 'failure-cooldown', body: prior.ok ? await readFile(bodyFile, 'utf8') : '' };
    }
    const started = performance.now(); let result, body = '';
    for (let attempt = 1; attempt <= options.attempts; attempt++) {
      try {
        this.metrics.requests++;
        const headers = {};
        if (prior?.etag) headers['If-None-Match'] = prior.etag;
        if (prior?.lastModified) headers['If-Modified-Since'] = prior.lastModified;
        const { response, url: finalUrl } = await publicFetch(url, { fetcher: this.fetcher, headers, timeoutMs: options.timeoutMs });
        if (response.status === 304 && prior?.ok) {
          body = await readFile(bodyFile, 'utf8');
          result = { ...prior, ok: true, status: 304, finalUrl, cacheState: 'revalidated', attempts: attempt };
          break;
        }
        if (!response.ok) {
          await response.body?.cancel();
          result = { ok: false, status: response.status, finalUrl, error: `HTTP ${response.status}`, attempts: attempt };
          // Permanent access failures and rate limits are diagnosed once, not retried in a loop.
          if (![502, 503, 504].includes(response.status)) break;
        } else {
          const bytes = await boundedBody(response); this.metrics.bytes += bytes.length;
          body = bytes.toString('utf8');
          result = { ok: true, status: response.status, finalUrl, contentType: response.headers.get('content-type'),
            etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified'), sha256: digest(bytes), bytes: bytes.length, attempts: attempt, cacheState: 'fetched' };
          break;
        }
      } catch (error) {
        result = { ok: false, error: error.cause?.code || error.message, attempts: attempt };
        if (/CERT|TLS|DENIED|403/i.test(result.error)) break;
      }
    }
    if (!result.ok) this.metrics.failures++;
    result = { ...result, url, checkedAt: new Date(this.now()).toISOString(), elapsedMs: Math.round(performance.now() - started), bodyFile, needsEditorialVerification: true };
    if (result.ok) { await mkdir(this.cacheDir, { recursive: true }); await writeFile(bodyFile, body); }
    await saveJson(metadataFile, result);
    return { ...result, body };
  }
}
export async function mapLimit(items, limit, operation) {
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) { const index = next++; if (index >= items.length) break; results[index] = await operation(items[index], index); }
  }));
  return results;
}
