# Verification status · 9 October 2026

Workspace: `/Users/rajkumar/Desktop/gapcity`. Local production app: http://127.0.0.1:3010.

## Preview availability repair

On the next user test, port 3010 had no running server. The previous terminal-managed preview was no longer available. The production server now runs as the runtime macOS launchd job `com.rajkumar.gapcity.preview`, bound only to `127.0.0.1:3010`, with keepalive independent of the chat's terminal session. No login-startup file was installed. Logs are in `recordings/local-server*.log` and are ignored by Git.

After starting the job, the page and status API returned HTTP 200, live configuration was available and protected, and a sample search returned HTTP 200 with 49 synthetic businesses. These availability checks did not spend provider credits. Stop this preview with `launchctl remove com.rajkumar.gapcity.preview` when it is no longer needed.

## Completed checks

- **24 automated tests passed** after the circle-shortlist repair. Coverage includes exact distances, radius clipping, sparse/unscored cells, score bounds, map-pin normalization, date-line grouping, pagination, normalization, caching, credit ceilings, live access, signed snapshots and actual in-process HTTP route flows.
- The final optimized production build passed, including TypeScript checking. `/`, `/api/status`, `/api/zones` and `/api/evidence` are available.
- **15 desktop journey checks passed** in Ego against the production server. The same journey passed after the final adjustments with reduced motion enabled: no horizontal overflow, loaded sample/map, keyboard pin nudge/reset, native marker drag, click-to-place, previews without a search, valid/invalid manual coordinates, custom/category options, radius/completed search, three-area comparison, zone evidence, review expansion/theme reset, set-pin-from-area, competitor filter/sort/profile, own-business comparison, dialog/Escape, actual download, close evidence, arrow-key tabs and all camera/layer controls.
- **Six keyboard-only journey checks passed**: category/search, area inspection, pin nudge/reset, evidence filtering, methodology/Escape and actual report download. This is a functional keyboard journey, not a full accessibility audit or screen-reader certification.
- **Five protected live journey checks passed**, including a fresh run after the final build: incorrect access preserves samples, valid live search, recommended-area evidence with real source links, review expansion and actual live report download.
- **Three phone journey groups passed** after the final build: one-finger native touch pin drag; area selection scrolling to evidence and Back to map; 390 px and 375 px layouts without horizontal overflow. Both source buttons measure at least 44 px high. The map is 500 px high; physical-device testing has not been performed.
- Reduced-motion emulation returned `matchMedia(...).matches === true`, `transitionDuration: 0s` and `animationName: none`. The desktop journey exercised fit, selection, north, tilt and the reduced-motion-aware zoom buttons.
- Both optional WebMCP tools registered. Staging Gyms / 16.507,80.649 / 1800 m immediately changed the visible preview, returned `searchExecuted:false`, preserved the 39-business live result and made no new `/api/zones` request. Reset restored the completed search.
- Downloaded sample, keyboard and live reports were inspected. No API key, access code, signing secret or signed ticket was present. Review expansion does not truncate the exported evidence.

## Real data verified

Cafes, centre 16.5062/80.6480, radius 1500 m:

- 60 raw search rows; 8 duplicates and 13 outside-radius listings excluded; zero missing coordinates; **39 retained businesses**, all with ratings and review counts.
- Three scored recommended areas. The top area includes TFL (The Food Lounge), Tarnaka Café and Down Town Cafe.
- **33 real sampled reviews**, `evidence_available`, with source links. Quality appears in three low-rated snippets across two businesses. Keyword mentions require reading the source and do not establish demand or profitability.
- SerpApi account snapshot after the checks: **21 searches used, 229 remaining** of the 250 monthly allowance. This is an account snapshot, not a permanent balance. Process-local counters reset when the server restarts.
- Existing credentials remain only in the protected `.env.local` (mode 600). No credential was rotated.

The sample mode still uses 49 invented businesses and invented reviews over independent real geography. It remains explicitly labeled.

## Repairs and repeatable browser checks

The new UX fixes and their observed causes are documented in `UX-AUDIT.md`. Earlier loader fixes remain: MapLibre's `.mjs` import, a sufficiently specific absolute map-container rule, and marker updates guarded by the custom source rather than transient style readiness.

Load `scripts/browser-journey.mjs` into an `ego-browser nodejs` round in an existing agent-owned TaskSpace, then call:

- `testGapCityJourney(spaceId, pageLabel)` — sample journey, no provider requests.
- `testGapCityKeyboard(spaceId, pageLabel)` — keyboard-only sample journey.
- `testGapCityLive(spaceId, pageLabel, code)` — protected live journey; requires the initial 49-business Cafe sample. Supply the code from private local configuration, never embed it in the file. This can use provider credits.
- `testGapCityPhone(spaceId, pageLabel)` — existing result on an emulated phone; selected-area reviews may require provider calls if not cached.

`browser-smoke.mjs` remains the smaller renderer/sizing/2D check. Emulation is scoped to browser testing; explicitly restore desktop metrics before leaving the result for the user.

## Saved evidence

- `docs/desktop-ux-qa.png`: final live desktop layout.
- `docs/desktop-final-ux-qa.png`: final sample desktop with reduced motion.
- `docs/phone-ux-qa.png`, `docs/phone-375-ux-qa.png`: final live phone layouts.
- `docs/phone-evidence-ux-qa.png`: final phone inspector.
- `docs/phone-pin-touch-qa.png`: earlier native touch drag preview.
- `recordings/browser-journey-export.json`, `recordings/browser-keyboard-export.json`, `recordings/browser-live-ux-export.json`: actual downloads, inspected for private data.
- Earlier normalized search/full live recordings remain in `recordings/`; all JSON recordings are excluded from Git.
- `DESIGN.md`, `docs/visual-references/README.md` and the bookmarked Refero/Wise reference screenshot record the visual direction.

## Remaining coverage and product limits

Artificial CDN/WebGL initialization-failure attempts did not reliably force the fallback in Ego and are **not counted as passed tests**. The labeled fallback was observed during the earlier missing-SDK diagnosis, but the redesigned fallback interactions were not reverified under a real renderer outage. Slow-network, late tile failures and an external production host remain untested. Some upstream map POI sprites emitted nonfatal missing-image warnings; competitor markers and building geometry rendered.

No external hosted app was tested. Publication and event entry are tracked separately in docs/SUBMISSION.md.

Recommendations prioritize areas for investigation using observed competition and review activity. They do not measure sales, footfall, rent, demand or profitability. Building heights may be estimated; the map is OSM geometry, not photorealistic Google Earth imagery. These checks establish the tested local flows, not the absence of every possible bug.

## Recommendations for every successful circle search, 9 October 2026

Reproduced the reported failure through `createAnalysis` and Ego: a 100 m sample search returned zero listings and zero recommended areas. Searching from the Competitors tab also left that tab selected. The scoring gate selected only cells with three supported ratings, so sparse and empty circles lost their entire shortlist.

`buildZones` now selects review-supported cells first, then unscored observed cells as limited-data site-visit suggestions. If no listings are present, the centre cell supplies one geographic starting point. Scores remain null without the original rating threshold, and empty cells never receive invented businesses, reviews or street addresses. Both new analyses and signed-snapshot restoration use the same selection function. Every successful search reopens Recommended areas and clears the previous comparison.

Validation:

- `npm test`: 24 tests pass. The new regression checks empty circles at 100, 200, 500, 1500 and 5000 m, three different centres including the date line, sparse/missing metrics, mixed scored/unscored cells, signed restoration and empty-area evidence.
- `npm run build`: production compilation and TypeScript pass. Restarted the existing launchd preview job with the new build; `/api/status` responds 200.
- Ego sample checks: 100 m gives one unscored site-visit area and automatically reopens recommendations; inspection shows no invented reviews. Expanding to 5 km restores three scored areas. Moving to 16.5400, 80.7000 updates the suggested area's coordinates. A 390 px phone layout opens the empty-area guidance without horizontal overflow.
- Real SerpApi checks: at 16.5400, 80.7000 the 100 m circle returned zero listings and one unscored centre-based area with zero sampled reviews. Expanding to 5 km returned nine businesses and three limited-data area suggestions. This dataset contains no cells meeting the score threshold, so the score is visibly absent. Results remain source-labeled SerpApi data.

The repeatable five-group browser regression passed in a fresh Ego page. Live result screenshot: `docs/circle-recommendations-live.png`.

Repeatable browser regression: `testGapCityCircles(spaceId, pageLabel)` in `scripts/browser-journey.mjs`. Pin/radius changes remain previews until Explore area; live failures preserve the previous completed result.

## Submission source preparation

The first public GitHub check exposed incomplete optional-package entries in the earlier lockfile. Regenerated the lockfile from the pinned manifest in an empty folder, then confirmed a fresh `npm ci` succeeds. Updated Next.js from 16.3.5 to the security-patched 16.3.8. The clean install reports zero known dependency vulnerabilities at this check. Type checking, all 24 tests and the optimized production build passed against that clean installation. This verification did not use `.env.local` or provider credits. The previously recorded live demo remains approximately 71 seconds long.

The repository and release video were verified accessible with unauthenticated HTTP requests. Public links: https://github.com/raj921/gapcity and https://github.com/raj921/gapcity/releases/download/v1.0.0/gapcity-demo-with-ai-voice.mp4. Private local recordings and voice references are excluded. Event submission is a separate portal action; public links alone do not establish submission.

## Public Vercel deployment and submission

Production: https://gapcity.vercel.app. Vercel project `gapcity` under `guthala-rajkumars-projects`, Next.js preset, Node 22.x and `npm ci`. The GitHub connection deploys main. SerpApi credentials and the signing secret are stored as sensitive production environment variables. Public live access is explicitly enabled; no visitor code or credential field appears. The local preview uses the same public-access configuration.

- Clean type check, **25 tests**, optimized production build and GitHub Actions pass.
- Seven unauthenticated production API checks pass: status/configuration, samples, real listing discovery, source-linked area reviews, competitor reviews, a small-circle shortlist and secret-free public/report data. The fresh Vijayawada result contains **42 businesses and 3 recommended areas**, with **42 sampled reviews** in the inspected area and 11 for the selected competitor. The 100 m relocated circle has zero listings and one unscored starting area.
- **15 desktop sample journey checks** pass in Ego against the public URL, including native pin dragging, map options, category/radius changes, comparison, evidence, filtering, camera/layers and an actual JSON download.
- **Five public live browser checks** pass: no access-code input or label, Explore returns real data, recommended-area/source evidence, review expansion and actual live JSON download.
- **Three phone journey groups** pass: one-finger pin drag, evidence/Back to map, and 390/375 px layouts without overflow. Desktop metrics were restored afterward.
- Local preview restarted with the new build; status reports live available and no visitor protection.

The portal confirmed GapCity **SUBMITTED on 9 October 2026 at 11:36 pm IST**. Repository, narrated 71-second demo and public app link are included. Private contact details are not stored in this document. Receipt image and downloaded test reports remain in the ignored local recordings folder.

Existing ceilings remain per-process, not an account-wide durable budget. Production scale, concurrent multi-instance credit control and physical-device testing have not been established by these checks. Public traffic consumes the configured SerpApi account's allowance.
