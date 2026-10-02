import { chromium } from 'playwright';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Reuse the exact pinned browser in a sibling workspace cache; no speculative downloads.
export async function launchBrowser(options = {}) {
  if (options.channel || options.executablePath) return chromium.launch(options);
  const expected = chromium.executablePath();
  const parts = expected.split(path.sep), at = parts.findIndex(part => /^chromium(?:_headless_shell)?-\d+$/.test(part));
  if (at >= 0) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    for (const cache of [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(path.dirname(root), '.playwright-browsers'), path.join(root, '.playwright-browsers')].filter(Boolean)) {
      const file = path.join(cache, ...parts.slice(at));
      try { await access(file); return await chromium.launch({ ...options, executablePath: file }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return chromium.launch(options);
}
