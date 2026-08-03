// Tunable constants for the whole app. Kept in one place so the PRD can point at it.

export const SEARCH_RADIUS_METERS = 800;

// How many tiles to render initially, and how many more each "Show more" adds.
export const PAGE_SIZE = 24;

// Re-query the sources once the user has walked this far from the last fetch point.
export const REFETCH_DISTANCE_METERS = 150;

// Ignore GPS fixes vaguer than this; London plaques are house-specific.
export const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

/**
 * Tried in order. All three are planet-wide; regional extracts are deliberately
 * excluded, because a Switzerland-only mirror answers a London query with
 * HTTP 200 and zero elements, which would silently look like "nothing nearby"
 * rather than like a failure. (overpass.osm.ch was rejected for exactly this:
 * 23 memorials in Zurich, 0 in Soho.)
 *
 * private.coffee is last because it is reliably slow — measured at 60 s for a
 * query the main instance answers in 1 s — so it is a genuine last resort.
 */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Per-endpoint, not for the whole chain. Kept tight so failing over to the next
// mirror is quick; the app renders other sources meanwhile regardless.
export const OVERPASS_TIMEOUT_MS = 18000;

export const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
export const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
export const NHLE_QUERY_URL =
  'https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/' +
  'National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer/0/query';
export const CITY_OF_LONDON_MAPSERVER =
  'https://www.mapping.cityoflondon.gov.uk/arcgis/rest/services/INSPIRE/MapServer';
export const CITY_OF_LONDON_HERITAGE_MAPSERVER =
  'https://www.mapping.cityoflondon.gov.uk/arcgis/rest/services/' +
  'COMPASS_Heritage_Estate/MapServer';
export const CITY_OF_LONDON_POSTCARD_MAPSERVER =
  'https://www.mapping.cityoflondon.gov.uk/arcgis/rest/services/' +
  'COMPASS_Hampstead_Historic_Postcards/MapServer';
export const GLA_CULTURAL_INFRASTRUCTURE_MAPSERVER =
  'https://gis.london.gov.uk/arcgis/rest/services/apps/' +
  'Cultural_infrastructure_2023_for_webapp_verified/MapServer';
export const OPENPLAQUES_SNAPSHOT_URL = './data/openplaques-london.json';
export const MUSEUM_DATA_SNAPSHOT_URL = './data/museum-data-london.json';
export const EDITORIAL_POIS_URL = './data/editorial-pois.json';

// Commons thumbnails: full-resolution P18 images are routinely 0.5-20 MB.
export const IMAGE_WIDTH_PX = 400;

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Coordinates are rounded to this many decimals to form a cache key. Three
// decimals is roughly a 110 m tile, which pairs well with REFETCH_DISTANCE.
export const CACHE_TILE_DECIMALS = 3;

export const REQUEST_TIMEOUT_MS = 20000;
