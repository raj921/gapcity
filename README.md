# GapCity

See nearby competitors on a geographic 3D map, compare public ratings, and investigate repeated themes in customer reviews. Start with Vijayawada, choose a business type, and set a radius from 100 m to 5 km.

Next.js serves both the interface and API routes. SerpApi supplies business listings and review evidence. MapLibre renders independent OpenStreetMap street and building geography from OpenFreeMap. No whole-city scrape is required.

## Watch the live demonstration

[Watch or download the narrated demo (71 seconds)](https://github.com/raj921/gapcity/releases/download/v1.0.0/gapcity-demo-with-ai-voice.mp4). The recording shows real SerpApi data; the access code and server credentials are hidden.

## Run locally

Use Node.js 22.13 or later. Run these commands from the folder containing this README:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Sample mode works without an API key. Its 49 businesses and all reviews are **invented**, while the underlying street map may be real. Map tiles, the MapLibre CDN and Google Fonts require internet access. If the renderer or initial map load fails, a geographic plot and the competitor list remain available. The plot is not a street map.

## Enable live SerpApi data

Edit `.env.local` and set:

```dotenv
SERPAPI_KEY=your_server_side_serpapi_key
GAPCITY_LIVE_ENABLED=true
SERPAPI_MAX_CALLS=60
SERPAPI_SEARCH_PAGES=3
GAPCITY_LIVE_ACCESS_TOKEN=choose_a_private_demo_access_code
GAPCITY_SIGNING_SECRET=choose_a_long_random_secret
```

Generate the signing secret with `openssl rand -hex 32`. Keep both the API key and signing secret on the server. Restart Next.js after changing settings. Select **Live search**, enter the access code, then choose **Explore area**. The code is kept in browser memory only. Public production live mode requires an access code and signing secret. Samples remain available when live mode is disabled. A live error does not silently replace real data with sample data.

Run the first real-data check before making any claims about Vijayawada:

```sh
npm run kill-test
npm run record:live
```

The kill test uses at most three outgoing Maps requests and saves the normalized search sample. The full recording uses up to three search requests plus up to six review requests. It writes `recordings/vijayawada-live.json`, with no API key, access code or signed ticket. This JSON is an export for inspection; importing it into the app as an offline replay is not implemented. Recordings are excluded from git by default. The script reads `.env.local`. Optional `GAPCITY_DEMO_CATEGORY`, `GAPCITY_DEMO_LAT`, `GAPCITY_DEMO_LNG`, and `GAPCITY_DEMO_RADIUS` override its inputs.

Check how many listings have coordinates, ratings and review counts. If fewer than 15 listings or 10 ratings are found, inspect another nearby centre or a larger radius. A small sample can still support competitor comparison; it may not support scored zones.

## Interface

1. Choose a category such as cafes, barbershops, restaurants or gyms.
2. Use Vijayawada, click to place the blue pin, drag it, nudge it with arrow keys, or enter coordinates. The pin and blue radius preview changes immediately.
3. Set the radius and select Explore area. Changing inputs does not trigger paid searches automatically.
4. Compare the three recommended areas, then inspect an area or competitor from the map or accessible results list. Recommendations prioritize site visits, not predicted profit.
5. Inspect the reasons, ratings, review themes, dated snippets and source links. Expand the review list or filter competitors by name/address. Themes retain the IDs of their supporting reviews.
6. Select your own listed business to compare its rating with the other rated businesses in the search sample.
7. Export the current analysis and loaded evidence as JSON.

The 3D toggle changes the geographic building layer and camera pitch. Street zooms into building geography; Fit returns to the preview radius. On phones, pan with two fingers and drag the pin with one finger. Business markers are separate from physical buildings. Several businesses can share a building. Building heights never come from ratings or review counts. Missing heights use a labelled 12 m visual estimate. Coverage depends on OpenStreetMap and cannot be assumed complete for Vijayawada. This is not Google Earth photorealistic imagery.

## Backend and frontend data contract

### `POST /api/zones`

```json
{
  "category": "Cafes",
  "center": {"lat": 16.5062, "lng": 80.6480},
  "radiusMeters": 1500,
  "mode": "demo"
}
```

For live calls use `"mode":"live"` and the header `x-gapcity-access`. The server supplies the SerpApi key.

| Response field | Frontend use |
| --- | --- |
| `id`, `ticket` | Associate review requests with a validated analysis; signed snapshots work across server instances |
| `input.center`, `input.radiusMeters` | Completed result district; editable local centre/radius separately drive the blue preview and draggable pin |
| `source`, `fetchedAt`, `expiresAt` | Identify synthetic/live data and freshness |
| `businesses[].id`, `location` | Select competitors and position map markers |
| `name`, `address`, `category` | Listing cards and evidence titles |
| `rating`, `reviewCount` | Comparisons; missing values remain `null` |
| `mapsUrl`, `openState`, `price` | Public listing details, where available |
| `zones[].polygon`, `center` | Clipped geographic cell shapes and markers |
| `score`, `rank`, `confidence`, `businessIds` | Research ranking and selected-zone membership |
| `topZoneIds`, `summary` | Results list and district summary |
| `coverage`, `caveats` | Sampling limits, exclusions and interpretation |

### `POST /api/evidence`

```json
{
  "analysisId": "uuid_from_the_analysis",
  "ticket": "signed_snapshot_from_the_analysis",
  "zoneId": "zone:1:0"
}
```

Choose exactly one `zoneId` or `businessId`. The selection must belong to the analysis. Evidence returns selected businesses, sampled reviews, complaint and strength themes, a recommendation, status, source, sample size and limitations. `reviews[].url` links to the public evidence. `themes[].reviewIds` links each theme to its sampled reviews. Status is `sample_only`, `insufficient_evidence` or `evidence_available`.

### `GET /api/status`

Reports whether live settings are present, whether access is protected, and this process's outgoing-call count and limit. It never returns secrets. Incomplete production settings are rejected before a paid search.

Errors use `{ "error": { "code": "...", "message": "..." } }` with appropriate HTTP status codes. Expired analyses return 410; bad input returns 400; missing live setup returns 503; budget exhaustion returns 429; upstream failures return 502.

## SerpApi integration

`lib/serpapi.ts` calls the official HTTPS search endpoint server-side:

- `engine=google_maps`, `type=search`, category plus `near me`, GPS `ll`, `nearby=true`, `hl=en`, `start=0/20/40`. At most three pages. `ll` sets a viewport, so exact Haversine distance filtering enforces the user's radius independently.
- `engine=google_maps_reviews`, `data_id` or `place_id`, `sort_by=newestFirst`, `hl=en`. At most two pages per selected business. The first page omits `num`; a subsequent page uses the returned token and `num=20`.

Without SerpApi, live competitor discovery and review evidence do not work. The map geometry is an independent visual context, rather than a substitute for the sponsor's data.

Responses are cached for 24 hours in a bounded in-memory cache. Identical concurrent calls are coalesced. Failed attempts count against the configurable hard ceiling. There are no blind retries. Each external call times out after 20 seconds. These caches, rate limits and credit counts are **per running process**: they reset on restart and are not shared across serverless instances. For wider public use, add durable shared caching and an account-wide atomic budget; use the SerpApi account dashboard to track actual credits. There is no claim that the default 60 cap limits the whole account on a serverless host.

## Scoring and evidence limits

Cells are approximately 400 m wide and clipped at the selected radius. Only cells with at least three rated businesses with ten or more reviews each, and at least fifty combined reviews, receive a score.

- 55%: lower adjusted public ratings.
- 30%: capped, logarithmic public review activity.
- 15%: lower competitor concentration within sufficiently observed cells.

Small samples shrink toward 4.0; large review counts have capped influence. At most three spatially distinct cells are highlighted. A score prioritizes further research. Empty cells are unscored and do not prove unmet demand. Reviews do not establish footfall, population, sales, growth, rent, revenue or profitability. Street hints come from listing addresses, not reverse geocoding.

Review themes use English keyword matches separated by rating. Mixed sentiment, Telugu and other languages, sarcasm and category-specific issues may be missed or misclassified. Read the underlying snippets before treating a theme as a complaint. A recommendation requires at least ten sampled reviews and a theme repeated across at least two businesses.

## Verify

```sh
npm run typecheck
npm test
npm run build
npm start
```

The test suite checks geographic distances, radius clipping, sparse evidence, adjusted scores, request limits, upstream normalization and pagination, caching, credit limits, access controls, signed snapshots, and analysis-to-evidence HTTP route flows. GitHub Actions runs these checks on pushes and pull requests.

See [docs/VALIDATION.md](docs/VALIDATION.md) for completed checks and remaining browser/live checks. Source compilation and in-process HTTP checks do not replace browser testing.

## Deploy and submit

This is a normal Next.js app with server-side API routes. Use a host that supports Next.js server functions, such as Vercel, or run the production Node server. A static HTML-only host cannot run the live backend. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/SUBMISSION.md](docs/SUBMISSION.md).

Hackathon: https://serpapi.github.io/serpapi-india-hackathon-2026/index.html

AI assistance: Codex/ChatGPT helped plan, implement and verify this project. ChatCut generated the standard Peter AI voice and synchronized narration for the demonstration. The research scores and review themes use deterministic code rather than an LLM. Real SerpApi search and review journeys were tested locally in Ego; the exact checks and limits are recorded in `docs/VALIDATION.md`. The narrated live demonstration is approximately 71 seconds long and shows a real Hyderabad search, review evidence, pin movement, sparse-circle guidance, radius expansion and report export. No claim is made that the app won.

## Sources and third-party resources

- https://serpapi.com/google-maps-api
- https://serpapi.com/google-maps-reviews-api
- https://nextjs.org/docs/app/getting-started/route-handlers
- https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/
- https://openfreemap.org/
- https://www.openstreetmap.org/copyright
- https://vercel.com/docs/frameworks/full-stack/nextjs

Keep visible map attribution. The MapLibre renderer is pinned to 6.13.0 on unpkg; its external assets and OpenFreeMap services must be reachable in the demo browser. There is no generated background image or simulated success response in live mode.
