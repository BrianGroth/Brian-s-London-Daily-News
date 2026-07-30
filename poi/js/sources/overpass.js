import { OVERPASS_ENDPOINTS, OVERPASS_TIMEOUT_MS, CACHE_TILE_DECIMALS } from '../config.js';
import { fetchJSONWithFallback, safeHttpsUrl } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { tileKey } from '../lib/geo.js';
import { categoriseOsmTags } from '../lib/categories.js';

/**
 * Note the two clauses without a ["name"] filter. Commemorative plaques are
 * usually named, but a minority carry only an `inscription` tag — around 12 of
 * 517 records in a 1 km sample of Soho — and those are exactly the obscure ones
 * worth surfacing. Everything else keeps the name requirement to avoid dragging
 * in unnamed hotel and picnic-site nodes.
 *
 * There is deliberately no element limit on `out`: capping the server response
 * truncates in Overpass's internal order, not by distance, so the app would
 * sort an arbitrary sample and miss the nearest places entirely. The full
 * central-London response is ~280 KB, which is cached per tile.
 */
function buildQuery(lat, lon, radius) {
  const at = `(around:${radius},${lat},${lon})`;
  return `[out:json][timeout:30];
(
  nwr["historic"]${at};
  nwr["memorial"]${at};
  nwr["name"]["tourism"~"^(attraction|museum|artwork|gallery|viewpoint|theme_park|zoo|aquarium)$"]${at};
  nwr["name"]["leisure"~"^(park|garden|nature_reserve)$"]${at};
  nwr["name"]["amenity"~"^(place_of_worship|theatre|arts_centre|fountain)$"]${at};
  nwr["name"]["man_made"~"^(lighthouse|watermill|windmill|obelisk|tower)$"]${at};
);
out center;`;
}

function coordsOf(element) {
  if (element.lat != null && element.lon != null) {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) return { lat: element.center.lat, lon: element.center.lon };
  return null;
}

/** Trims the trailing dates/attribution that make plaque titles repetitive. */
function plaqueTitle(tags) {
  if (tags.name) return tags.name;
  const words = tags.inscription.split(/\s+/).slice(0, 8).join(' ');
  return words.length < tags.inscription.length ? `${words}…` : words;
}

/** Exported for tests: maps one raw Overpass element onto the app's POI shape. */
export function osmElementToPOI(element) {
  const tags = element.tags ?? {};
  if (!tags.name && !tags.inscription) return null;

  const coords = coordsOf(element);
  if (!coords) return null;

  const category = categoriseOsmTags(tags);
  const openPlaquesUrl = tags['openplaques:id']
    ? safeHttpsUrl(`https://openplaques.org/plaques/${tags['openplaques:id']}`)
    : null;

  return {
    id: `osm:${element.type}/${element.id}`,
    source: 'osm',
    name: plaqueTitle(tags),
    categories: [category],
    lat: coords.lat,
    lon: coords.lon,
    // The inscription is the whole point for a plaque: it says who lived here
    // and when, needs no second network call, and beats any generic blurb.
    inscription: tags.inscription ?? null,
    description: tags.description ?? null,
    imageUrl: null,
    links: openPlaquesUrl ? [{ url: openPlaquesUrl, label: 'OpenPlaques details' }] : [],
    meta: {
      // `wikidata` is the plaque/building itself; `subject:wikidata` is the
      // person it commemorates. Most London plaques have only the latter, and
      // the old code's `wikidata`-only filter is why they never appeared.
      wikidataId: tags.wikidata ?? null,
      subjectWikidataId: tags['subject:wikidata'] ?? null,
      erectedBy: tags.erected_by ?? null,
      scheme: tags.scheme ?? (tags.memorial === 'blue_plaque' ? 'Blue plaque' : null),
      openPlaquesId: tags['openplaques:id'] ?? null,
      wikipediaTitle: tags.wikipedia ?? null,
    },
  };
}

export async function fetchOverpassPOIs(lat, lon, radius) {
  const key = `overpass:${tileKey(lat, lon, CACHE_TILE_DECIMALS)}:${radius}`;

  return withCache(key, async () => {
    const data = await fetchJSONWithFallback(OVERPASS_ENDPOINTS, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(buildQuery(lat, lon, radius)),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: OVERPASS_TIMEOUT_MS,
    });

    return (data.elements ?? []).map(osmElementToPOI).filter(Boolean);
  });
}
