// Reusable regression checks. CI isolates external services; --live verifies real media.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser_runtime.mjs";
import { installBrowserNetwork } from "./lib/browser_network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const live = process.argv.includes("--live");
const option = (name) => {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  assert.ok(process.argv[index + 1] && !process.argv[index + 1].startsWith("--"), `${name} needs a value`);
  return process.argv[index + 1];
};
const expectedDate = option("--expected-date");
const networkMode = option("--network-mode") || "direct";
const serveRoot = path.resolve(root, option("--serve-dir") || ".");
const editions = JSON.parse(await readFile(path.join(root, "data/editions.json"), "utf8"));
const calendar = JSON.parse(await readFile(path.join(root, "data/upcoming-events.json"), "utf8"));
const editorial = JSON.parse(await readFile(path.join(root, "poi/data/editorial-pois.json"), "utf8"));
const artifacts = process.env.SMOKE_ARTIFACT_DIR || await mkdtemp(path.join(tmpdir(), "london-smoke-"));
await mkdir(artifacts, { recursive: true });
const start = performance.now();
const failures = [];
const results = [];
const consoleByViewport = {};
const startedAt = new Date().toISOString();
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const target = path.resolve(serveRoot, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
    if (!target.startsWith(`${serveRoot}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(target);
    response.writeHead(200, { "Content-Type": mime[path.extname(target)] || "application/octet-stream" });
    response.end(body);
  } catch {
    if (!response.headersSent) response.writeHead(404);
    response.end();
  }
});
const suppliedUrl = option("--base-url");
let baseUrl = suppliedUrl;
if (!baseUrl) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
}
if (!baseUrl.endsWith("/")) baseUrl += "/";
const origin = new URL(baseUrl).origin;
const local = (file) => new URL(file, baseUrl).href;
const pixel = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="#e5e9ef"/></svg>';
const browser = await launchBrowser({ channel: option("--channel") || process.env.PLAYWRIGHT_CHANNEL || undefined }).catch((error) => {
  server.close();
  throw error;
});

async function check(name, operation, page) {
  const started = performance.now();
  const result = { name, status: "passed" };
  try {
    await operation();
    console.log(`PASS ${name} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
  } catch (error) {
    result.status = "failed";
    result.error = error.message;
    failures.push(`${name}: ${error.message}`);
    if (page) {
      result.failureScreenshot = `${name.replace(/[^a-z0-9]+/gi, "-")}-failed.png`;
      try {
        await page.screenshot({ path: path.join(artifacts, result.failureScreenshot), timeout: 5000 });
      } catch (screenshotError) {
        result.screenshotError = screenshotError.message;
      }
    }
    console.error(`FAIL ${name}: ${error.message.split("\n")[0].slice(0, 240)} (details in report.json)`);
  } finally {
    result.durationSeconds = Number(((performance.now() - started) / 1000).toFixed(3));
    if (page) result.pageUrl = page.url();
    results.push(result);
  }
}

async function healthy(page, name) {
  assert.ok((await page.title()).length > 3, `${name}: page title`);
  assert.ok((await page.locator("body").innerText()).trim().length > 100, `${name}: meaningful content`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  assert.equal(overflow, false, `${name}: horizontal overflow`);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
}

async function homepage(page, viewportName) {
  await page.goto(local("index.html"), { waitUntil: "domcontentloaded" });
  if (expectedDate) {
    assert.match(expectedDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(editions.issues.today.stories.every(({ id }) => id.startsWith(`${expectedDate}-`)), "expected publication date");
  }
  for (const day of ["today", "yesterday", "day-before"]) {
    await check(`${viewportName} edition ${day}`, async () => {
    await page.locator(`#tab-${day}`).click();
    assert.equal(await page.locator(`#tab-${day}`).getAttribute("aria-selected"), "true");
    const issue = editions.issues[day];
    const panel = page.locator(`#${day}`);
    assert.ok(await panel.isVisible());
    assert.equal((await page.locator("#issue-line").textContent()).replace(/\s+/g, " ").trim(), issue.label);
    assert.equal(await panel.locator(".story").count(), 10);
    assert.deepEqual(await panel.locator(".section-label").allTextContents(), issue.stories.map(({ section }) => section));
    if (day === "today") assert.deepEqual(issue.stories.map(({ section }) => section.toLowerCase()), ["near home", "near home", "near home", "near home", "near work", "near work", "london ai", "london technology", "plan ahead", "plan ahead"]);
    for (const story of issue.stories) {
      const article = panel.locator(`[data-story-id="${story.id}"]`);
      assert.equal(await article.locator("h2").innerText(), story.headline);
      assert.deepEqual(await article.locator(".source-link").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), story.sources.map(([, url]) => url));
      assert.ok((await article.locator("img").getAttribute("alt"))?.trim());
      assert.ok((await article.locator(".image-credit").innerText()).trim());
      if (["Book", "Participate"].includes(story.action) && story.actionUrl) {
        assert.equal(await article.locator("a.action-link").getAttribute("href"), story.actionUrl);
        assert.equal(await article.locator("a.action-link").evaluate((link) => parseFloat(getComputedStyle(link).borderTopWidth) > 0), true);
      } else if (story.action) {
        assert.equal(await article.locator(".action-plain").textContent(), story.action);
        assert.equal(await article.locator("a.action-link").count(), 0);
      }
    }
    await panel.locator("img").evaluateAll((images) => images.forEach((image) => { image.loading = "eager"; }));
    await page.waitForFunction((id) => [...document.querySelectorAll(`#${id} .story img`)].every((image) => image.complete), day, { timeout: 30000 });
    const broken = await panel.locator("img").evaluateAll((images) => images.filter((image) => !image.naturalWidth).map((image) => image.src));
    assert.deepEqual(broken, [], `${day}: broken editorial images (${live ? "live" : "fixture"})`);
    await healthy(page, `${viewportName}-${day}`);
    }, page);
  }
  await page.locator("#tab-today").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#tab-yesterday").getAttribute("aria-selected"), "true");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.locator("#tab-today").getAttribute("aria-selected"), "true");
  const footer = page.locator("footer.site-footer");
  assert.deepEqual(await footer.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), ["upcoming-events.html", "about.html", "resources.html"]);
  assert.equal(await page.locator("#today .morning a[href='poi/']").count(), 1);
  await footer.locator("a[href='upcoming-events.html']").click();
  assert.equal(new URL(page.url()).pathname, new URL(local("upcoming-events.html")).pathname);
}

async function eventsPage(page, viewportName) {
  await page.goto(local("upcoming-events.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#calendarUpdated").dateTime !== "");
  assert.equal(await page.locator("#calendarUpdated").getAttribute("datetime"), calendar.updatedAt);
  const today = await page.evaluate(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const future = calendar.events.filter((event) => (event.endDate || event.startDate) >= today).sort((a, b) => `${a.startDate}T${a.time || "00:00"}`.localeCompare(`${b.startDate}T${b.time || "00:00"}`));
  assert.equal(Number(await page.locator("#eventCount").innerText()), future.length);
  assert.equal(await page.locator("#loadError").isVisible(), false);
  // Inspect every stored record in its start month; crowded cells expose a count.
  const months = [...new Set(calendar.events.map(({ startDate }) => startDate.slice(0, 7)))];
  for (const month of months) {
    await page.locator("#monthPicker").evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event("change", { bubbles: true })); }, month);
    assert.equal(await page.locator("#monthPicker").inputValue(), month);
    for (const event of calendar.events.filter(({ startDate }) => startDate.startsWith(month))) {
      const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${event.startDate}T12:00:00Z`));
      const cell = page.getByRole("gridcell", { name: dayLabel, exact: true });
      assert.ok(await cell.count(), `${event.title}: start day is rendered`);
      const button = cell.getByRole("button", { name: `${event.title},`, exact: false });
      if (await button.count()) {
        await button.first().click();
        assert.equal(await page.locator("#dialogTitle").innerText(), event.title);
        assert.ok(await page.locator("#dialogLinks a").count());
        await page.locator("#closeDialog").click();
      } else {
        assert.ok(await cell.locator(".more-events").count(), `${event.title}: represented in crowded-day overflow`);
      }
    }
  }
  await page.locator("#todayButton").click();
  await healthy(page, `${viewportName}-calendar-month`);
  await page.locator("#agendaViewButton").click();
  assert.ok(await page.locator("#agendaWorkspace").isVisible());
  assert.deepEqual(await page.locator("#agendaList .event-copy strong").allTextContents(), future.map(({ title }) => title));
  if (future.length) {
    await page.locator("#agendaList .event-row").first().press("Enter");
    assert.equal(await page.locator("#dialogTitle").innerText(), future[0].title);
    await page.keyboard.press("Escape");
  }
  await page.locator("#eventSearch").fill("no-match-smoke-test-86b1c9");
  assert.equal(await page.locator("#agendaList .event-row").count(), 0);
  await page.locator("#eventSearch").fill("");
  await healthy(page, `${viewportName}-calendar-agenda`);
}

async function companions(page, viewportName) {
  for (const file of ["about.html", "resources.html"]) {
    await page.goto(local(file), { waitUntil: "domcontentloaded" });
    assert.ok(await page.locator("a[href='index.html']").count(), `${file}: newspaper navigation`);
    if (file === "resources.html") {
      const domains = await page.locator("[data-domain]").evaluateAll((cards) => cards.map((card) => card.dataset.domain));
      assert.equal(new Set(domains).size, domains.length);
      assert.ok(domains.length > 0);
    }
    await healthy(page, `${viewportName}-${file.replace(".html", "")}`);
    await page.locator("a[href='index.html']").first().click();
    assert.ok(await page.locator("#tab-today").isVisible());
  }
  await page.locator("#today .morning a[href='poi/']").click();
  assert.equal(new URL(page.url()).pathname, new URL(local("poi/")).pathname);
  await page.locator("#grid .poi").first().waitFor({ timeout: 30000 });
  const chip = page.locator("#filters button:not([disabled])").first();
  const category = await chip.locator("span").nth(1).textContent();
  const selected = await chip.getAttribute("aria-pressed");
  await chip.click();
  const sameCategory = page.locator("#filters button").filter({ has: page.getByText(category, { exact: true }) });
  assert.equal(await sameCategory.getAttribute("aria-pressed"), String(selected !== "true"));
  await sameCategory.click();
  await page.getByRole("button", { name: "Show on map", exact: true }).first().click();
  await page.locator(".leaflet-popup").waitFor();
  await healthy(page, `${viewportName}-poi`);
}

try {
  console.log(`Browser smoke: ${live ? "LIVE external services/media" : "ISOLATED external-service fixtures (not publication acceptance)"}; ${baseUrl}`);
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    const coordinate = editorial.items.find(({ category }) => category !== "listed") || { lat: 51.514843, lon: -0.091321 };
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, timezoneId: "Europe/London", locale: "en-GB", geolocation: { latitude: coordinate.lat, longitude: coordinate.lon }, permissions: ["geolocation"], serviceWorkers: "block" });
    if (live) await installBrowserNetwork(context, { mode: networkMode, additionalHosts: [new URL(baseUrl).hostname, ...Object.values(editions.images).map(image => new URL(image.src).hostname)] });
    if (!live) await context.route("**/*", async (route) => {
      const request = route.request();
      if (new URL(request.url()).origin === origin) return route.continue();
      if (request.resourceType() === "image") return route.fulfill({ contentType: "image/svg+xml", body: pixel });
      if (request.resourceType() === "stylesheet") return route.fulfill({ contentType: "text/css", body: "" });
      return route.fulfill({ contentType: "application/json", body: "{}", headers: { "access-control-allow-origin": "*" } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const entries = [];
    consoleByViewport[viewport.name] = entries;
    page.on("pageerror", (error) => entries.push({ type: "pageerror", pageUrl: page.url(), message: error.message }));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) entries.push({ type: message.type(), pageUrl: page.url(), location: message.location(), message: message.text() });
    });
    await check(`${viewport.name} homepage keyboard and navigation`, () => homepage(page, viewport.name), page);
    await check(`${viewport.name} calendar`, () => eventsPage(page, viewport.name), page);
    await check(`${viewport.name} companions`, () => companions(page, viewport.name), page);
    await check(`${viewport.name} console`, () => {
      const count = entries.filter(({ type }) => type === "error" || type === "pageerror").length;
      assert.equal(count, 0, `${count} console/runtime errors; full entries and page URLs are in report.json`);
    }, page);
    await context.close();
  }
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(path.join(artifacts, "report.json"), JSON.stringify({
    schemaVersion: 1,
    networkMode,
    mode: live ? "live" : "isolated",
    baseUrl,
    expectedDate: expectedDate || null,
    startedAt,
    completedAt: new Date().toISOString(),
    durationSeconds: Number(((performance.now() - start) / 1000).toFixed(3)),
    status: failures.length ? "failed" : "passed",
    results,
    consoleByViewport,
  }, null, 2) + "\n");
  console.log(`Browser evidence: ${artifacts}`);
  console.log(`Browser report: ${path.join(artifacts, "report.json")}`);
  console.log(`Browser smoke elapsed: ${((performance.now() - start) / 1000).toFixed(1)}s`);
}
if (failures.length) {
  console.error(`${failures.length} failed browser checks; inspect report.json and failure screenshots.`);
  process.exitCode = 1;
}
