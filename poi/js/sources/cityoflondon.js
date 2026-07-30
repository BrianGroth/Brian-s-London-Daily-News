import {
  CITY_OF_LONDON_MAPSERVER,
  CITY_OF_LONDON_HERITAGE_MAPSERVER,
  CITY_OF_LONDON_POSTCARD_MAPSERVER,
  CACHE_TILE_DECIMALS,
} from '../config.js';
import { fetchJSON } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { tileKey } from '../lib/geo.js';

const MAX_FEATURES = 250;
const INTERACTIVE_MAP_URL =
  'https://www.cityoflondon.gov.uk/footer/interactive-map-layers';
const POSTCARD_PROJECT_URL =
  'https://www.cityoflondon.gov.uk/things-to-do/green-spaces/hampstead-heath/' +
  'activities-at-hampstead-heath/historic-postcard-project';
const CITY_PLAQUES_URL =
  'https://www.cityoflondon.gov.uk/services/planning/historic-environment/' +
  'city-of-london-blue-plaques';

// These layers are unusually useful for Brian's two London bases. Layers 4–8
// cover the Square Mile's own heritage assets near EC2N; layer 25 is the
// Corporation's geolocated historic-postcard collection for Hampstead Heath.
// Focused COMPASS services are tried first; INSPIRE is a live fallback for
// every layer it duplicates.
const LAYERS = [
  { key: 'building', kind: 'heritage', endpoints: [`${CITY_OF_LONDON_HERITAGE_MAPSERVER}/0`, `${CITY_OF_LONDON_MAPSERVER}/4`] },
  { key: 'bridge', kind: 'heritage', endpoints: [`${CITY_OF_LONDON_HERITAGE_MAPSERVER}/1`, `${CITY_OF_LONDON_MAPSERVER}/5`] },
  { key: 'landscape', kind: 'heritage', endpoints: [`${CITY_OF_LONDON_HERITAGE_MAPSERVER}/2`, `${CITY_OF_LONDON_MAPSERVER}/6`] },
  { key: 'monument', kind: 'heritage', endpoints: [`${CITY_OF_LONDON_HERITAGE_MAPSERVER}/4`, `${CITY_OF_LONDON_MAPSERVER}/7`] },
  { key: 'statuary', kind: 'heritage', endpoints: [`${CITY_OF_LONDON_HERITAGE_MAPSERVER}/5`, `${CITY_OF_LONDON_MAPSERVER}/8`] },
  { key: 'plaque', kind: 'plaque', endpoints: [`${CITY_OF_LONDON_HERITAGE_MAPSERVER}/7`] },
  { key: 'postcard', kind: 'postcard', endpoints: [`${CITY_OF_LONDON_POSTCARD_MAPSERVER}/0`, `${CITY_OF_LONDON_MAPSERVER}/25`] },
];

function buildUrl(endpoint, lat, lon, radius) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    outSR: '4326',
    distance: String(radius),
    units: 'esriSRUnit_Meter',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    resultRecordCount: String(MAX_FEATURES),
    f: 'json',
  });
  return `${endpoint}/query?${params}`;
}

function descriptionFor(attributes, kind) {
  if (kind === 'postcard') {
    const detail = attributes.DESCRIPTION ?? attributes.IMAGE_NAME;
    const date = attributes.IMAGE_DATE && attributes.IMAGE_DATE !== 'Unknown'
      ? `Historic image dated ${attributes.IMAGE_DATE}.`
      : 'A geolocated view from the Hampstead Heath historic postcard collection.';
    return detail ? `${detail}. ${date}` : date;
  }
  return attributes.BRIEF_ASSET_DESCRIPTION ?? attributes.BRIEF_DESCRIPTION ?? null;
}

function nameFor(attributes, kind) {
  if (kind === 'postcard') {
    return attributes.TEXT_ON_POSTCARD ??
      attributes.IMAGE_NAME ??
      attributes.DESCRIPTION ??
      'Historic Hampstead Heath view';
  }
  if (kind === 'plaque') {
    return attributes.SUBJECT ?? attributes.NAME ?? 'City of London blue plaque';
  }
  return attributes.NAME ?? 'City of London heritage place';
}

/** Exported for focused normalization tests. */
export function cityFeatureToPOI(feature, layer) {
  const { x: lon, y: lat } = feature.geometry ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const attributes = feature.attributes ?? {};
  const objectId = attributes.OBJECTID ?? attributes.OID ?? attributes.POSTCARD_NUMBER;
  const isPostcard = layer.kind === 'postcard';
  const isPlaque = layer.kind === 'plaque';

  return {
    id: `citylondon:${layer.key ?? layer.id}/${objectId ?? `${lat},${lon}`}`,
    source: 'citylondon',
    name: nameFor(attributes, layer.kind),
    categories: [isPostcard ? 'postcard' : (isPlaque ? 'plaque' : 'historic')],
    lat,
    lon,
    inscription: null,
    description: isPlaque
      ? (attributes.INSCRIPTION ?? attributes.DESCRIPTION ?? attributes.LOCATION ?? null)
      : descriptionFor(attributes, layer.kind),
    imageUrl: null,
    links: [{
      url: isPostcard ? POSTCARD_PROJECT_URL : (isPlaque ? CITY_PLAQUES_URL : INTERACTIVE_MAP_URL),
      label: isPostcard
        ? 'Historic Postcard Project'
        : (isPlaque ? 'City of London Blue Plaques' : 'City of London map'),
    }],
    meta: {
      listedStatus: attributes.LISTED_STATUS ?? null,
      assetType: attributes.STRUCTURE_TYPE_CATEGORY ?? null,
      imageSource: attributes.SOURCE ?? null,
      scheme: isPlaque ? 'City of London Blue Plaque' : null,
    },
  };
}

async function fetchLayer(layer, lat, lon, radius) {
  let lastError;
  for (const endpoint of layer.endpoints) {
    try {
      const data = await fetchJSON(buildUrl(endpoint, lat, lon, radius));
      if (data.error || data.status === 'error') {
        const message = data.error?.message ?? data.messages?.[0] ?? `${layer.key} layer failed`;
        throw new Error(message);
      }
      return (data.features ?? [])
        .map((feature) => cityFeatureToPOI(feature, layer))
        .filter(Boolean);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`${layer.key} layer unavailable`);
}

export async function fetchCityOfLondonPOIs(lat, lon, radius) {
  const key = `citylondon:${tileKey(lat, lon, CACHE_TILE_DECIMALS)}:${radius}`;

  return withCache(key, async () => {
    const results = await Promise.allSettled(
      LAYERS.map((layer) => fetchLayer(layer, lat, lon, radius))
    );
    const successful = results.filter((result) => result.status === 'fulfilled');
    if (successful.length === 0) {
      const reason = results.find((result) => result.status === 'rejected')?.reason;
      throw reason ?? new Error('City of London heritage service unavailable');
    }
    return successful.flatMap((result) => result.value);
  });
}
