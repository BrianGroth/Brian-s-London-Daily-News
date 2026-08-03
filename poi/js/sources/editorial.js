import { EDITORIAL_POIS_URL } from '../config.js';
import { CATEGORY_IDS } from '../lib/categories.js';
import { safeHttpsUrl } from '../lib/http.js';
import { nearbySnapshotItems } from './snapshot.js';

const allowedCategories = new Set(CATEGORY_IDS);

export function editorialRecordToPOI(item) {
  const id = String(item.id ?? '').trim();
  const name = String(item.name ?? '').trim();
  const category = allowedCategories.has(item.category) ? item.category : 'historic';
  if (!id || !name) return null;
  const url = safeHttpsUrl(item.url);
  const sourceUrl = safeHttpsUrl(item.sourceUrl);

  return {
    id: `editorial:${id}`,
    source: 'editorial',
    name,
    categories: [category],
    lat: Number(item.lat),
    lon: Number(item.lon),
    inscription: null,
    description: String(item.description ?? '').trim() || null,
    imageUrl: null,
    links: [
      ...(url ? [{ url, label: 'Official place page' }] : []),
      ...(sourceUrl && sourceUrl !== url ? [{ url: sourceUrl, label: 'Discovery source' }] : []),
    ],
    meta: { addedOn: item.addedOn ?? null },
  };
}

export async function fetchEditorialPOIs(lat, lon, radius) {
  const items = await nearbySnapshotItems(EDITORIAL_POIS_URL, lat, lon, radius);
  return items.map(editorialRecordToPOI).filter(Boolean);
}
