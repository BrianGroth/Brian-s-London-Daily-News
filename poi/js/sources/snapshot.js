import { fetchJSON } from '../lib/http.js';
import { distanceMeters } from '../lib/geo.js';

const promises = new Map();

export async function nearbySnapshotItems(url, lat, lon, radius) {
  if (!promises.has(url)) promises.set(url, fetchJSON(url));
  const snapshot = await promises.get(url);
  if (!Array.isArray(snapshot.items)) throw new Error(`Invalid POI snapshot: ${url}`);

  return snapshot.items.filter((item) => {
    const itemLat = Number(item.lat);
    const itemLon = Number(item.lon);
    return Number.isFinite(itemLat) && Number.isFinite(itemLon)
      && distanceMeters(lat, lon, itemLat, itemLon) <= radius;
  });
}
