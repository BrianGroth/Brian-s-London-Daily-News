import { OPENPLAQUES_SNAPSHOT_URL } from '../config.js';
import { nearbySnapshotItems } from './snapshot.js';

function titleFromInscription(inscription) {
  const clean = String(inscription ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'London plaque';
  const firstSentence = clean.split(/[.!?]/)[0].trim();
  const title = firstSentence.length >= 12 ? firstSentence : clean;
  return title.length > 72 ? `${title.slice(0, 69).trim()}…` : title;
}

export function openPlaqueToPOI(item) {
  const id = String(item.id ?? '').trim();
  if (!id) return null;
  const inscription = String(item.inscription ?? '').trim() || null;
  return {
    id: `openplaques:${id}`,
    source: 'openplaques',
    name: titleFromInscription(inscription),
    categories: ['plaque'],
    lat: Number(item.lat),
    lon: Number(item.lon),
    inscription,
    description: null,
    imageUrl: null,
    links: [{ url: `https://openplaques.org/plaques/${id}`, label: 'OpenPlaques record' }],
    meta: { openPlaquesId: id },
  };
}

export async function fetchOpenPlaques(lat, lon, radius) {
  const items = await nearbySnapshotItems(OPENPLAQUES_SNAPSHOT_URL, lat, lon, radius);
  return items.map(openPlaqueToPOI).filter(Boolean);
}
