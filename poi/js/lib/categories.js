/**
 * Display categories. Order here is the order of the filter chips, and is
 * deliberately London-first: plaques lead because they are the densest and most
 * rewarding layer in central London.
 */
export const CATEGORIES = [
  { id: 'plaque',  label: 'Plaques',    icon: '🔵', defaultOn: true },
  { id: 'postcard', label: 'Historic views', icon: '🕰️', defaultOn: true },
  { id: 'historic', label: 'Historic',  icon: '🏛️', defaultOn: true },
  { id: 'museum',  label: 'Museums',    icon: '🖼️', defaultOn: true },
  { id: 'article', label: 'Wikipedia',  icon: '📖', defaultOn: true },
  { id: 'green',   label: 'Parks',      icon: '🌳', defaultOn: true },
  { id: 'worship', label: 'Places of worship', icon: '⛪', defaultOn: true },
  // Off by default: central London has hundreds of Grade II listings per km²,
  // which would otherwise bury everything else.
  { id: 'listed',  label: 'Listed buildings', icon: '📐', defaultOn: false },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

const CATEGORY_LABELS = new Map(CATEGORIES.map((c) => [c.id, c]));
export const categoryMeta = (id) => CATEGORY_LABELS.get(id) ?? { label: id, icon: '📍' };

/** Maps a set of OSM tags onto one of our display categories. */
export function categoriseOsmTags(tags) {
  if (tags.memorial || tags['historic'] === 'memorial') return 'plaque';
  if (tags.tourism === 'museum' || tags.tourism === 'gallery' || tags.tourism === 'artwork') {
    return 'museum';
  }
  if (tags.amenity === 'place_of_worship') return 'worship';
  if (tags.leisure) return 'green';
  if (tags.historic) return 'historic';
  if (tags.tourism || tags.man_made || tags.amenity) return 'historic';
  return 'historic';
}
