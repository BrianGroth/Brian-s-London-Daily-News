import { WIKIPEDIA_API, IMAGE_WIDTH_PX, CACHE_TILE_DECIMALS } from '../config.js';
import { fetchJSON, safeHttpsUrl } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { tileKey } from '../lib/geo.js';

// TextExtracts caps `exlimit` at 20 for anonymous callers, so the generator is
// held to the same number to keep this a single round trip.
const PAGE_LIMIT = 20;

/**
 * Wikipedia GeoSearch reaches a layer OSM cannot: historical *events* and
 * streets with no mappable object. Standing on Broadwick Street it returns
 * "1854 Broad Street cholera outbreak" at 32 m, which exists in no POI database.
 *
 * `colimit` matters — it defaults to 10, which silently returns half the pages
 * without coordinates and makes them undistanceable.
 */
function buildUrl(lat, lon, radius) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${lat}|${lon}`,
    ggsradius: String(Math.min(Math.max(radius, 10), 10000)),
    ggslimit: String(PAGE_LIMIT),
    prop: 'coordinates|pageimages|extracts|info',
    colimit: '50',
    exintro: '1',
    explaintext: '1',
    exlimit: String(PAGE_LIMIT),
    piprop: 'thumbnail',
    pithumbsize: String(IMAGE_WIDTH_PX),
    inprop: 'url',
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  return `${WIKIPEDIA_API}?${params}`;
}

function firstSentences(text, count = 2) {
  if (!text) return null;
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g);
  if (!parts) return text.slice(0, 220);
  return parts.slice(0, count).join(' ').trim();
}

export async function fetchWikipediaPOIs(lat, lon, radius) {
  const key = `wikipedia:${tileKey(lat, lon, CACHE_TILE_DECIMALS)}:${radius}`;

  return withCache(key, async () => {
    const data = await fetchJSON(buildUrl(lat, lon, radius));
    const pages = data?.query?.pages ?? [];

    return pages
      .filter((page) => page.coordinates?.length)
      .map((page) => ({
        id: `wikipedia:${page.pageid}`,
        source: 'wikipedia',
        name: page.title,
        categories: ['article'],
        lat: page.coordinates[0].lat,
        lon: page.coordinates[0].lon,
        inscription: null,
        description: firstSentences(page.extract),
        imageUrl: safeHttpsUrl(page.thumbnail?.source),
        links: [{ url: safeHttpsUrl(page.fullurl), label: 'Wikipedia' }].filter((l) => l.url),
        meta: {},
      }));
  });
}
