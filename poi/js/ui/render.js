import { formatDistance, compassPoint } from '../lib/geo.js';
import { CATEGORIES, categoryMeta } from '../lib/categories.js';

/**
 * One https URL for every platform. The previous build sniffed the OS to emit
 * `comgooglemaps://`, which silently dead-ends when Google Maps is not
 * installed; the plain https form deep-links into the native app on both iOS
 * and Android via universal links, and falls back to the web elsewhere.
 * `travelmode=walking` because this app is used on foot.
 */
function directionsUrl(poi) {
  const params = new URLSearchParams({
    api: '1',
    destination: `${poi.lat},${poi.lon}`,
    travelmode: 'walking',
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function externalLink(href, label, className) {
  const anchor = el('a', className, label);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function attributionText(poi) {
  const bits = [];
  if (poi.meta?.scheme) bits.push(poi.meta.scheme);
  if (poi.meta?.erectedBy) bits.push(`erected by ${poi.meta.erectedBy}`);
  if (poi.meta?.grade) bits.push(`Grade ${poi.meta.grade} listed`);
  return bits.join(' · ');
}

function renderCard(poi, onFocus, isNearest = false) {
  const card = el('article', 'poi');
  if (isNearest) card.classList.add('poi--nearest');

  if (poi.imageUrl) {
    const image = el('img', 'poi__image');
    image.src = poi.imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    card.appendChild(image);
  }

  const body = el('div', 'poi__body');

  const top = el('div', 'poi__top');
  const primary = poi.categories?.[0] ?? 'historic';
  const meta = categoryMeta(primary);
  top.appendChild(el('span', 'poi__badge', meta.label));

  const distance = formatDistance(poi.distance);
  if (distance) {
    top.appendChild(el('span', 'poi__distance', `${distance} · ${compassPoint(poi.bearing)}`));
  }
  if (isNearest) top.appendChild(el('span', 'poi__nearest', 'Nearest'));
  body.appendChild(top);

  const title = el('h2', 'poi__title');
  const primaryLink = poi.links?.[0];
  title.appendChild(
    primaryLink
      ? externalLink(primaryLink.url, poi.name, 'poi__title-link')
      : document.createTextNode(poi.name)
  );
  body.appendChild(title);

  // The inscription gets pride of place: on a London plaque it is the answer to
  // "who lived here", verbatim from the plaque itself.
  if (poi.inscription) {
    body.appendChild(el('blockquote', 'poi__inscription', poi.inscription));
  }

  if (poi.description) {
    body.appendChild(el('p', 'poi__description', poi.description));
  }

  const attribution = attributionText(poi);
  if (attribution) body.appendChild(el('p', 'poi__attribution', attribution));

  const actions = el('div', 'poi__actions');
  actions.appendChild(externalLink(directionsUrl(poi), 'Walk here', 'poi__button'));

  if (onFocus) {
    const locate = el('button', 'poi__link', 'Show on map');
    locate.type = 'button';
    locate.addEventListener('click', () => {
      onFocus(poi);
      document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    actions.appendChild(locate);
  }

  for (const link of (poi.links ?? []).slice(0, 2)) {
    actions.appendChild(externalLink(link.url, link.label, 'poi__link'));
  }
  body.appendChild(actions);

  card.appendChild(body);
  return card;
}

export function renderPOIs(container, pois, onFocus) {
  container.replaceChildren(...pois.map((poi, index) => renderCard(poi, onFocus, index === 0)));
}

/** Filter chips. `state` is a Set of enabled category ids, mutated in place. */
export function renderFilters(container, state, counts, onChange) {
  container.replaceChildren(
    ...CATEGORIES.map((category) => {
      const count = counts.get(category.id) ?? 0;
      const chip = el('button', 'chip');
      chip.type = 'button';
      chip.disabled = count === 0;
      chip.setAttribute('aria-pressed', String(state.has(category.id)));
      chip.appendChild(el('span', 'chip__icon', category.icon));
      chip.appendChild(el('span', null, category.label));
      chip.appendChild(el('span', 'chip__count', String(count)));
      chip.addEventListener('click', () => {
        if (state.has(category.id)) state.delete(category.id);
        else state.add(category.id);
        onChange();
      });
      return chip;
    })
  );
}
