import test from 'node:test';
import assert from 'node:assert/strict';
import { cityFeatureToPOI } from '../js/sources/cityoflondon.js';

test('Hampstead Heath postcard records become selectable historic views', () => {
  const poi = cityFeatureToPOI({
    attributes: {
      OBJECTID: 7690,
      TEXT_ON_POSTCARD: 'Bathing Pond Hampstead 72',
      DESCRIPTION: 'Men on pontoon in pond',
      IMAGE_DATE: '1910',
      SOURCE: 'Michael Hammerson',
    },
    geometry: { x: -0.16593, y: 51.55962 },
  }, { key: 'postcard', kind: 'postcard' });

  assert.equal(poi.id, 'citylondon:postcard/7690');
  assert.deepEqual(poi.categories, ['postcard']);
  assert.equal(poi.lat, 51.55962);
  assert.match(poi.description, /1910/);
  assert.match(poi.links[0].url, /historic-postcard-project/);
});

test('City heritage assets carry official descriptions and map links', () => {
  const poi = cityFeatureToPOI({
    attributes: {
      OBJECTID: 3,
      NAME: 'Guildhall School of Music and Drama',
      STRUCTURE_TYPE_CATEGORY: 'Building',
      LISTED_STATUS: 'Grade II',
      BRIEF_ASSET_DESCRIPTION: 'Established in 1880.',
    },
    geometry: { x: -0.09089, y: 51.51982 },
  }, { key: 'building', kind: 'heritage' });

  assert.equal(poi.source, 'citylondon');
  assert.deepEqual(poi.categories, ['historic']);
  assert.equal(poi.meta.listedStatus, 'Grade II');
  assert.match(poi.links[0].url, /interactive-map-layers/);
});

test('City records without point geometry are ignored', () => {
  assert.equal(cityFeatureToPOI({ attributes: { OBJECTID: 1 } }, { key: 'building', kind: 'heritage' }), null);
});

test('City blue plaques use the plaque category and official scheme link', () => {
  const poi = cityFeatureToPOI({
    attributes: {
      OBJECTID: 42,
      SUBJECT: 'A notable Londoner',
      INSCRIPTION: 'Worked here and changed the City.',
    },
    geometry: { x: -0.087, y: 51.516 },
  }, { key: 'plaque', kind: 'plaque' });

  assert.deepEqual(poi.categories, ['plaque']);
  assert.equal(poi.meta.scheme, 'City of London Blue Plaque');
  assert.match(poi.links[0].url, /city-of-london-blue-plaques/);
});
