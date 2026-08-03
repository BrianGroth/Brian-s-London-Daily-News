import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, 'poi', 'data');
const OPENPLAQUES_URL =
  'https://openplaques.s3.eu-west-2.amazonaws.com/open-plaques-london-2025-12-15.geojson';
const MUSEUM_API = 'https://museumdata.uk/wp-json/wp/v2/museums';
const LONDON = { south: 51.28, north: 51.70, west: -0.55, east: 0.35 };

async function getJSON(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Brian-London-Daily-News/1.0' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return { body: await response.json(), headers: response.headers };
}

function inLondon(lat, lon) {
  return lat >= LONDON.south && lat <= LONDON.north && lon >= LONDON.west && lon <= LONDON.east;
}

async function refreshOpenPlaques() {
  const { body } = await getJSON(OPENPLAQUES_URL);
  const items = (body.features ?? []).map((feature) => ({
    id: feature.properties?.id,
    lat: feature.geometry?.coordinates?.[1],
    lon: feature.geometry?.coordinates?.[0],
    inscription: feature.properties?.inscription ?? null,
  })).filter((item) => item.id && Number.isFinite(item.lat) && Number.isFinite(item.lon));
  await writeFile(resolve(dataDir, 'openplaques-london.json'), JSON.stringify({
    schemaVersion: 1, source: OPENPLAQUES_URL, retrievedAt: new Date().toISOString(), items,
  }));
  return items.length;
}

async function refreshMuseumData() {
  const first = await getJSON(`${MUSEUM_API}?per_page=100&page=1`);
  const pages = Number(first.headers.get('x-wp-totalpages') ?? 1);
  const records = [...first.body];
  for (let page = 2; page <= pages; page += 1) {
    const { body } = await getJSON(`${MUSEUM_API}?per_page=100&page=${page}`);
    records.push(...body);
  }
  const items = records.map((record) => {
    const lat = Number(record.acf?.latitude);
    const lon = Number(record.acf?.longitude);
    return {
      id: record.slug,
      name: record.title?.rendered,
      lat, lon,
      url: record.link,
      wikidataId: record.acf?.wikidata_id ?? null,
      types: record.acf?.instance_of ?? '',
      status: record.acf?.status ?? [],
    };
  }).filter((item) => item.id && item.name && inLondon(item.lat, item.lon));
  await writeFile(resolve(dataDir, 'museum-data-london.json'), JSON.stringify({
    schemaVersion: 1, source: MUSEUM_API, retrievedAt: new Date().toISOString(), items,
  }));
  return items.length;
}

await mkdir(dataDir, { recursive: true });
const [plaques, museums] = await Promise.all([refreshOpenPlaques(), refreshMuseumData()]);
console.log(`Wrote ${plaques} OpenPlaques and ${museums} London museum records.`);
