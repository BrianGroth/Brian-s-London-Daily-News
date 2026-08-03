import { CACHE_TILE_DECIMALS, GLA_CULTURAL_INFRASTRUCTURE_MAPSERVER } from '../config.js';
import { withCache } from '../lib/cache.js';
import { tileKey } from '../lib/geo.js';
import { fetchJSON, safeHttpsUrl } from '../lib/http.js';

const MAX_FEATURES = 150;
const DATASET_URL = 'https://data.london.gov.uk/dataset/cultural-infrastructure-map-2023';
const LAYERS = [
  { id: 2, label: 'Arts centre', category: 'culture' },
  { id: 14, label: 'Legal street-art wall', category: 'culture' },
  { id: 21, label: 'Museum or public gallery', category: 'museum' },
  { id: 25, label: 'Music venue', category: 'culture' },
  { id: 27, label: 'Outdoor cultural space', category: 'culture' },
  { id: 32, label: 'Skate park', category: 'green' },
  { id: 35, label: 'Theatre', category: 'culture' },
];

function buildUrl(layerId, lat, lon, radius) {
  const params = new URLSearchParams({
    where: '1=1', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint',
    inSR: '4326', outSR: '4326', distance: String(radius), units: 'esriSRUnit_Meter',
    spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'true',
    resultRecordCount: String(MAX_FEATURES), f: 'json',
  });
  return `${GLA_CULTURAL_INFRASTRUCTURE_MAPSERVER}/${layerId}/query?${params}`;
}

export function glaFeatureToPOI(feature, layer) {
  const attributes = feature.attributes ?? {};
  const lat = Number(feature.geometry?.y ?? attributes.latitude);
  const lon = Number(feature.geometry?.x ?? attributes.longitude);
  const name = String(attributes.name ?? attributes.NAME ?? '').trim();
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const objectId = attributes.objectid ?? attributes.OBJECTID ?? attributes.uniqueid ?? `${lat},${lon}`;
  const website = safeHttpsUrl(attributes.website ?? attributes.WEBSITE);
  const address = [attributes.address1, attributes.address2, attributes.postcode].filter(Boolean).join(', ');
  return {
    id: `gla-culture:${layer.id}/${objectId}`,
    source: 'gla-culture',
    name,
    categories: [layer.category],
    lat, lon,
    inscription: null,
    description: `${layer.label} in the GLA Cultural Infrastructure Map${address ? ` — ${address}` : ''}.`,
    imageUrl: null,
    links: [
      ...(website ? [{ url: website, label: 'Venue website' }] : []),
      { url: DATASET_URL, label: 'GLA dataset' },
    ],
    meta: { borough: attributes.borough_name ?? null, venueType: layer.label },
  };
}

async function fetchLayer(layer, lat, lon, radius) {
  const data = await fetchJSON(buildUrl(layer.id, lat, lon, radius));
  if (data.error) throw new Error(data.error.message ?? `${layer.label} layer failed`);
  return (data.features ?? []).map((feature) => glaFeatureToPOI(feature, layer)).filter(Boolean);
}

export async function fetchGLACulturalPOIs(lat, lon, radius) {
  const key = `gla-culture:${tileKey(lat, lon, CACHE_TILE_DECIMALS)}:${radius}`;
  return withCache(key, async () => {
    const results = await Promise.allSettled(LAYERS.map((layer) => fetchLayer(layer, lat, lon, radius)));
    const successful = results.filter((result) => result.status === 'fulfilled');
    if (!successful.length) throw results[0]?.reason ?? new Error('GLA cultural data unavailable');
    return successful.flatMap((result) => result.value);
  });
}
