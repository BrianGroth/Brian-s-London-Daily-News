import { publicUrl } from './source_access.mjs';
import { launchBrowser } from './browser_runtime.mjs';

export function availabilityProvider(value) {
  const u = publicUrl(value), h = u.hostname;
  if (h === 'heathhands.beaconforms.com' && u.pathname.startsWith('/form/')) return 'beacon';
  if (/^(?:www\.)?eventbrite\.(?:co\.uk|com)$/.test(h) && u.pathname.startsWith('/e/')) return 'eventbrite';
  if (h === 'ucl.zoom.us' && /\/webinar\/register\//.test(u.pathname)) return 'zoom';
  if (h === 'www.barbican.org.uk' && u.pathname.startsWith('/whats-on/')) return 'barbican';
  throw new Error('No read-only availability adapter for this URL.');
}
export function availabilityObservation(provider, text, checkedAt = new Date().toISOString()) {
  const statements = [...text.matchAll(/[^\n.!?]{0,100}(?:sold out|few tickets left|only \d+ tickets? (?:are )?(?:available|left)|limited availability|\bAvailable\b|registration (?:is )?open|Webinar Registration|Choose your tickets|Reserve a spot)[^\n.!?]{0,100}/gi)].map(m => m[0].trim()).slice(0, 12);
  const sold = statements.some(s => /sold out/i.test(s));
  const available = statements.some(s => /few tickets left|only \d+ tickets? (?:are )?(?:available|left)|^Available$|registration (?:is )?open/i.test(s));
  const registration = provider === 'zoom' && /Webinar Registration/.test(text) && /Register/.test(text);
  return { provider, checkedAt, status: sold && available ? 'conflicting' : sold ? 'sold-out' : available ? 'available-statement' : registration ? 'registration-form-open' : 'unknown', statements,
    note: 'Read-only page observation, not a reservation or guarantee for a selected session. Unknown means the provider needs manual review.' };
}
export async function observeAvailability(value, { blockedDomains = [], browserFactory = launchBrowser, now = () => new Date().toISOString() } = {}) {
  const provider = availabilityProvider(value);
  const permitted = value => {
    const u = publicUrl(value);
    const h = u.hostname.replace(/^www\./, '');
    if (blockedDomains.some(d => h === d || h.endsWith('.' + d))) throw new Error('Source is blocked in resources.html');
    if (/\/(?:account|login|signin|checkout|orders)(?:\/|$)/i.test(u.pathname)) throw new Error('Account and checkout requests are refused.');
    return u;
  };
  permitted(value);
  let browser, context, requests = 0, blockedRequests = 0;
  try {
    browser = await browserFactory();
    context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const req = route.request();
      try {
        if (!['GET','HEAD'].includes(req.method())) throw new Error('Read-only requests only');
        permitted(req.url()); requests++;
        const headers = { ...req.headers() }; delete headers.cookie; delete headers.authorization;
        await route.continue({ headers });
      } catch { blockedRequests++; await route.abort(); }
    });
    const page = await context.newPage();
    await page.goto(value, { waitUntil: 'domcontentloaded', timeout: 20000 });
    permitted(page.url());
    if (availabilityProvider(page.url()) !== provider) throw new Error('Provider changed after redirect; manual review required.');
    await page.waitForTimeout(1500);
    // These controls reveal public date/time listings; no reservation controls are used.
    if (provider === 'barbican') {
      const dates = page.getByText('Check dates & book', { exact: true }).first();
      if (await dates.isVisible()) { await dates.click(); await page.waitForTimeout(1000); }
      const times = page.getByText('Choose time', { exact: true }).first();
      if (await times.isVisible()) { await times.click(); await page.waitForTimeout(750); }
    }
    const text = await page.locator('body').innerText();
    return { ...availabilityObservation(provider, text, now()), url: page.url(), textExcerpt: text.slice(-12000), metrics: { browserRequests: requests, blockedRequests } };
  } catch (error) {
    return { provider, checkedAt: now(), status: 'unknown', statements: [], error: error.message.split('\n')[0], metrics: { browserRequests: requests, blockedRequests } };
  } finally { await context?.close(); await browser?.close(); }
}
