import { NHLE_QUERY_URL, CACHE_TILE_DECIMALS } from '../config.js';
import { fetchJSON, safeHttpsUrl } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { tileKey } from '../lib/geo.js';

// Central London runs to hundreds of Grade II listings per square kilometre.
const MAX_FEATURES = 250;

/**
 * The National Heritage List for England — every listed building, scheduled
 * monument and registered park, updated daily under the Open Government
 * Licence. This is the "small to big" layer: individual Carnaby Street
 * addresses as well as the Palace of Westminster.
 *
 * The service accepts and returns WGS84 via inSR/outSR, so no British National
 * Grid conversion is needed despite the source data being EPSG:27700.
 */
function buildUrl(lat, lon, radius) {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    outSR: '4326',
    distance: String(radius),
    units: 'esriSRUnit_Meter',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'Name,Grade,ListEntry,hyperlink',
    returnGeometry: 'true',
    resultRecordCount: String(MAX_FEATURES),
    f: 'json',
  });
  return `${NHLE_QUERY_URL}?${params}`;
}

// Layer 0 is typed esriGeometryMultipoint, so coordinates arrive as
// `geometry.points[[lon, lat]]` rather than the `geometry.x/y` of a point layer.
function coordsOf(geometry) {
  const point = geometry?.points?.[0];
  if (Array.isArray(point) && point.length >= 2) return { lat: point[1], lon: point[0] };
  if (geometry?.y != null && geometry?.x != null) return { lat: geometry.y, lon: geometry.x };
  return null;
}

/** "ROYAL COURTS OF JUSTICE" reads badly next to sentence-case names. */
function tidyName(name) {
  if (!name || name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b(Of|And|The|In|At|On|To)\b/g, (w) => w.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());
}

const GRADE_NOTES = {
  I: 'Grade I — exceptional interest, the top 2.5% of listed buildings.',
  'II*': 'Grade II* — particularly important, more than special interest.',
  II: 'Grade II — of special interest.',
};

export async function fetchListedBuildings(lat, lon, radius) {
  const key = `nhle:${tileKey(lat, lon, CACHE_TILE_DECIMALS)}:${radius}`;

  return withCache(key, async () => {
    const data = await fetchJSON(buildUrl(lat, lon, radius));
    if (data.error) throw new Error(`NHLE error: ${data.error.message ?? 'unknown'}`);

    return (data.features ?? [])
      .map((feature) => {
        const coords = coordsOf(feature.geometry);
        if (!coords) return null;

        const { Name, Grade, ListEntry, hyperlink } = feature.attributes ?? {};
        const url = safeHttpsUrl(hyperlink) ??
          safeHttpsUrl(`https://historicengland.org.uk/listing/the-list/list-entry/${ListEntry}`);

        return {
          id: `nhle:${ListEntry}`,
          source: 'nhle',
          name: tidyName(Name) ?? `Listed building ${ListEntry}`,
          categories: ['listed'],
          lat: coords.lat,
          lon: coords.lon,
          inscription: null,
          description: GRADE_NOTES[Grade] ?? (Grade ? `Grade ${Grade} listed building.` : null),
          imageUrl: null,
          links: url ? [{ url, label: 'Historic England listing' }] : [],
          meta: { grade: Grade ?? null, listEntry: ListEntry ?? null },
        };
      })
      .filter(Boolean);
  });
}
