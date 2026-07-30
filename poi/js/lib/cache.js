import { CACHE_TTL_MS } from '../config.js';

const PREFIX = 'nearbypoi:v1:';

/**
 * Tiny localStorage cache keyed by source + location tile. Overpass in
 * particular enforces per-IP quotas, and walking a London street re-enters the
 * same tile constantly, so this is what keeps the app usable on a long walk.
 */
export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { storedAt, value } = JSON.parse(raw);
    if (Date.now() - storedAt > CACHE_TTL_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ storedAt: Date.now(), value }));
  } catch (error) {
    // Quota exceeded: drop our own oldest entries and give up quietly.
    if (error.name === 'QuotaExceededError') evictOldest();
  }
}

function evictOldest() {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      entries.push([key, JSON.parse(localStorage.getItem(key)).storedAt ?? 0]);
    } catch {
      entries.push([key, 0]);
    }
  }
  entries.sort((a, b) => a[1] - b[1]);
  for (const [key] of entries.slice(0, Math.ceil(entries.length / 2))) {
    localStorage.removeItem(key);
  }
}

/** Runs `producer` unless a fresh cached value exists for `key`. */
export async function withCache(key, producer) {
  const hit = readCache(key);
  if (hit !== null) return hit;
  const value = await producer();
  writeCache(key, value);
  return value;
}
