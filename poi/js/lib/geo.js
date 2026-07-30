// Pure geodesic helpers. No DOM, no network — covered by test/run.js.

const EARTH_RADIUS_M = 6371e3;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Great-circle distance in metres between two WGS84 points. */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing in degrees clockwise from true north. */
export function bearingDegrees(lat1, lon1, lat2, lon2) {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lon2 - lon1);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Bearing to an 8-point compass label. */
export function compassPoint(bearing) {
  return COMPASS[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}

/**
 * Metric-first distance label. The app is built for London, where road signs
 * and locals both use metres for short distances and miles only for long ones;
 * under a kilometre the mile figure is noise, so it is omitted.
 */
export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return '';
  if (meters < 1000) return `${Math.round(meters / 5) * 5} m`;
  const km = meters / 1000;
  const miles = meters * 0.000621371;
  return `${km.toFixed(1)} km (${miles.toFixed(1)} mi)`;
}

/** Rounds a coordinate pair into a stable cache-tile key. */
export function tileKey(lat, lon, decimals) {
  return `${lat.toFixed(decimals)},${lon.toFixed(decimals)}`;
}
