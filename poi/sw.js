/* Service worker for Nearby Explorer.
 *
 * Two strategies:
 *   - app shell: cache-first, so the app opens instantly and works with no
 *     signal (the Underground, and the dead spots between tall buildings).
 *   - API traffic: network-first with a cache fallback, so results are fresh
 *     when there is signal and the last successful response still renders when
 *     there is not.
 */

// IMPORTANT: bump VERSION on every deploy that changes any file in
// SHELL_ASSETS. The shell is served cache-first, so returning users keep the
// old HTML/CSS/JS indefinitely until this string changes and `activate` clears
// the previous caches. Editing a file without bumping this ships nothing.
const VERSION = 'brian-daily-v9';
const SHELL_CACHE = `nearbypoi-shell-${VERSION}`;
const API_CACHE = `nearbypoi-api-${VERSION}`;
// Tiles are versionless on purpose: they change rarely, they are expensive to
// refetch, and keeping them across deploys is what makes the map usable
// underground. Capped by TILE_CACHE_LIMIT rather than by version.
const TILE_CACHE = 'nearbypoi-tiles';
const TILE_CACHE_LIMIT = 600;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './css/brian-daily.css?v=7',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './js/app.js',
  './js/config.js',
  './js/lib/geo.js',
  './js/lib/http.js',
  './js/lib/cache.js',
  './js/lib/merge.js',
  './js/lib/categories.js',
  './js/sources/overpass.js',
  './js/sources/wikipedia.js',
  './js/sources/historicengland.js',
  './js/sources/cityoflondon.js',
  './js/sources/snapshot.js',
  './js/sources/editorial.js',
  './js/sources/openplaques.js',
  './js/sources/museumdata.js',
  './js/sources/gla.js',
  './data/editorial-pois.json',
  './data/openplaques-london.json',
  './data/museum-data-london.json',
  './js/enrich/wikidata.js',
  './js/ui/render.js',
  './js/ui/status.js',
  './js/ui/map.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

const API_HOSTS = new Set([
  'overpass-api.de',
  'overpass.kumi.systems',
  'en.wikipedia.org',
  'www.wikidata.org',
  'services-eu1.arcgis.com',
  'www.mapping.cityoflondon.gov.uk',
  'gis.london.gov.uk',
  'commons.wikimedia.org',
  'upload.wikimedia.org',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('nearbypoi-')
            && ![SHELL_CACHE, API_CACHE, TILE_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    // Overpass POSTs cannot be used as cache keys, so only GETs are stored.
    if (response.ok && request.method === 'GET') cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

const isTile = (hostname) => hostname.endsWith('tile.openstreetmap.org');

/**
 * Tiles are cache-first: re-panning over ground you have already covered
 * should be instant and should work with no signal. Trimmed FIFO-ish once the
 * cache passes TILE_CACHE_LIMIT, so a long walk cannot fill the device.
 */
async function tileFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    if (keys.length > TILE_CACHE_LIMIT) {
      await Promise.all(keys.slice(0, keys.length - TILE_CACHE_LIMIT).map((k) => cache.delete(k)));
    }
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept the POST to Overpass; let it fail loudly and be handled by
  // the app's own endpoint fallback and localStorage tile cache instead.
  if (request.method !== 'GET') return;

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isTile(url.hostname)) {
    event.respondWith(tileFirst(request));
    return;
  }

  if (API_HOSTS.has(url.hostname)) {
    event.respondWith(networkFirst(request));
  }
});
