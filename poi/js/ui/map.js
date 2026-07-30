import { formatDistance, compassPoint } from '../lib/geo.js';
import { categoryMeta } from '../lib/categories.js';

/* Leaflet is vendored under vendor/leaflet rather than loaded from a CDN, so
 * the map still works from the service worker cache with no signal — which is
 * the whole point of an app you use while walking around. It attaches to the
 * global `L`; there is no ES module build in the 1.9.x line. */
const L = () => window.L;

// OSM's tile usage policy asks for attribution and no bulk downloading. A
// personal walking app well inside those bounds.
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

let map = null;
let userMarker = null;
let accuracyCircle = null;
let markerLayer = null;
let hasCentred = false;
let moveHandler = null;

const KNOWN_CATEGORIES = new Set(
  ['plaque', 'postcard', 'historic', 'museum', 'article', 'green', 'worship', 'listed']);

/**
 * Pin colour comes from a per-category CSS class rather than an inline style
 * attribute, so the page keeps `style-src 'self'` — no 'unsafe-inline' needed.
 * Leaflet's own positioning sets element.style from JavaScript, which CSP does
 * not restrict.
 */
function markerIcon(category, isNearest) {
  const safe = KNOWN_CATEGORIES.has(category) ? category : 'historic';
  const classes = ['poi-pin', `poi-pin--${safe}`];
  if (isNearest) classes.push('poi-pin--nearest');
  return L().divIcon({
    className: 'poi-pin-wrap',
    html: `<span class="${classes.join(' ')}"></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

export function initMap(container) {
  if (!L()) {
    console.warn('Leaflet failed to load; map unavailable.');
    return null;
  }
  if (map) return map;

  // Leaflet throws "Map container is already initialized" if a container is
  // bound twice, which a re-executed module would otherwise trigger. Adopt the
  // existing instance instead of building a second one over the top.
  if (container._nearbyMap) {
    map = container._nearbyMap;
    markerLayer = container._nearbyMarkerLayer;
    return map;
  }

  map = L().map(container, {
    zoomControl: true,
    attributionControl: true,
    // The list below is the primary interface; keep the map calm.
    dragging: true,
    scrollWheelZoom: true,
    touchZoom: true,
    tap: true,
  }).setView([51.5136, -0.1365], 16);

  L().tileLayer(TILE_URL, {
    maxZoom: 19,
    attribution: TILE_ATTRIBUTION,
  }).addTo(map);

  // A scale bar is the cheapest possible answer to "how far is that?".
  L().control.scale({ metric: true, imperial: true, position: 'bottomleft' }).addTo(map);

  markerLayer = L().layerGroup().addTo(map);
  map.on('moveend', () => {
    if (!moveHandler) return;
    const centre = map.getCenter();
    moveHandler({ lat: centre.lat, lon: centre.lng });
  });

  container._nearbyMap = map;
  container._nearbyMarkerLayer = markerLayer;
  return map;
}

/** Places the "you are here" dot and its accuracy halo. */
export function setUserPosition(lat, lon, accuracy) {
  if (!map) return;

  if (!userMarker) {
    userMarker = L().marker([lat, lon], {
      icon: L().divIcon({
        className: 'user-dot-wrap',
        html: '<span class="user-dot"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lon]);
  }

  if (accuracy != null) {
    if (!accuracyCircle) {
      accuracyCircle = L().circle([lat, lon], {
        radius: accuracy,
        className: 'accuracy-ring',
        interactive: false,
        weight: 1,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng([lat, lon]).setRadius(accuracy);
    }
  }

  if (!hasCentred) {
    map.setView([lat, lon], 16);
    hasCentred = true;
  }
}

function popupHtml(poi) {
  const meta = categoryMeta(poi.categories?.[0] ?? 'historic');
  const distance = `${formatDistance(poi.distance)} · ${compassPoint(poi.bearing)}`;
  const walk = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lon}&travelmode=walking`;

  // Built as a DOM tree rather than an HTML string, because POI names and
  // inscriptions are third-party text and must never be parsed as markup.
  const root = document.createElement('div');
  root.className = 'map-popup';

  const badge = document.createElement('span');
  badge.className = 'map-popup__badge';
  badge.textContent = `${meta.icon} ${meta.label}`;
  root.appendChild(badge);

  const title = document.createElement('strong');
  title.className = 'map-popup__title';
  title.textContent = poi.name;
  root.appendChild(title);

  const dist = document.createElement('span');
  dist.className = 'map-popup__distance';
  dist.textContent = distance;
  root.appendChild(dist);

  if (poi.inscription) {
    const quote = document.createElement('q');
    quote.className = 'map-popup__inscription';
    quote.textContent = poi.inscription;
    root.appendChild(quote);
  }

  const link = document.createElement('a');
  link.className = 'map-popup__walk';
  link.href = walk;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Walk here';
  root.appendChild(link);

  return root;
}

/**
 * Renders one pin per POI. Called with the same filtered, ranked list the cards
 * use, so map and list never disagree about what is nearby.
 */
export function setMarkers(pois, onSelect) {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();

  pois.forEach((poi, index) => {
    const marker = L().marker([poi.lat, poi.lon], {
      icon: markerIcon(poi.categories?.[0], index === 0),
      title: poi.name,
      alt: poi.name,
    });
    marker.bindPopup(() => popupHtml(poi), { closeButton: true, maxWidth: 260 });
    marker.on('popupopen', () => {
      marker.getElement()?.classList.add('poi-pin-wrap--selected');
      if (onSelect) onSelect(poi);
    });
    marker.on('popupclose', () => {
      marker.getElement()?.classList.remove('poi-pin-wrap--selected');
    });
    marker.addTo(markerLayer);
  });
}

/** Pans to a POI and opens its popup — used when a card is tapped. */
export function focusPOI(poi) {
  if (!map) return;
  map.setView([poi.lat, poi.lon], Math.max(map.getZoom(), 17), { animate: true });
  markerLayer.eachLayer((layer) => {
    const { lat, lng } = layer.getLatLng();
    if (Math.abs(lat - poi.lat) < 1e-9 && Math.abs(lng - poi.lon) < 1e-9) layer.openPopup();
  });
}

/** Re-centres on the user; wired to the "recentre" button. */
export function recentre() {
  if (map && userMarker) map.setView(userMarker.getLatLng(), 16, { animate: true });
}

/** Announces a completed pan/zoom so the app can offer a fresh area search. */
export function onMapMoved(handler) {
  moveHandler = handler;
}

/** Leaflet needs telling when its container changes size. */
export function invalidateSize() {
  if (map) map.invalidateSize();
}
