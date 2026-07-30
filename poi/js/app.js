import {
  SEARCH_RADIUS_METERS,
  PAGE_SIZE,
  REFETCH_DISTANCE_METERS,
  MAX_ACCEPTABLE_ACCURACY_METERS,
} from './config.js';
import { distanceMeters, bearingDegrees, formatDistance } from './lib/geo.js';
import { mergePOIs } from './lib/merge.js';
import { CATEGORIES } from './lib/categories.js';
import { fetchOverpassPOIs } from './sources/overpass.js';
import { fetchWikipediaPOIs } from './sources/wikipedia.js';
import { fetchListedBuildings } from './sources/historicengland.js';
import { fetchCityOfLondonPOIs } from './sources/cityoflondon.js';
import { enrichWithWikidata } from './enrich/wikidata.js';
import { renderPOIs, renderFilters } from './ui/render.js';
import { setStatus, clearStatus } from './ui/status.js';
import {
  initMap,
  setUserPosition,
  setMarkers,
  focusPOI,
  recentre,
  onMapMoved,
  invalidateSize,
} from './ui/map.js';

const dom = {
  map: document.getElementById('map'),
  grid: document.getElementById('grid'),
  filters: document.getElementById('filters'),
  more: document.getElementById('more'),
  refresh: document.getElementById('refresh'),
  recentre: document.getElementById('recentre'),
  searchArea: document.getElementById('search-area'),
  location: document.getElementById('location'),
  summary: document.getElementById('summary'),
};

const state = {
  coords: null,
  accuracy: null,
  browseCoords: null,
  pendingMapCenter: null,
  fetchOrigin: null,
  bySource: new Map(),   // source name -> POI[]  (kept separate so each can land alone)
  pois: [],              // merged view of everything that has landed so far
  enabled: new Set(CATEGORIES.filter((c) => c.defaultOn).map((c) => c.id)),
  visibleCount: PAGE_SIZE,
  enriched: new Set(),
  pending: new Set(),
  failed: new Set(),
  loadToken: 0,
};

const SOURCES = [
  { name: 'OpenStreetMap', fetch: fetchOverpassPOIs },
  { name: 'Wikipedia', fetch: fetchWikipediaPOIs },
  { name: 'Historic England', fetch: fetchListedBuildings },
  { name: 'City of London heritage', fetch: fetchCityOfLondonPOIs },
];

// --- data ---------------------------------------------------------------

/**
 * Each source is rendered the moment it lands rather than awaiting the set.
 *
 * This matters more than it sounds. Wikipedia typically answers in about a
 * second; Overpass can take 18 s, or fail over through three mirrors first.
 * Awaiting all three meant staring at a spinner for the duration of the
 * slowest one — which, in an app built for a ten-second glance while walking,
 * made a healthy Wikipedia response useless.
 */
function loadPOIs(lat, lon) {
  const token = ++state.loadToken;

  state.bySource.clear();
  state.pois = [];
  state.failed.clear();
  state.pending = new Set(SOURCES.map((s) => s.name));
  state.fetchOrigin = { lat, lon };
  state.visibleCount = PAGE_SIZE;
  state.enriched = new Set();

  updateProgressStatus();

  for (const source of SOURCES) {
    source.fetch(lat, lon, SEARCH_RADIUS_METERS)
      .then((records) => {
        if (token !== state.loadToken) return; // a newer load superseded this one
        state.bySource.set(source.name, records);
      })
      .catch((error) => {
        if (token !== state.loadToken) return;
        state.failed.add(source.name);
        console.warn(`${source.name} failed:`, error.message);
      })
      .finally(() => {
        if (token !== state.loadToken) return;
        state.pending.delete(source.name);
        state.pois = mergePOIs([...state.bySource.values()].flat());
        updateProgressStatus();
        render();
      });
  }
}

function updateProgressStatus() {
  const haveResults = state.pois.length > 0;

  if (state.pending.size > 0) {
    // Only block the screen while there is genuinely nothing to show.
    if (!haveResults) setStatus('Finding nearby places…', { busy: true });
    else clearStatus();
    return;
  }

  if (!haveResults) {
    setStatus(
      state.failed.size
        ? `Could not reach ${[...state.failed].join(' or ')}. Check your connection and try again.`
        : 'No places found nearby.',
      { error: true }
    );
    return;
  }

  if (state.failed.size) {
    setStatus(`Showing results without ${[...state.failed].join(' and ')}.`, { error: true });
    setTimeout(() => { if (state.pending.size === 0) clearStatus(); }, 5000);
  } else {
    clearStatus();
  }
}

// --- ranking ------------------------------------------------------------

/**
 * Distance and bearing are recomputed from the live fix on every render, not
 * stored at fetch time, so ordering stays correct as the user walks without
 * re-querying any source.
 */
function ranked() {
  const origin = activeOrigin();
  if (!origin) return [];
  const { lat, lon } = origin;
  return state.pois
    .map((poi) => ({
      ...poi,
      distance: distanceMeters(lat, lon, poi.lat, poi.lon),
      bearing: bearingDegrees(lat, lon, poi.lat, poi.lon),
    }))
    .sort((a, b) => a.distance - b.distance);
}

function categoryCounts(pois) {
  const counts = new Map();
  for (const poi of pois) {
    for (const category of poi.categories ?? []) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return counts;
}

const matchesFilter = (poi) => (poi.categories ?? []).some((c) => state.enabled.has(c));

// --- rendering ----------------------------------------------------------

function render() {
  if (!activeOrigin()) return;

  const all = ranked();
  const matching = all.filter(matchesFilter);
  const shown = matching.slice(0, state.visibleCount);

  renderFilters(dom.filters, state.enabled, categoryCounts(all), () => {
    state.visibleCount = PAGE_SIZE;
    render();
  });

  renderPOIs(dom.grid, shown, focusPOI);

  // The map shows every match, not just the paginated slice — the whole point
  // of a map is seeing what is around you, including behind you.
  setMarkers(matching, null);

  const nearest = matching[0];
  dom.summary.textContent = nearest
    ? `${matching.length} places nearby · nearest ${formatDistance(nearest.distance)} away`
    : '';

  dom.more.hidden = shown.length >= matching.length;
  dom.more.textContent = `Show more (${matching.length - shown.length} further away)`;

  if (matching.length === 0 && state.pending.size === 0 && state.pois.length > 0) {
    setStatus('Nothing matches the selected filters.', {});
  }

  enrichVisible(shown);
}

/**
 * Enrichment is scoped to the cards on screen. A 1 km central London query
 * carries 300+ Wikidata ids; resolving all of them would be pure waste when
 * only a couple of dozen are rendered.
 */
async function enrichVisible(shown) {
  const pending = shown.filter((poi) => !state.enriched.has(poi.id));
  if (pending.length === 0) return;

  for (const poi of pending) state.enriched.add(poi.id);

  const enriched = await enrichWithWikidata(pending);
  const byId = new Map(enriched.map((poi) => [poi.id, poi]));

  let changed = false;
  state.pois = state.pois.map((poi) => {
    const update = byId.get(poi.id);
    if (!update) return poi;
    if (update.description === poi.description && update.imageUrl === poi.imageUrl) return poi;
    changed = true;
    return { ...poi, ...update, distance: undefined, bearing: undefined };
  });

  if (changed) render();
}

// --- location -----------------------------------------------------------

function describeFix() {
  const accuracy = Math.round(state.accuracy ?? 0);
  const note = accuracy > MAX_ACCEPTABLE_ACCURACY_METERS
    ? ' — move into the open for a better fix'
    : '';
  return `Within ${formatDistance(SEARCH_RADIUS_METERS)} · accuracy ±${accuracy} m${note}`;
}

function activeOrigin() {
  return state.browseCoords ?? state.coords ?? state.fetchOrigin;
}

function describeBrowse() {
  return `Exploring map centre · within ${formatDistance(SEARCH_RADIUS_METERS)}`;
}

function onPosition(position) {
  const { latitude: lat, longitude: lon, accuracy } = position.coords;
  const previous = state.coords;
  state.coords = { lat, lon };
  state.accuracy = accuracy;
  setUserPosition(lat, lon, accuracy);

  // A deliberate map search is sticky. GPS continues to move the blue dot,
  // but it does not yank the results back to the user's position.
  if (state.browseCoords) return;

  dom.location.textContent = describeFix();
  const moved = state.fetchOrigin
    ? distanceMeters(state.fetchOrigin.lat, state.fetchOrigin.lon, lat, lon)
    : Infinity;

  if (moved > REFETCH_DISTANCE_METERS) {
    loadPOIs(lat, lon);
  } else if (previous) {
    // Same tile: re-rank against the new fix. No network at all.
    render();
  }
}

function onPositionError(error) {
  const messages = {
    [error.PERMISSION_DENIED]:
      'Location permission denied. Enable it in your browser settings to see nearby places.',
    [error.POSITION_UNAVAILABLE]: 'Location unavailable. Try again once you have a signal.',
    [error.TIMEOUT]: 'Timed out waiting for a location fix.',
  };
  setStatus(messages[error.code] ?? 'Could not determine your location.', { error: true });
}

function startWatching() {
  if (!navigator.geolocation) {
    setStatus('This browser does not support geolocation.', { error: true });
    return;
  }
  setStatus('Getting your location…', { busy: true });
  navigator.geolocation.watchPosition(onPosition, onPositionError, {
    // House-level accuracy matters: a plaque is on one specific building.
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 30000,
  });
}

// --- wiring -------------------------------------------------------------

initMap(dom.map);
// The map is laid out before the first paint settles; Leaflet needs telling.
window.addEventListener('resize', invalidateSize);
requestAnimationFrame(invalidateSize);

dom.more.addEventListener('click', () => {
  state.visibleCount += PAGE_SIZE;
  render();
});

dom.refresh.addEventListener('click', () => {
  const origin = activeOrigin();
  if (origin) loadPOIs(origin.lat, origin.lon);
});

dom.searchArea.addEventListener('click', () => {
  if (!state.pendingMapCenter) return;
  state.browseCoords = { ...state.pendingMapCenter };
  dom.searchArea.hidden = true;
  dom.location.textContent = describeBrowse();
  loadPOIs(state.browseCoords.lat, state.browseCoords.lon);
});

dom.recentre.addEventListener('click', () => {
  if (!state.coords) return;
  state.browseCoords = null;
  state.pendingMapCenter = { ...state.coords };
  dom.searchArea.hidden = true;
  dom.location.textContent = describeFix();
  loadPOIs(state.coords.lat, state.coords.lon);
  recentre();
});

onMapMoved((centre) => {
  state.pendingMapCenter = centre;
  const origin = activeOrigin();
  // If location permission is unavailable, the map is still useful: any pan
  // offers an explicit area search from the visible centre.
  dom.searchArea.hidden = origin
    ? distanceMeters(origin.lat, origin.lon, centre.lat, centre.lon) <= REFETCH_DISTANCE_METERS
    : false;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error.message);
    });
  });
}

startWatching();
