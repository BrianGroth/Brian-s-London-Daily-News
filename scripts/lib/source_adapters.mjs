// Extraction records exactly what a source says. It never certifies availability or image rights.
import { publicUrl } from './source_access.mjs';
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
export function evidenceContent(body) {
  const clean = body.replace(/<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  return clean.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || clean.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || clean;
}
export function extractEvidence(body, url) {
  const content = evidenceContent(body);
  const text = plainText(content);
  const title = plainText(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const published = body.match(/(?:property|name)=["'](?:article:published_time|datePublished)["'][^>]*content=["']([^"']+)/i)?.[1];
  const actions = [...content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter(m => /\b(?:book(?:ing)?|register|tickets?|participat(?:e|ion))\b/i.test(plainText(m[2])))
    .map(m => { try { return { label: plainText(m[2]).slice(0, 100), url: publicUrl(new URL(plainText(m[1]), url)).href }; } catch { return null; } }).filter(a => a && !/account|sign[ -]?in|log[ -]?in|membership|priority booking|my tickets/i.test(a.label + ' ' + new URL(a.url).pathname)).slice(0, 16);
  // Native Barbican Drupal settings expose booking links before JavaScript renders them.
  function bookingLinks(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (/^(bookingButtonUrl|bookingUrl|ticketUrl)$/i.test(key) && typeof child === 'string') {
        try {
          const target = publicUrl(new URL(child, url));
          if (target.protocol === 'https:' && !target.username && !target.password && !actions.some(a => a.url === target.href) && actions.length < 16)
            actions.push({ label: 'Booking link from native page settings', url: target.href });
        } catch { /* Malformed settings are not usable action links. */ }
      } else bookingLinks(child);
    }
  }
  for (const settings of body.matchAll(/<script\b[^>]*data-drupal-selector=["']drupal-settings-json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { bookingLinks(JSON.parse(settings[1])); } catch { /* Keep the raw source for manual review. */ }
  }
  const snippets = [...text.matchAll(/[^.!?]{0,120}(?:\u00a3\s*\d|\b(?:free|sold out|cancelled|no booking|registration|pay what you can|\d{1,2}[:.]\d{2}\s*(?:am|pm)))[^.!?]{0,180}/gi)].map(m => m[0].trim()).slice(0, 20);
  const events = structuredEvents(body, url);
  const unique = values => [...new Set(values.filter(Boolean))];
  const observations = pattern => unique([...text.matchAll(pattern)].map(m => m[0].trim())).slice(0, 8);
  const offers = events.flatMap(e => Array.isArray(e.offers) ? e.offers : e.offers ? [e.offers] : []);
  const fields = {
    dates: unique([...events.flatMap(e => [e.event_start, e.event_end]), ...observations(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December)(?: \d{4})?\b/gi)]),
    times: observations(/\b\d{1,2}[:.]\d{2}\s*(?:am|pm|GMT|BST)?\b/gi),
    venue: unique(events.map(e => typeof e.venue === 'string' ? e.venue : '')),
    prices: unique([...offers.filter(o => o.price !== undefined).map(o => `${o.priceCurrency || ''} ${o.price}`.trim()), ...observations(/\u00a3\s*\d+(?:[.,]\d{2})?(?:\s*(?:per person|per adult|donation))?|\bfree (?:entry|admission|tickets?)\b/gi)]),
    audience: observations(/[^.!?]{0,60}\b(?:members only|open to all|aged? \d+(?:[\u2013-]\d+)?|under[ -]\d+|students only|staff only|accompanied by an adult)[^.!?]{0,100}/gi),
    availability: observations(/[^.!?]{0,60}\b(?:sold out|few tickets left|only \d+ tickets? (?:are )?(?:available|left)|no booking (?:is )?(?:required|needed)|registration (?:is )?open|tickets? (?:are )?available)[^.!?]{0,100}/gi),
    cancellation: unique([...events.map(e => e.event_status).filter(v => /cancel|postpon|reschedul/i.test(v || '')), ...observations(/[^.!?]{0,60}\b(?:cancelled|canceled|postponed|rescheduled)[^.!?]{0,100}/gi)]),
    bookingUrl: actions[0]?.url || null,
  };
  const unknownFields = Object.entries(fields).filter(([,v]) => v === null || Array.isArray(v) && !v.length).map(([k]) => k);
  const conflicts = [];
  if (fields.venue.length > 1) conflicts.push('Multiple venue statements; identify the selected event.');
  if (fields.availability.some(v => /sold out/i.test(v)) && fields.availability.some(v => /tickets? (?:are )?available/i.test(v))) conflicts.push('Both sold-out and available statements occur; inspect the selected session.');
  return { title, published, structuredEvents: events, actions, snippets, fields, unknownFields, conflicts, textExcerpt: text.slice(0, 2400),
    note: 'Extracted statements, not verified availability. Inspect saved raw evidence where extraction is incomplete.' };
}
