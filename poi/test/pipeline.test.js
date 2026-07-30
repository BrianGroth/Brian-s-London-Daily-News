import test from 'node:test';
import assert from 'node:assert/strict';
import { osmElementToPOI } from '../js/sources/overpass.js';
import { mergePOIs } from '../js/lib/merge.js';
import { categoriseOsmTags } from '../js/lib/categories.js';
import { distanceMeters } from '../js/lib/geo.js';

const SOHO = { lat: 51.5136, lon: -0.1365 };

// Real tags, as returned by Overpass for plaques around Soho.
const SHELLEY_PLAQUE = {
  type: 'node',
  id: 1,
  lat: 51.5137,
  lon: -0.1366,
  tags: {
    historic: 'memorial',
    memorial: 'blue_plaque',
    name: 'Percy Bysshe Shelley',
    erected_by: 'English Heritage',
    inscription: 'Percy Bysshe Shelley 1792 - 1822 Poet lived here in 1811',
    'openplaques:id': '580',
    'subject:wikidata': 'Q93343',
  },
};

test('a plaque carrying only subject:wikidata survives the pipeline', () => {
  // The regression that motivated v2: the old code filtered on `tags.wikidata`,
  // which most London plaques do not have, so every one of them was dropped.
  const poi = osmElementToPOI(SHELLEY_PLAQUE);
  assert.ok(poi, 'plaque should not be discarded');
  assert.equal(poi.meta.wikidataId, null);
  assert.equal(poi.meta.subjectWikidataId, 'Q93343');
  assert.equal(poi.categories[0], 'plaque');
});

test('the inscription is carried through as its own field', () => {
  const poi = osmElementToPOI(SHELLEY_PLAQUE);
  assert.match(poi.inscription, /lived here in 1811/);
  assert.equal(poi.meta.erectedBy, 'English Heritage');
  assert.equal(poi.meta.openPlaquesId, '580');
  assert.equal(poi.links[0].url, 'https://openplaques.org/plaques/580');
});

test('a plaque with an inscription but no name is kept and given a title', () => {
  const poi = osmElementToPOI({
    type: 'node',
    id: 2,
    lat: 51.5136,
    lon: -0.1365,
    tags: {
      historic: 'memorial',
      memorial: 'plaque',
      inscription: 'On this site stood the Broad Street pump removed by the parish in 1854',
    },
  });
  assert.ok(poi, 'inscription-only plaque should survive');
  assert.ok(poi.name.length > 0);
  assert.ok(poi.name.endsWith('…'), 'long inscriptions should be elided into a title');
});

test('elements with neither name nor inscription are dropped', () => {
  assert.equal(osmElementToPOI({ type: 'node', id: 3, lat: 1, lon: 1, tags: { historic: 'yes' } }), null);
});

test('ways and relations take their centre coordinate', () => {
  const poi = osmElementToPOI({
    type: 'way',
    id: 4,
    center: { lat: 51.5, lon: -0.1 },
    tags: { name: 'St Anne\'s Church', amenity: 'place_of_worship' },
  });
  assert.equal(poi.lat, 51.5);
  assert.equal(poi.categories[0], 'worship');
});

test('latitude zero is not mistaken for a missing coordinate', () => {
  const poi = osmElementToPOI({
    type: 'node', id: 5, lat: 0, lon: 0, tags: { name: 'Null Island', historic: 'monument' },
  });
  assert.ok(poi, 'a POI on the equator has a valid coordinate');
  assert.equal(poi.lat, 0);
});

test('categoriseOsmTags puts memorials in the plaque bucket', () => {
  assert.equal(categoriseOsmTags({ memorial: 'blue_plaque', historic: 'memorial' }), 'plaque');
  assert.equal(categoriseOsmTags({ tourism: 'museum' }), 'museum');
  assert.equal(categoriseOsmTags({ leisure: 'park', name: 'Soho Square' }), 'green');
  assert.equal(categoriseOsmTags({ historic: 'castle' }), 'historic');
});

// --- ranking ------------------------------------------------------------

test('sorting happens before truncation, so the nearest place always wins', () => {
  // This models the v1 defect directly: the server used to cap the result set
  // in its own element order, and only the survivors were sorted by distance.
  const pois = [
    { id: 'far', lat: 51.5180, lon: -0.1365 },
    { id: 'mid', lat: 51.5145, lon: -0.1365 },
    { id: 'near', lat: 51.51365, lon: -0.1365 },
  ];

  const ranked = pois
    .map((p) => ({ ...p, distance: distanceMeters(SOHO.lat, SOHO.lon, p.lat, p.lon) }))
    .sort((a, b) => a.distance - b.distance);

  assert.deepEqual(ranked.map((p) => p.id), ['near', 'mid', 'far']);
  assert.equal(ranked.slice(0, 1)[0].id, 'near');
});

// --- merging ------------------------------------------------------------

const base = (over) => ({
  id: 'x', source: 'osm', name: 'Thing', categories: ['historic'],
  lat: 51.5136, lon: -0.1365, description: null, inscription: null,
  imageUrl: null, links: [], meta: {}, ...over,
});

test('records sharing a Wikidata id collapse into one', () => {
  const merged = mergePOIs([
    base({ id: 'osm:node/1', meta: { wikidataId: 'Q1' } }),
    base({ id: 'wikipedia:9', source: 'wikipedia', name: 'Thing (building)', meta: { wikidataId: 'Q1' } }),
  ]);
  assert.equal(merged.length, 1);
});

test('same name within 45 m collapses; same name far apart does not', () => {
  const close = mergePOIs([
    base({ id: 'a', name: "St Anne's Church" }),
    base({ id: 'b', source: 'nhle', name: 'St Annes Church', lat: 51.51385, lon: -0.1365 }),
  ]);
  assert.equal(close.length, 1, 'same church from two sources');

  const apart = mergePOIs([
    base({ id: 'a', name: 'The Crown' }),
    base({ id: 'b', name: 'The Crown', lat: 51.5200, lon: -0.1365 }),
  ]);
  assert.equal(apart.length, 2, 'two different pubs with the same name');
});

test('merging prefers the OSM inscription over a generic description', () => {
  const [merged] = mergePOIs([
    base({ id: 'osm:node/1', source: 'osm', inscription: 'Shelley lived here', meta: { wikidataId: 'Q1' } }),
    base({ id: 'wikipedia:9', source: 'wikipedia', description: 'A building in London.', imageUrl: 'https://x/y.jpg', meta: { wikidataId: 'Q1' } }),
  ]);
  assert.equal(merged.inscription, 'Shelley lived here');
  // Gaps are still filled from the lower-priority record.
  assert.equal(merged.description, 'A building in London.');
  assert.equal(merged.imageUrl, 'https://x/y.jpg');
});

test('merging unions categories so either filter still matches', () => {
  const [merged] = mergePOIs([
    base({ id: 'osm:node/1', categories: ['plaque'], meta: { wikidataId: 'Q1' } }),
    base({ id: 'nhle:2', source: 'nhle', categories: ['listed'], meta: { wikidataId: 'Q1' } }),
  ]);
  assert.deepEqual(merged.categories.sort(), ['listed', 'plaque']);
});

test('merging is stable when nothing matches', () => {
  const input = [base({ id: 'a', name: 'A' }), base({ id: 'b', name: 'B' }), base({ id: 'c', name: 'C' })];
  assert.deepEqual(mergePOIs(input).map((p) => p.id), ['a', 'b', 'c']);
});
