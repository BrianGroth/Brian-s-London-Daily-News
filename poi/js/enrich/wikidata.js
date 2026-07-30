import { WIKIDATA_API, IMAGE_WIDTH_PX } from '../config.js';
import { fetchJSON, safeHttpsUrl } from '../lib/http.js';
import { readCache, writeCache } from '../lib/cache.js';

// wbgetentities accepts 50 ids per call for anonymous callers.
const BATCH_SIZE = 50;

/**
 * Commons thumbnail URL. P18 gives the original upload, which for one sampled
 * plaque subject is 602 KB against 33 KB at 400 px — an 18x saving per tile,
 * repeated for every card, on a phone using mobile data.
 */
function commonsThumb(filename) {
  const encoded = encodeURIComponent(filename.replace(/ /g, '_'));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${IMAGE_WIDTH_PX}`;
}

function extractEntity(entity) {
  const image = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return {
    description: entity.descriptions?.en?.value ?? null,
    imageUrl: image ? commonsThumb(image) : null,
    wikipediaUrl: safeHttpsUrl(entity.sitelinks?.enwiki?.url) ?? null,
    label: entity.labels?.en?.value ?? null,
  };
}

async function fetchBatch(ids) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'labels|descriptions|claims|sitelinks/urls',
    languages: 'en',
    sitefilter: 'enwiki',
    format: 'json',
    origin: '*',
  });

  const data = await fetchJSON(`${WIKIDATA_API}?${params}`);
  const out = new Map();
  for (const [id, entity] of Object.entries(data.entities ?? {})) {
    if (entity.missing !== undefined) continue;
    out.set(id, extractEntity(entity));
  }
  return out;
}

/**
 * Resolves Wikidata ids to descriptions, thumbnails and article links.
 *
 * This replaces one SPARQL request per POI. The old approach hit
 * query.wikidata.org N times per screen; WDQS is heavily rate limited and
 * deprioritises callers without a descriptive User-Agent, which a browser
 * cannot set. wbgetentities is a plain CORS-enabled API with no such problem.
 */
export async function resolveWikidata(ids) {
  const resolved = new Map();
  const missing = [];

  for (const id of new Set(ids.filter(Boolean))) {
    const cached = readCache(`wd:${id}`);
    if (cached) resolved.set(id, cached);
    else missing.push(id);
  }

  const batches = [];
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    batches.push(missing.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.allSettled(batches.map(fetchBatch));
  for (const result of results) {
    if (result.status !== 'fulfilled') {
      console.warn('Wikidata batch failed:', result.reason?.message);
      continue;
    }
    for (const [id, value] of result.value) {
      writeCache(`wd:${id}`, value);
      resolved.set(id, value);
    }
  }

  return resolved;
}

/**
 * Fills in description/image/link on the given POIs.
 *
 * For a plaque the useful entity is usually `subject:wikidata` — the person
 * commemorated — so their portrait and one-line biography land on the card, and
 * the link goes to their article rather than to the plaque.
 */
export async function enrichWithWikidata(pois) {
  const ids = pois.flatMap((poi) =>
    [poi.meta?.wikidataId, poi.meta?.subjectWikidataId].filter(Boolean));
  if (ids.length === 0) return pois;

  const resolved = await resolveWikidata(ids);

  return pois.map((poi) => {
    const own = poi.meta?.wikidataId ? resolved.get(poi.meta.wikidataId) : null;
    const subject = poi.meta?.subjectWikidataId
      ? resolved.get(poi.meta.subjectWikidataId)
      : null;
    if (!own && !subject) return poi;

    const links = [...poi.links];
    const wikipediaUrl = own?.wikipediaUrl ?? subject?.wikipediaUrl;
    if (wikipediaUrl && !links.some((l) => l.url === wikipediaUrl)) {
      links.push({
        url: wikipediaUrl,
        label: subject?.wikipediaUrl === wikipediaUrl && subject?.label
          ? `Wikipedia: ${subject.label}`
          : 'Wikipedia',
      });
    }

    return {
      ...poi,
      description: poi.description ?? own?.description ?? subject?.description ?? null,
      imageUrl: poi.imageUrl ?? own?.imageUrl ?? subject?.imageUrl ?? null,
      links,
    };
  });
}
