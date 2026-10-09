# GapCity implementation plan

## Outcome
Business owners select a business category, map centre and radius. The app places competitors on a geographic 3D map, compares ratings and public review activity, and links research-zone recommendations to sampled reviews. Vijayawada is the starting view.

## Flow and responsibilities
- Next.js route handlers validate requests and call SerpApi server-side.
- Google Maps search supplies geographic coordinates, business identifiers and public metrics. Haversine distance enforces the radius. Deduplication uses business identifiers, never search rank.
- The map loads independent geographic street/building data. SerpApi does not supply city geometry. A point can represent several businesses in one physical building.
- The radius is the user's input, independent of the 400 m analysis-cell width. Clip cells at the circle boundary.
- Evidence fetches reviews on demand for at most three businesses, at most two pages per business. No automatic public web crawling.

## Scoring contract
Only score cells with at least three businesses with ratings and at least ten reviews each, and at least fifty combined reviews. Use a transparent heuristic combining low adjusted ratings (55%), capped logarithmic review activity (30%) and lower competitor concentration (15%). The score means priority for further research, not demand, sales, profit or opening suitability. Empty cells remain unscored. Limit each business's weight. Keep the top three spatially distinct cells, when sufficient data exists.

## Failure cases checked before coding
1. Ranked results outside the radius: filter by coordinates, not `position`.
2. Missing coordinates: exclude and count. Missing ratings: display unavailable rather than invent zero.
3. Duplicate pages: deduplicate and stop on no new IDs.
4. Large review counts: cap in scoring; use log scale only for optional markers, never geographic building height.
5. Weak evidence: refuse strong recommendations. Avoid growth claims from a single snapshot.
6. Expired analyses: return a clear reload message. Unknown business/zone IDs cannot become arbitrary SerpApi calls.
7. Synthetic demonstration records: label in every response and interface. Do not fall back to samples after a live error.
8. Credit abuse: live opt-in, shared access token on public deployments, per-process hard cap, cache and in-flight request coalescing. Per-process limits are not account-wide limits on serverless deployments.
9. Upstream errors: bounded timeout, safe errors without API-key URLs, no blind retry.
10. WebGL/tiles failure: geographic SVG fallback and accessible business list. Tile coverage and heights vary; no photorealistic Vijayawada promise.

## Visual brief

Shared constraints: [DESIGN.md](../DESIGN.md). Inspected references: [visual reference notes](visual-references/README.md).
Intent: compare local competition without losing geographic context.
References: https://www.navbar.gallery/ (sidebar orientation), https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/ (mapped building extrusions).
System: white inspector, dark ink typography, lime selection accent, blue streets, warm map surface. A dominant map workspace, compact left research controls and right evidence drawer. Desktop three-column workspace, mobile stacked controls and map with list below. Typography uses Manrope and DM Sans where Google Fonts can load, with local sans-serif fallbacks. Map tiles and fonts are external network resources. Focus rings and 44px touch controls.
States: loading, empty radius, insufficient evidence, expired analysis, missing live configuration, upstream errors and unavailable map. No simulated live-success state. Reduced motion disables camera animation.
Checks: backend invariants, request limits, TypeScript, production build and desktop/mobile UI flow.

## Submission
Track: Commerce & Market Intelligence. Meaningful SerpApi usage is core business discovery and on-demand review evidence. Deadline: 10 October 2026 23:59 IST. Public GitHub repository and public screen recording under three minutes are required. Disclose Codex/ChatGPT development assistance. No submission claims until a real SerpApi run, repository and video exist.
