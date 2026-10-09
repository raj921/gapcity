# GapCity hackathon entry

Official event: https://serpapi.github.io/serpapi-india-hackathon-2026/index.html

Rules: https://serpapi.github.io/serpapi-india-hackathon-2026/rules.html

Deadline verified on 9 October 2026: **10 October 2026, 23:59 IST**.

Track: **Commerce & Market Intelligence**.

## Project description

GapCity helps local business owners choose areas to investigate before opening or improving a business. Choose a category, move the map pin and set a radius. A geographic 3D map shows nearby competitors, public ratings and recommended research areas. Inspect sampled customer reviews, follow the supporting sources, compare an owner's listed business with peers and export the analysis. Recommendations remain visible for sparse or empty circles, with explicit unscored site-visit guidance when the evidence is insufficient. Scores prioritize research, not predicted demand, footfall or profit.

## Meaningful SerpApi usage

SerpApi Google Maps search supplies the competitors, listing identifiers, coordinates, ratings and review counts. Server-side distance filtering enforces the selected circle, and paginated results are deduplicated and normalized. Google Maps Reviews supplies dated, source-linked customer evidence when a competitor or area is selected. Without SerpApi, live discovery and review evidence do not work. The map geography comes independently from OpenFreeMap/OpenStreetMap. Bounded caching, concurrent request coalescing and per-process credit ceilings control provider calls; credentials stay server-side.

## AI disclosure

Codex/ChatGPT assisted with planning, implementation, documentation and automated/browser verification. ChatCut generated the standard Peter AI narration and synchronized it with the recorded screen demo. Scores and review themes use deterministic code. Synthetic samples are visibly labelled; the submitted recording shows actual SerpApi search and reviews.

## Review materials

- Public source: https://github.com/raj921/gapcity
- Demo: https://github.com/raj921/gapcity/releases/download/v1.0.0/gapcity-demo-with-ai-voice.mp4
- Demo length: approximately 71 seconds; real Hyderabad search, customer evidence, pin movement, empty-circle guidance, expansion to 5 km and report export.
- Setup: README.md; a local Next.js server runs the full app. A hosted app is not required by the event's screen-recording standard.

Local recordings, voice samples, environment secrets and private capture artifacts are excluded from the source repository. Submission status is verified separately in the authenticated event portal.
