# Nearby Explorer

This app is integrated at `poi/` within Brian's London Daily News and is maintained directly in this repository.

What is historically interesting within walking distance of where you are standing right now — blue plaques, listed buildings, monuments and the stories attached to them.

Built for walking around London. It defaults to your current position, but you
can also drag the map, choose **Search this area**, and investigate any other
part of London. Tap a pin to select a place or use **Show on map** from a card.

<img src="icons/icon-192.png" width="72" alt="">

## Running it

Any static file server will do — but it must be `http://localhost` or `https://`, because geolocation and service workers are unavailable on `file://`.

```bash
npm run serve
```

Then open <http://localhost:8080>. On a phone, use **Add to Home Screen** to install it.

## Tests

```bash
npm test
```

Tests have no dependencies and cover the pure logic: geodesics, distance
formatting, cache tiling, source-record mapping, and
cross-source merging. Network layers and the map are exercised manually
in-browser against live APIs — see [PRD.md](PRD.md#9-testing).

## Deploying

Push to GitHub and enable Pages. There is no build step — no bundler, no framework, no dependencies, just native ES modules served as static files.

⚠️ **Bump `VERSION` in [sw.js](sw.js) whenever you change the HTML, CSS or JS.** The app shell is served cache-first, so without a version bump anyone who has already opened the app keeps the old files and your change reaches nobody.

## Data sources

| Source | Provides | Licence |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org) via [Overpass](https://overpass-api.de) | Plaques, monuments, museums, parks — with inscriptions | ODbL |
| [Wikipedia GeoSearch](https://www.mediawiki.org/wiki/Extension:GeoData) | Historical events and places with no map object | CC BY-SA |
| [Wikidata](https://www.wikidata.org) | Descriptions, portraits, article links | CC0 |
| [Historic England](https://opendata-historicengland.hub.arcgis.com/) | Every listed building in England | OGL v3 |
| [City of London interactive maps](https://www.cityoflondon.gov.uk/footer/interactive-map-layers) | Official heritage assets and City blue plaques near the Square Mile | Public interactive data |
| [Hampstead Heath Historic Postcard Project](https://www.cityoflondon.gov.uk/things-to-do/green-spaces/hampstead-heath/activities-at-hampstead-heath/historic-postcard-project) | Geolocated historic views of the Heath | City of London |
| [OpenPlaques](https://openplaques.org/) | London plaque coordinates and inscriptions from a versioned snapshot | Public domain |
| [GLA Cultural Infrastructure Map](https://data.london.gov.uk/dataset/cultural-infrastructure-map-2023) | Live arts, culture, venue and public-space layers | OGL v3 |
| [Museum Data Service](https://museumdata.uk/using-data/our-apis/) | London museum and collection sites from a versioned snapshot | Public API; linked attribution |
| Daily News editorial dataset | New fixed-location places verified during each edition run | Source-specific links retained |

The live discovery sources are free, keyless and queried directly from the browser.
OpenPlaques and Museum Data Service are refreshed into compact London-only snapshots by
`node scripts/refresh_poi_snapshots.mjs`; this avoids repeated bulk downloads on a phone
and makes those layers available offline. Daily discoveries are append-only in
`data/editorial-pois.json`.
There is no backend, no account, no analytics and no tracking; your selected
search centre is sent only to the discovery APIs and is never stored anywhere
but your own device.

The map itself uses [OpenStreetMap tiles](https://www.openstreetmap.org/copyright) rendered by [Leaflet](https://leafletjs.com) (vendored, not CDN-loaded, so it still works offline from the service worker cache).

## Documentation

[PRD.md](PRD.md) covers the product goals, architecture, data-source rationale and the full v1 → v3 change history.
