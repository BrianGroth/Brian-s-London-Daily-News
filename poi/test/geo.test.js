import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceMeters,
  bearingDegrees,
  compassPoint,
  formatDistance,
  tileKey,
} from '../js/lib/geo.js';

// Broadwick Street, Soho — the reference point used throughout these tests.
const SOHO = { lat: 51.5136, lon: -0.1365 };
const BROAD_STREET_PUMP = { lat: 51.51346, lon: -0.13664 };
const ST_PAULS = { lat: 51.5138, lon: -0.0984 };

test('distanceMeters matches known short and long separations', () => {
  const near = distanceMeters(SOHO.lat, SOHO.lon, BROAD_STREET_PUMP.lat, BROAD_STREET_PUMP.lon);
  assert.ok(near > 10 && near < 30, `expected ~18 m, got ${near}`);

  const far = distanceMeters(SOHO.lat, SOHO.lon, ST_PAULS.lat, ST_PAULS.lon);
  assert.ok(far > 2600 && far < 2700, `expected ~2.64 km, got ${far}`);
});

test('distanceMeters is zero for identical points and symmetric', () => {
  assert.equal(distanceMeters(SOHO.lat, SOHO.lon, SOHO.lat, SOHO.lon), 0);
  const there = distanceMeters(SOHO.lat, SOHO.lon, ST_PAULS.lat, ST_PAULS.lon);
  const back = distanceMeters(ST_PAULS.lat, ST_PAULS.lon, SOHO.lat, SOHO.lon);
  assert.ok(Math.abs(there - back) < 1e-6);
});

test('bearingDegrees and compassPoint agree on cardinal directions', () => {
  assert.equal(compassPoint(bearingDegrees(0, 0, 1, 0)), 'N');
  assert.equal(compassPoint(bearingDegrees(0, 0, 0, 1)), 'E');
  assert.equal(compassPoint(bearingDegrees(1, 0, 0, 0)), 'S');
  assert.equal(compassPoint(bearingDegrees(0, 1, 0, 0)), 'W');
  // St Paul's is almost due east of Soho.
  assert.equal(compassPoint(bearingDegrees(SOHO.lat, SOHO.lon, ST_PAULS.lat, ST_PAULS.lon)), 'E');
});

test('compassPoint wraps cleanly at 360', () => {
  assert.equal(compassPoint(0), 'N');
  assert.equal(compassPoint(359), 'N');
  assert.equal(compassPoint(360), 'N');
  assert.equal(compassPoint(-45), 'NW');
});

test('formatDistance is metric-first and rounds to a walkable precision', () => {
  assert.equal(formatDistance(34), '35 m');
  assert.equal(formatDistance(107), '105 m');
  assert.equal(formatDistance(999), '1000 m');
  assert.equal(formatDistance(1600), '1.6 km (1.0 mi)');
  assert.equal(formatDistance(null), '');
  assert.equal(formatDistance(NaN), '');
});

test('tileKey buckets nearby coordinates together', () => {
  // Rounding gives tiles hard edges, so a pair straddling one lands in
  // different buckets. That only ever costs a cache miss — whether the app
  // re-queries at all is governed by REFETCH_DISTANCE_METERS, not by this key.
  assert.equal(tileKey(51.51342, -0.13642, 3), tileKey(51.51338, -0.13638, 3));
  assert.notEqual(tileKey(51.5136, -0.1365, 3), tileKey(51.5200, -0.1365, 3));
});
