import { MUSEUM_DATA_SNAPSHOT_URL } from '../config.js';
import { nearbySnapshotItems } from './snapshot.js';

export function museumDataRecordToPOI(item) {
  const id = String(item.id ?? '').trim();
  const name = String(item.name ?? '').trim();
  if (!id || !name) return null;
  const types = String(item.types ?? '').split(';').map((value) => value.trim()).filter(Boolean);
  const status = Array.isArray(item.status) ? item.status.filter(Boolean) : [];
  const detail = [types.slice(0, 3).join(', '), status.length ? `Status: ${status.join(', ')}` : '']
    .filter(Boolean).join('. ');

  return {
    id: `museumdata:${id}`,
    source: 'museumdata',
    name,
    categories: ['museum'],
    lat: Number(item.lat),
    lon: Number(item.lon),
    inscription: null,
    description: detail ? `${detail}.` : 'A UK museum or collection site listed by the Museum Data Service.',
    imageUrl: null,
    links: item.url ? [{ url: item.url, label: 'Museum Data Service' }] : [],
    meta: { wikidataId: item.wikidataId ?? null, museumStatus: status },
  };
}

export async function fetchMuseumDataPOIs(lat, lon, radius) {
  const items = await nearbySnapshotItems(MUSEUM_DATA_SNAPSHOT_URL, lat, lon, radius);
  return items.map(museumDataRecordToPOI).filter(Boolean);
}
