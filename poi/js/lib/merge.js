import { distanceMeters } from './geo.js';

/** Two records this close with a matching name are assumed to be the same thing. */
const SAME_PLACE_METERS = 45;

function normaliseName(name) {
  return (name ?? '')
    .toLowerCase()
    // Apostrophes are dropped rather than replaced with a space: Historic
    // England writes "ST ANNES CHURCH" where OSM has "St Anne's Church", and
    // splitting on the apostrophe would stop those two ever matching.
    .replace(/['’]/g, '')
    .replace(/^(the|a)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Later sources only fill gaps, so the order the app fetches in decides which
// description wins. OSM first: an inscription beats a generic Wikidata blurb.
const SOURCE_RANK = {
  osm: 0,
  editorial: 1,
  openplaques: 2,
  citylondon: 3,
  museumdata: 4,
  'gla-culture': 5,
  wikipedia: 6,
  nhle: 7,
};

function preferred(a, b) {
  return (SOURCE_RANK[a.source] ?? 9) <= (SOURCE_RANK[b.source] ?? 9) ? a : b;
}

function combine(a, b) {
  const base = preferred(a, b);
  const other = base === a ? b : a;
  return {
    ...other,
    ...base,
    description: base.description ?? other.description,
    inscription: base.inscription ?? other.inscription,
    imageUrl: base.imageUrl ?? other.imageUrl,
    links: [...(base.links ?? []), ...(other.links ?? [])],
    meta: { ...other.meta, ...base.meta },
    // Keep every category the merged record legitimately belongs to, so a
    // listed building that also has a plaque survives either filter.
    categories: [...new Set([...(base.categories ?? []), ...(other.categories ?? [])])],
  };
}

/**
 * Collapses records describing the same real-world place. Matches on, in order:
 * identical source id, shared Wikidata id, then same normalised name within
 * SAME_PLACE_METERS. The last rule is what stops "St Anne's Church" appearing
 * once from OSM, once from Wikipedia and once from the listed-buildings layer.
 */
export function mergePOIs(records) {
  const merged = [];
  const byId = new Map();
  const byWikidata = new Map();
  const byOpenPlaques = new Map();
  const byName = new Map();

  for (const record of records) {
    const nameKey = normaliseName(record.name);
    const wikidataId = record.meta?.wikidataId;
    const openPlaquesId = record.meta?.openPlaquesId;

    let targetIndex =
      byId.get(record.id) ??
      (wikidataId ? byWikidata.get(wikidataId) : undefined) ??
      (openPlaquesId ? byOpenPlaques.get(String(openPlaquesId)) : undefined);

    if (targetIndex === undefined && nameKey) {
      for (const candidate of byName.get(nameKey) ?? []) {
        const existing = merged[candidate];
        if (!existing) continue;
        const gap = distanceMeters(existing.lat, existing.lon, record.lat, record.lon);
        if (gap <= SAME_PLACE_METERS) {
          targetIndex = candidate;
          break;
        }
      }
    }

    if (targetIndex === undefined) {
      targetIndex = merged.length;
      merged.push(record);
    } else {
      merged[targetIndex] = combine(merged[targetIndex], record);
    }

    byId.set(record.id, targetIndex);
    if (wikidataId) byWikidata.set(wikidataId, targetIndex);
    if (openPlaquesId) byOpenPlaques.set(String(openPlaquesId), targetIndex);
    if (nameKey) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(targetIndex);
    }
  }

  return merged;
}
