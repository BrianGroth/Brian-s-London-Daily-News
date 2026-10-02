import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { londonDate } from './prepare_daily_brief.mjs';
import { saveJson } from './lib/source_access.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function pruneCalendar(store, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || new Date(today).toISOString().slice(0, 10) !== today) throw new Error('Invalid London date');
  const removed = [], retained = [];
  for (const event of store.events) {
    const last = event.endDate || event.startDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(last) || !Number.isFinite(Date.parse(last)) || new Date(last).toISOString().slice(0, 10) !== last) throw new Error(`Invalid event date: ${event.id}`);
    (last < today ? removed : retained).push(event);
  }
  return { store: removed.length ? { ...store, updatedAt: today, events: retained } : store, removed };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = path.join(root, 'data/upcoming-events.json'), store = JSON.parse(await readFile(file, 'utf8'));
  const i = process.argv.indexOf('--date'), today = i < 0 ? londonDate(Date.now()) : process.argv[i + 1];
  const result = pruneCalendar(store, today);
  if (process.argv.includes('--write') && result.removed.length) await saveJson(file, result.store);
  console.log(JSON.stringify({ date: today, write: process.argv.includes('--write'), removed: result.removed.map(({ id, title }) => ({ id, title })), retained: result.store.events.length }));
}
