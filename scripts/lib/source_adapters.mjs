// Extraction records exactly what a source says. It never certifies availability or image rights.
export function plainText(value = '') {
  return String(value).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|nbsp|quot|apos|lt|gt);/g, x => ({ '&amp;': '&', '&nbsp;': ' ', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' })[x])
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => String.fromCodePoint(parseInt(n[0].toLowerCase() === 'x' ? n.slice(1) : n, n[0].toLowerCase() === 'x' ? 16 : 10)))
    .replace(/\s+/g, ' ').trim();
}
function eventsIn(value) {
  if (Array.isArray(value)) return value.flatMap(eventsIn);
  if (!value || typeof value !== 'object') return [];
  return [...(Array.isArray(value['@type']) ? value['@type'] : [value['@type']]).some(x => /Event$/.test(x || '')) ? [value] : [], ...Object.values(value).flatMap(eventsIn)];
}
export function structuredEvents(html, sourceUrl) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match => {
    try { return eventsIn(JSON.parse(match[1])); } catch { return []; }
  }).map(e => ({ title: plainText(e.name), link: new URL(e.url || sourceUrl, sourceUrl).href,
    event_start: e.startDate, event_end: e.endDate, event_status: e.eventStatus,
    venue: typeof e.location === 'object' ? e.location.name : e.location,
    offers: e.offers, summary: plainText(e.description).slice(0, 1600),
    geo: e.location?.geo, address: e.location?.address })).filter(e => e.title && e.event_start);
}
export function listingLinks(html, sourceUrl, pattern) {
  const found = new Map();
  for (const match of html.matchAll(/<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
    let link; try { link = new URL(plainText(match[2]), sourceUrl).href; } catch { continue; }
    if (!pattern.test(new URL(link).pathname) || new URL(link).hostname !== new URL(sourceUrl).hostname) continue;
    const title = plainText(match[1].match(/aria-label=["']([^"']+)["']/i)?.[1] || match[3]);
    if (title.length < 5 || /^(find out more|read more|book tickets|view event)$/i.test(title)) continue;
    if (!found.has(link) || title.length > found.get(link).title.length) found.set(link, { title: title.slice(0, 200), link, summary: '', event_start: null });
  }
  return [...found.values()];
}
export function heathEvents(payload, sourceUrl, now) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(now));
  return (payload.upcoming || []).map(e => {
    const start = new Date(e.startDate).toISOString(), end = new Date(e.endDate || e.startDate).toISOString();
    const localEnd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(end));
    return { title: plainText(e.title), link: new URL(`/whatson/${e.urlId}`, sourceUrl).href, event_start: start, event_end: end,
      summary: plainText(e.body).slice(0, 1600), venue: e.location?.addressTitle || e.location?.venueName };
  }).filter(e => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(e.event_end)) >= today);
}
export const activitySources = [
  { id: 'heath-hands', name: 'Heath Hands', section: 'Near Home', url: 'https://www.heath-hands.org.uk/whatson?format=json', type: 'heath' },
  { id: 'hampstead-theatre', name: 'Hampstead Theatre', section: 'Near Home', url: 'https://www.hampsteadtheatre.com/whats-on/', pattern: /^\/production\/[\w-]+\/?$/ },
  { id: 'barbican', name: 'Barbican', section: 'Near Work', url: 'https://www.barbican.org.uk/whats-on', pattern: /^\/whats-on\/\d{4}\/event\/[\w-]+\/?$/ },
  { id: 'city-events', name: 'City of London', section: 'Plan Ahead', url: 'https://www.cityoflondon.gov.uk/events', pattern: /^\/events\/[\w-]+\/?$/ },
];
export function extractSource(source, body, now = Date.now()) {
  if (source.type === 'heath') return heathEvents(JSON.parse(body), source.url, now);
  const structured = structuredEvents(body, source.url);
  const links = listingLinks(body, source.url, source.pattern);
  return [...structured, ...links.filter(e => !structured.some(s => s.link === e.link))];
}
export function extractEvidence(body, url) {
  const text = plainText(body);
  const title = plainText(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const published = body.match(/(?:property|name)=["'](?:article:published_time|datePublished)["'][^>]*content=["']([^"']+)/i)?.[1];
  const actions = [...body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter(m => /book|register|ticket|participat/i.test(plainText(m[2])))
    .map(m => { try { return { label: plainText(m[2]).slice(0, 100), url: new URL(plainText(m[1]), url).href }; } catch { return null; } }).filter(Boolean).slice(0, 16);
  // Native Barbican Drupal settings expose booking links before JavaScript renders them.
  function bookingLinks(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (/^(bookingButtonUrl|bookingUrl|ticketUrl)$/i.test(key) && typeof child === 'string') {
        try {
          const target = new URL(child, url);
          if (target.protocol === 'https:' && !target.username && !target.password && !actions.some(a => a.url === target.href) && actions.length < 16)
            actions.push({ label: 'Booking link from native page settings', url: target.href });
        } catch { /* Malformed settings are not usable action links. */ }
      } else bookingLinks(child);
    }
  }
  for (const settings of body.matchAll(/<script\b[^>]*data-drupal-selector=["']drupal-settings-json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { bookingLinks(JSON.parse(settings[1])); } catch { /* Keep the raw source for manual review. */ }
  }
  const snippets = [...text.matchAll(/[^.!?]{0,120}(?:\b(?:£\d|free|sold out|cancelled|no booking|registration|pay what you can|\d{1,2}[:.]\d{2}\s*(?:am|pm)))[^.!?]{0,180}/gi)].map(m => m[0].trim()).slice(0, 20);
  return { title, published, structuredEvents: structuredEvents(body, url), actions, snippets, textExcerpt: text.slice(0, 1200),
    note: 'Extracted statements, not verified availability. Inspect saved raw evidence where extraction is incomplete.' };
}
