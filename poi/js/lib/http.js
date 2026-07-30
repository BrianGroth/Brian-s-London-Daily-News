import { REQUEST_TIMEOUT_MS } from '../config.js';

/**
 * fetch + timeout + JSON parse, with an error message that survives contact
 * with the public Overpass instance (which answers 429s in HTML, not JSON).
 */
export async function fetchJSON(url, options = {}) {
  const { timeout = REQUEST_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeout / 1000)}s`);
    }
    throw new Error(`Network request failed: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  const body = await response.text();

  if (!response.ok) {
    const detail = response.status === 429
      ? 'rate limited — the public API is busy'
      : body.slice(0, 120).replace(/\s+/g, ' ').trim();
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Expected JSON but got ${body.slice(0, 80).trim() || 'an empty body'}`);
  }
}

/** Tries each URL in turn, returning the first success. */
export async function fetchJSONWithFallback(urls, options) {
  let lastError;
  for (const url of urls) {
    try {
      return await fetchJSON(url, options);
    } catch (error) {
      lastError = error;
      console.warn(`Endpoint failed (${url}): ${error.message}`);
    }
  }
  throw lastError;
}

/**
 * Third-party data ends up in href/src attributes, so anything that is not a
 * plain https URL is dropped rather than assigned.
 */
export function safeHttpsUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
