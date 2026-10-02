// Optional managed-proxy bridge. Node verifies TLS; the browser receives real public responses.
// Never use this for authenticated browsing. No browser headers, cookies or account data are forwarded.
import { publicFetch, boundedBody, publicUrl } from './source_access.mjs';
const publicHosts = new Set([
  'upload.wikimedia.org', 'thumb.wikimedia.org', 'commons.wikimedia.org', 'images.unsplash.com',
  'images.squarespace-cdn.com', 'cdn.mos.cms.futurecdn.net', 'article-cns.cnsmedia.com', 'pxl-qmulacuk.terminalfour.net',
  'www.barbican.org.uk', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tile.openstreetmap.org',
  'a.tile.openstreetmap.org', 'b.tile.openstreetmap.org', 'c.tile.openstreetmap.org',
  'en.wikipedia.org', 'www.wikidata.org', 'openplaques.org', 'museumdata.uk',
  'overpass-api.de', 'overpass.kumi.systems', 'overpass.private.coffee', 'services.arcgis.com',
  'services-eu1.arcgis.com', 'www.mapping.cityoflondon.gov.uk', 'gis.london.gov.uk',
  'api.tfl.gov.uk', 'weather.metoffice.gov.uk', 'www.heath-hands.org.uk', 'briangroth.github.io',
]);
export function bridgeRequest(request, additionalHosts = []) {
  const url = publicUrl(request.url());
  if (!publicHosts.has(url.hostname) && !additionalHosts.includes(url.hostname)) return null;
  if (/\/(?:account|customer|basket|login|logout|oauth|auth|checkout|payment)(?:[/?]|$)/i.test(url.pathname)) return null;
  if (request.method() === 'GET') return { url: url.href, method: 'GET' };
  // The application's bounded read-only public map query is the sole POST exception.
  if (request.method() !== 'POST' || !['overpass-api.de', 'overpass.kumi.systems', 'overpass.private.coffee'].includes(url.hostname) || url.pathname !== '/api/interpreter') return null;
  const body = request.postData() || '', params = new URLSearchParams(body), query = params.get('data') || '';
  const geometries = [...query.matchAll(/\(around:(\d+),(\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/g)];
  if ([...params.keys()].join() !== 'data' || query.length >= 2000 || !/^\[out:json\]\[timeout:30\];/.test(query) || !/out center;\s*$/.test(query) ||
      /make|convert|foreach|retro|diff|adiff|timeline|local/i.test(query) || !geometries.length ||
      geometries.some(([, radius, lat, lon]) => Number(radius) > 10000 || Number(lat) < 51 || Number(lat) > 52 || Number(lon) < -1 || Number(lon) > 1)) return null;
  return { url: url.href, method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
}
export async function installBrowserNetwork(context, { mode = 'direct', additionalHosts = [] } = {}) {
  if (mode === 'direct') return;
  if (mode !== 'proxy-bridge') throw new Error('Network mode must be direct or proxy-bridge');
  const responses = new Map();
  await context.route(/^https:\/\//, async route => {
    let operation;
    try { operation = bridgeRequest(route.request(), additionalHosts); } catch { return route.continue(); }
    if (!operation) return route.continue();
    const key = operation.url + (operation.body || '');
    try {
      if (!responses.has(key)) {
        // Same-run memory reuse prevents image reloads hitting rate limits; no stored fixtures.
        if (responses.size > 120) responses.clear();
        responses.set(key, (async () => {
          const { response } = await publicFetch(operation.url, operation);
          const headers = Object.fromEntries(response.headers);
          for (const header of ['content-encoding', 'content-length', 'set-cookie']) delete headers[header];
          return { status: response.status, headers, body: await boundedBody(response, 20_000_000) };
        })());
      }
      await route.fulfill(await responses.get(key));
    } catch { await route.abort('failed'); }
  });
}
