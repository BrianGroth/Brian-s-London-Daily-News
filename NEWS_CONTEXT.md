# Editorial context

This file is durable context for every daily run. Volatile claims—news, weather, transport, dates, prices, availability, people, policies, and schedules—must always be verified live.

## Reader and purpose

Brian lives near **NW3 2RU** and works several days a week near **EC2N 4AY**. The edition is a five-minute personal decision sheet: what is worth knowing, doing, booking, joining, walking to, or avoiding today.

The voice is informed, calm, compact, and specific. It should feel like a well-edited London newspaper, not an SEO summary, a list of scraped headlines, or a generic AI digest.

## Geographic priorities

- **Near Home:** Hampstead Heath, Hampstead, Belsize Park, South End Green, Swiss Cottage, Finchley Road, Gospel Oak, and genuinely walkable nearby places.
- **Near Work:** Liverpool Street, Bishopsgate, Broadgate, Spitalfields, Bank, Moorgate, Barbican, and the Square Mile.
- **Across London:** use only when the item is important enough to Brian or creates a concrete decision.

## Editorial mix

Each edition contains exactly ten stories, two per section, run as adjacent pairs in this order:

1–2. Near Home
3–4. Near Work
5–6. London AI
7–8. London Technology
9–10. Plan Ahead

Do not let two items cover the same announcement or event — this applies within a section's pair as much as across the whole edition. Do not fill a slot with a weak story merely to satisfy the category; keep researching.

## London test for AI and technology

Privately complete this sentence before including a candidate:

> This is a London story because ___.

The answer must name a concrete London actor, place, investment, deployment, public service, workforce, university, community, or consequence. A London office, spokesperson, conference appearance, or passing mention is insufficient.

## Discovery seeds

These are starting points, not a closed list and not permission to skip live verification.

### NW3 and Hampstead Heath

- City of London Hampstead Heath pages and events
- Heath Hands listings and booking forms
- Camden Council news, consultations, planning, and travel works
- Ham & High
- Hampstead Theatre
- Kenwood / English Heritage
- TfL status and planned works

### City and wider London

- City of London Corporation news, events, committees, and consultations
- Mayor of London / London Assembly
- TfL news, status, and planned works
- Barbican and City cultural institutions
- BBC London, Evening Standard, City A.M., ianVisits, Londonist, Secret London, Visit London, Open City, ArtRabbit, Camden New Journal, Eastern City, Time Out London

### AI, science, and technology

- UCL, Imperial, King's College London, Queen Mary, London Business School
- Alan Turing Institute and London research hospitals
- Company newsrooms and filings for primary claims
- Peer-reviewed papers and official programme pages
- Sifted, TechCrunch, UKTN, Financial Times, and specialist reporting for context

The permanent, growing set of previously used sources lives in `resources.html`.
The tested POI discovery stack is listed in the POI Resources section there. Candidates in `PotentialUnusedResources.html` remain outside the production workflow until deliberately promoted.

## RSS candidate file

`data/rss_candidates.json` is produced mechanically and may contain:

- duplicates;
- stale or irrelevant items;
- misleading publisher suffixes;
- Google News redirect links;
- headlines with no usable article body;
- local keywords used incidentally.

Use it to discover leads only. Open the destination, verify the publication time and substance, search for primary evidence, and decide independently whether the story belongs.

## Freshness uses two clocks

Freshness is an editorial requirement with two different measurements:

1. **Development clock for news:** hard news, AI, technology, policy, research, funding, and announcements should normally have been published or materially updated within 36 hours. The daily run begins with the newest verified candidates. A 36–72 hour item needs a clear reason to outrank newer material.
2. **Action clock for events and activities:** for a performance, walk, consultation, exhibition, ticket release, closure, deadline, or planned disruption, the relevant freshness is its upcoming event/action date. The source page may be older, but the date, time, price, availability, booking status, and cancellation status must be rechecked today.

Never confuse a recently published recap with a new development. Never reject a still-upcoming useful activity solely because its official listing was published earlier.

## Evidence and writing

- Prefer primary sources for dates, policy, research, events, ticketing, transport, and company claims.
- Add an independent source when it supplies scrutiny or meaningful context.
- Attribute uncertainty and disagreement.
- Do not invent quotes, facts, causal claims, or image rights.
- Use exact dates rather than relative phrases when ambiguity is possible.
- Make the executive brief explain what happened; make “Why it matters” explain Brian's consequence or decision.
- Link directly to booking/participation instructions for `Book` and `Participate`.

## Image rules

- Prefer official press images with clear reuse/embedding terms, Wikimedia Commons, or Unsplash.
- Record an accurate credit and descriptive alt text.
- Do not use a search-result thumbnail, screenshot an article, or hotlink a site that blocks embedding.
- Verify the final rendered image loads. If rights or reliability are unclear, choose another image.

## Design system

- Navy masthead: `#08264A`, white text.
- Paper: very light cool grey `#F3F5F7`.
- Main text: `#101820`.
- Accent red: `#BD2B2B`.
- Utility green: `#195C4B`.
- Display: Libre Caslon Display / Georgia fallback.
- UI/body: DM Sans / Arial fallback.
- Rules, open layouts, and square media frames; minimal shadow and no rounded card grid.

The reference concepts are:

- `assets/design-concept-desktop.png`
- `assets/design-concept-mobile.png`

## Completion checklist

- London date and weather checked live.
- Current Northern and Overground status checked live.
- Exactly ten stories: two adjacent stories for each section in the required order.
- Strong Heath item chosen first when one exists.
- Near Home and Near Work are geographically honest.
- AI and technology pass the London test.
- Plan Ahead contains a real future decision.
- Ordinary news is within the 36-hour window, or a documented 36–72 hour exception.
- Every event/activity remains upcoming and its actionable date and availability were verified today.
- No semantic repeat of yesterday.
- All action links, source URLs, images, alt text, and credits verified.
- New source domains appended once; no existing resource removed.
- Every eligible new fixed-location POI found during research appended once to `poi/data/editorial-pois.json`, or none explicitly reported.
- All automated and browser checks pass.
