# Nearby Explorer — Product & Architecture

**Status:** v4, August 2026
**Repository:** [BrianGroth/POI](https://github.com/BrianGroth/POI)
**Live:** <https://briangroth.github.io/POI/>

---

## 1. What this is

A phone-first web app that answers one question: **"what is historically interesting within walking distance of where I am standing right now?"**

It is built for walking around London. The defining use case is turning a corner in Soho and being told that the building in front of you carries a blue plaque for Charles Bridgeman, that the Broad Street cholera pump is 35 m south, and that the pub on the corner is Grade II listed.

### Product goals

1. **Zero interaction to first value.** Open the app, and the map centres on you with the nearest interesting things already pinned. No search box, no login, no configuration.
2. **Tell the story, not just the name.** A pin labelled "Percy Bysshe Shelley" is useless. The plaque's own inscription — *"Percy Bysshe Shelley 1792 - 1822 Poet lived here in 1811"* — is the product.
3. **Small history counts as much as big.** A kerbstone marking a vanished street matters as much as St Paul's. Coverage of the obscure is the differentiator.
4. **Work on a phone, on mobile data, sometimes with no signal.**
5. **Show distance spatially, not just as a number.** The map is the first thing the user sees, because "how far is that from me" is answered faster by a pin's position than by reading a metre count. The ranked list underneath is where the story-telling happens.

### Non-goals

- Not a trip planner, guide-book, or social product. No accounts, no saved lists, no reviews.
- Not turn-by-turn navigation. The map shows what is around you; walking directions are handed off to Google Maps.
- Not global-first. It works anywhere OSM and Wikipedia have coverage, but London is the design target and two sources are specifically English or London-wide.

---

## 2. Users and context

| | |
|---|---|
| **Primary user** | A resident or visitor walking around central London, phone in hand, on mobile data. |
| **Session shape** | 10–60 seconds. Glance, read a plaque, maybe tap "Walk here", pocket the phone, walk on. |
| **Environment** | Bright sun or dark evening; patchy signal; one-handed use. |
| **Density** | Central London returns 300–500 candidate places within 800 m. Ranking and filtering matter more than retrieval. |

Design consequences: dark mode is not a nicety, touch targets are ≥40 px, distances are metric (UK street-level convention), and the app re-ranks as the user walks without re-querying anything.

---

## 3. Data sources

All live discovery sources are free, keyless and CORS-enabled. Two bulk sources
are stored as compact, versioned London snapshots so the browser does not repeatedly
download nationwide data. There is no backend.

### 3.1 OpenStreetMap via Overpass API — *primary*

`POST https://overpass-api.de/api/interpreter` (fallback: `overpass.kumi.systems`)

The densest source for London plaques and small history. Provides ~500 places per 800 m in central London.

The query is in [js/sources/overpass.js](js/sources/overpass.js). Two design points:

- **Two clauses omit the `["name"]` filter** (`["historic"]` and `["memorial"]`). Most plaques are named, but a minority carry only an `inscription` — roughly 12 of 517 in a 1 km Soho sample — and those are exactly the obscure ones worth surfacing.
- **`out center;` carries no element limit.** Capping the server response truncates in Overpass's *internal* order, not by distance. See §8.

Tags consumed:

| Tag | Use |
|---|---|
| `inscription` | The card's headline content. Present on ~56 of 60 sampled plaques. |
| `subject:wikidata` | The **person** commemorated — used for portrait, biography, and article link. |
| `wikidata` | The plaque or building itself, when present. |
| `erected_by`, `scheme` | Attribution line ("English Heritage", "City of Westminster Green Plaques"). |
| `openplaques:id` | Adds a direct OpenPlaques detail link to the card. |

### 3.2 Wikipedia GeoSearch — *complementary*

`GET https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&…`

Reaches a layer OSM structurally cannot: historical **events** and streets with no mappable object. Standing on Broadwick Street it returns *"1854 Broad Street cholera outbreak"* at 32 m, which exists in no POI database.

One request returns coordinates, intro extract, thumbnail and canonical URL together. Two parameters are load-bearing:

- `colimit=50` — defaults to **10**, which silently returns half the pages without coordinates, making them undistanceable.
- `exlimit=20` — TextExtracts caps anonymous callers at 20, which sets the page limit for the whole call.

### 3.3 Wikidata — *enrichment, not discovery*

`GET https://www.wikidata.org/w/api.php?action=wbgetentities&…` — 50 ids per call.

Resolves ids already found in OSM tags into descriptions, images and article links. It is never used to *find* places.

For a plaque the useful entity is usually `subject:wikidata`, so the card shows the commemorated person's portrait and one-line biography, and links to *their* article.

### 3.4 Historic England — National Heritage List for England

`GET https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/…/FeatureServer/0/query`

Every listed building, scheduled monument and registered park in England. Updated daily, Open Government Licence. This is the "small to big" layer — individual Carnaby Street addresses alongside the Palace of Westminster.

Two implementation notes:

- The service accepts and returns WGS84 via `inSR`/`outSR`, so no British National Grid (EPSG:27700) conversion is needed despite the underlying data being projected.
- Layer 0 is typed `esriGeometryMultipoint`. Coordinates arrive as `geometry.points[[lon, lat]]`, **not** `geometry.x/y`.

Central London runs to hundreds of Grade II listings per square kilometre, so this category is **off by default** — it would otherwise bury the plaques.

### 3.5 City of London heritage and Hampstead Heath postcards

`GET https://www.mapping.cityoflondon.gov.uk/arcgis/rest/services/INSPIRE/MapServer/{layer}/query`

The Corporation's public live map adds locally curated heritage buildings,
bridges, landscapes, monuments, statuary and City blue plaques around EC2N.
Its Historic Postcard
Locations layer is especially valuable around NW3: it places views from the
Hampstead Heath Historic Postcard Project at the location they depict.

These records receive their own **Historic views** filter and link back to the
official project or City interactive-map directory.

### 3.6 OpenPlaques, GLA culture, Museum Data Service and editorial discoveries

- **OpenPlaques** is now a full discovery layer. Its public-domain London dump is
  reduced to IDs, coordinates and inscriptions in `data/openplaques-london.json`.
- **GLA Cultural Infrastructure Map** is queried live for a focused set of public-facing
  cultural layers. Each layer can fail independently and coordinates are returned as WGS84.
- **Museum Data Service** public museum records are reduced to a London snapshot with
  record links and Wikidata IDs retained for attribution and cross-source merging.
- **Daily News discoveries** live in append-only `data/editorial-pois.json`; the daily
  workflow adds every newly verified, fixed-location POI it encounters.

The two bulk snapshots are refreshed manually with
`node scripts/refresh_poi_snapshots.mjs`. They and the editorial dataset are part of the
service-worker shell, so all three remain available without a signal.

### 3.7 Considered and not used

| Source | Why not |
|---|---|
| **London Remembers** | Broader plaque coverage than Open Plaques, but no public API. |
| **Layers of London** | Valuable historical map overlays, but no stable keyless nearby-POI API was found for the static client. |
| **Wikidata SPARQL geo-search** | Would work, but WDQS rate-limits aggressively and deprioritises callers without a descriptive `User-Agent`, which a browser cannot set. |

---

## 4. Architecture

No framework, no build step, no bundler. One dependency — Leaflet, vendored (not CDN-loaded) so the map still works from the service worker cache with no signal. Everything else is native ES modules served as static files. The whole app is deployable to GitHub Pages by pushing.

```
index.html            App shell, CSP, PWA metadata
manifest.webmanifest  Installability
sw.js                 Offline: cache-first shell, network-first API, cache-first tiles
css/styles.css        Light + dark, mobile-first
vendor/leaflet/       Leaflet 1.9.4, vendored

js/
  app.js              Orchestrator: geolocation, progressive load, rank, render
  config.js           Every tunable constant
  lib/
    geo.js            Haversine, bearing, formatting        (pure, tested)
    merge.js          Cross-source deduplication            (pure, tested)
    categories.js     Category taxonomy + OSM tag mapping   (pure, tested)
    http.js           fetch + timeout + endpoint fallback + URL validation
    cache.js          localStorage tile cache with TTL and eviction
  sources/
    overpass.js       OpenStreetMap (3-mirror fallback chain)
    wikipedia.js      Wikipedia GeoSearch
    historicengland.js  NHLE listed buildings
    cityoflondon.js   City heritage + Hampstead Heath historic views
    gla.js            Live GLA cultural-infrastructure layers
    openplaques.js    Local London plaque snapshot
    museumdata.js     Local London museum snapshot
    editorial.js      Append-only Daily News discoveries
    snapshot.js       Shared nearby filtering for local data
  enrich/
    wikidata.js       Batched id -> description/image/link
  ui/
    render.js         Card and filter-chip rendering
    status.js         Sole owner of the status region
    map.js            Leaflet wrapper: pins, selection, panning, user position

test/                 node --test, no dependencies
```

### Data flow

```
watchPosition (high accuracy)
        │
        ├─ moved > 150 m ?  ── no ──▶ re-rank + re-plot only, zero network
        │                yes
        ▼
  loadPOIs(): every live and snapshot-backed source
  independently, rendered the instant it lands — NOT awaited as a set
        │   each wrapped in a localStorage tile cache
        ▼
  mergePOIs()          collapse the same place across sources, on every landing
        ▼
  rank()               distance + bearing from the live fix, sorted
        ▼
  filter by category
        ├──────────────┬─────────────────────
        ▼                              ▼
  slice to visible page          full matching set
        ▼                              ▼
  renderPOIs()  cards on screen   setMarkers()  every pin on the map
        ▼
  enrichWithWikidata() visible cards only, batched 50/request → re-render
```

**Two deliberate asymmetries:**

- **Sources render independently, not as a set.** `loadPOIs()` fires all three fetches and lets each update the screen on its own arrival — it does not `await` or `Promise.allSettled` the group before painting anything. Wikipedia typically answers in under a second; Overpass can take 18 s per mirror across a 3-mirror fallback chain. Awaiting the slowest source meant a healthy fast response sat behind a spinner for its duration. Each source still degrades independently — one failing does not empty the screen, and the status line names which source is missing.
- **The map is not paginated; the list is.** `renderPOIs()` gets the visible page (`PAGE_SIZE`, "Show more" to extend); `setMarkers()` gets every POI matching the active filters, always. The map's job is showing the user where everything nearby actually is — capping it to the same 20-odd cards on screen would hide real pins for no reason. Both draw from the same ranked, filtered array, so list and map can never disagree about what counts as "nearby right now".

### The POI model

Every source normalises to one shape, which is what makes merging and ranking source-agnostic:

```js
{
  id: 'osm:node/123',          // or 'wikipedia:456', 'nhle:1063903'
  source: 'osm' | 'wikipedia' | 'nhle',
  name: 'Percy Bysshe Shelley',
  categories: ['plaque'],      // an array — merged records can hold several
  lat, lon,
  inscription: 'Percy Bysshe Shelley 1792 - 1822 Poet lived here in 1811',
  description: null,
  imageUrl: null,
  links: [{ url, label }],
  meta: { wikidataId, subjectWikidataId, erectedBy, scheme, openPlaquesId, grade, listEntry }
}
```

`distance` and `bearing` are **not** stored on the model. They are recomputed from the live GPS fix on every render, which is what lets the ordering stay correct as the user walks without re-querying anything.

### Merging

Records are collapsed when they describe the same real-world place, matched in order of confidence: identical source id → shared Wikidata ID → shared OpenPlaques ID → same normalised name within **45 m**.

Name normalisation drops apostrophes rather than replacing them with spaces, because Historic England writes `ST ANNES CHURCH` where OSM has `St Anne's Church`.

On collision, OSM wins for prose (an inscription beats a generic blurb), gaps are filled from the loser, and **categories are unioned** — a listed building that also carries a plaque survives either filter.

### Categories

`plaque`, `historic`, `museum`, `culture`, `article`, `green`, `worship` and
`postcard` are on by default; `listed` is off. Chips show live counts and disable at zero.

---

## 5. Caching and offline

Three layers, each solving a different problem:

| Layer | Scope | Purpose |
|---|---|---|
| **localStorage tile cache** (24 h TTL) | Source responses keyed by `source:lat,lon:radius`, rounded to ~110 m | Overpass enforces per-IP quotas; walking one street re-enters the same tile constantly. Halves-and-evicts on quota error. |
| **Service worker — shell** | Cache-first | App opens instantly and works with no signal. |
| **Service worker — API** | Network-first, cache fallback | Fresh when there is signal, last-known when there is not. GETs only; the Overpass POST is never intercepted. |
| **Service worker — map tiles** | Cache-first, versionless, capped at 600 tiles | Ground already covered stays instant and works underground; capped so a long walk cannot fill the device. Kept outside the versioned shell cache so a deploy never evicts tiles you already paid the data cost for. |

Measured: one Soho tile across all three sources occupies ~237 KB of localStorage.

> **Deployment constraint.** The shell is cache-first, so `VERSION` in [sw.js](sw.js) **must be bumped on every deploy that touches a shell asset**. Without it, returning users keep the old HTML/CSS/JS indefinitely — editing a file and pushing ships nothing to anyone who has already installed the app. This was confirmed during development: a CSS change was invisible in the browser until the service worker cache was cleared.

---

## 6. Performance

| Decision | Effect |
|---|---|
| Commons thumbnails at `?width=400` | **602 KB → 33 KB** for one sampled image — 18× per card, on mobile data. |
| Batched `wbgetentities`, 50 ids/request | Replaces one SPARQL request *per POI*. |
| Enrichment scoped to visible cards | A 1 km London query carries 300+ Wikidata ids; only ~24 are on screen. |
| No `>; out skel qt;` recursion in Overpass | The v1 query pulled every child node of every way and relation. |
| `loading="lazy"`, `decoding="async"` | Off-screen images never fetch. |
| Re-rank without re-query under 150 m | Walking a street costs zero requests. |

---

## 7. Security, privacy, accessibility

**Security.** Third-party strings reach `src` and `href` attributes, so every URL passes `safeHttpsUrl()` — parsed with `URL`, upgraded to https, and rejected unless the final protocol is https. This closes a `javascript:` injection path. A `Content-Security-Policy` meta tag pins the reachable hosts, with `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`. All text is written via `textContent`; the app never assembles HTML from data.

**Privacy.** No analytics, no cookies, no accounts, no backend. Coordinates go only to the live public APIs, in the request path only. Snapshot filtering happens entirely on the device. Everything cached is local.

**Accessibility.** Verified in-browser: all text ≥ 4.5:1 contrast in **both** light and dark (lowest measured 5.5:1 light, 6.65:1 dark). Status region is `role="status" aria-live="polite"`. Chips are real `<button>`s with `aria-pressed`. Visible focus rings. Touch targets ≥ 40 px. `prefers-reduced-motion` disables the loading animation and transitions. No horizontal page scroll at 375 px.

---

## 8. What changed from v1, and why

v1 was a single 525-line `index.html`. It worked, but its pipeline discarded almost everything it fetched. Measured standing on Broadwick Street, Soho:

| Stage | POIs surviving |
|---|---|
| Matched the Overpass query | **565** |
| After `out center 24` | 24 — arbitrary, *not* nearest |
| After `.filter(poi => poi.wikidataId)` | ~9 |
| Displayed | 6 |

**Three compounding defects:**

1. **Truncation before sorting.** `out center 24` capped the response in Overpass's internal order; the code then sorted *those 24* by distance. The sort ranked an arbitrary sample.

2. **`wikidataId` filter deleted the plaques.** Of 214 plaques in range, only 32 carry a `wikidata` tag — the plaque's *subject* is the notable thing. 106 carried `subject:wikidata`, which v1 never read. Every one was dropped.

3. **`inscription` was never read** — the single most valuable field in the response.

The user-visible result:

```
v1 showed                       v2 shows
460m  The Horses of Helios      25m   Social Eating House
495m  William Pitt the Younger  30m   1854 Broad Street cholera outbreak
540m  Sotheby's Auction House   35m   Broad Street Pump
555m  The Fine Art Society      35m   Charles Bridgeman  ← plaque + inscription
570m  Shakespeare               35m   Dr John Snow
658m  Seven Dials               35m   The Red Granite kerbstone…  ← no name tag
```

v1 sent you 500 m away while ignoring the Broad Street cholera pump 35 m from your feet.

Also fixed: N+1 SPARQL → batched; full-resolution images → thumbnails; OS-sniffed `comgooglemaps://` links that dead-end when Google Maps is not installed → universal https URLs with walking directions; unvalidated URLs → `safeHttpsUrl`; latitude `0` treated as missing; a status element that could never be shown again once hidden.

### v2 → v3

v2 awaited all three sources as a set before rendering anything, and had no map. Two changes:

- **Progressive rendering.** `loadPOIs()` now lets each source paint the instant it lands rather than waiting for the slowest. Measured live: Wikipedia rendered 20 places at **831 ms**; on the same load, Overpass exhausted an 18 s timeout against all three of its fallback mirrors before giving up. Under the old await-the-set code that 18 s of dead air sat in front of the Wikipedia result too. Under the new code the user has something to read in under a second regardless of what Overpass is doing.
- **A Leaflet map is now the first thing the page shows**, centred on the user with a pin per matching POI, colour-coded by category, distance and inscription in the popup. The ranked list is unchanged and sits below it. The map draws from the same filtered, ranked array as the list — they cannot disagree.

Also added: a third Overpass mirror (`overpass.private.coffee`) to the fallback chain, after confirming in-browser that a plausible fourth candidate — `overpass.osm.ch` — is a Switzerland-only extract that answers a London query with HTTP 200 and zero results, which would have looked indistinguishable from "genuinely nothing nearby" rather than a failure.

---

## 9. Testing

`npm test` — 23 tests, `node --test`, no dependencies. Covers the pure layer:
geodesics, formatting, cache tiling, OSM and City of London element mapping,
category assignment, cross-source merging, and a regression test pinning
**sort-before-truncate**.

Two bugs were caught by these tests during development, one of them real: name normalisation split `St Anne's` into `st anne s`, which would have stopped OSM and Historic England records for the same church ever merging.

Not covered: network layers and DOM rendering, both exercised manually in-browser against live APIs.

---

## 10. Known limitations

- **Wikipedia is capped at 20 results** per query by the anonymous `exlimit`. Fine at 800 m; would need pagination at a larger radius.
- **Historic England caps at 250 features**, and central London exceeds that. The nearest 250 are correct, but the chip count understates the true total.
- **localStorage is synchronous** and ~5 MB. At ~237 KB per tile that is roughly 20 tiles before eviction. IndexedDB would be the upgrade.
- **No compass heading.** Bearings are true north; the card and map popup say "35 m · SW" but the map does not rotate with the phone.
- **England only** for listed buildings. Scotland and Wales have equivalent registers, not yet wired in.
- **The map is not marker-clustered.** With Listed buildings enabled, up to 250 pins render individually; at low zoom in dense areas they overlap. Fine for the default categories (a few dozen pins); worth clustering if listed buildings become on-by-default.
- **Public OSM tile servers have a usage policy**, not a guaranteed SLA — same caveat as the Overpass mirrors. The tile cache mitigates repeat load, not first load during an outage.
- **Overpass reliability remains the app's weakest dependency.** Verified live during v3 development: `overpass-api.de` alone flipped between sub-second responses and full outages within the same hour, and `overpass.kumi.systems` / `overpass.private.coffee` both timed out at 18 s in the same run that `overpass-api.de` had answered a minute earlier. All three mirrors failing simultaneously is rare but not impossible; when it happens the plaque and listed-building layers are empty and only Wikipedia/Historic England-derived pins show. This is the app degrading exactly as designed, but it does mean the plaque coverage — the headline feature — has the least reliable supply of the three sources.

## 11. Possible next steps

1. OpenPlaques image enrichment via the `openplaques:id`; detail links are already live.
2. `DeviceOrientation` compass arrow, so the bearing points as you turn, on both the card and the map's user marker.
3. A "seen it" list in IndexedDB, to fade out places already visited.
4. Historic Environment Scotland / Cadw for coverage beyond England.
5. Radius control — 400 m in the City, 2 km in the suburbs.
6. Marker clustering (`Leaflet.markercluster`) if listed buildings move to on-by-default.
7. A self-hosted Overpass mirror, or a lightweight backend cache in front of it, would remove the app's biggest reliability gap — but that means giving up "no backend," which is currently a deliberate constraint.
