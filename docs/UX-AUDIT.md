# GapCity UX repairs · 9 October 2026

## Observed and repaired

| Issue | Repair | Evidence |
| --- | --- | --- |
| Centre fields changed while the map pin/radius remained tied to old results | Separate editable blue pin/radius from completed result geography; immediate preview, explicit Explore, reset | Native drag, map click, arrow keys and manual coordinates; no extra `/api/zones` request during preview |
| Pin was not draggable | MapLibre draggable marker with 44 px handle, one-finger drag and keyboard alternative | Desktop drag and emulated phone touch drag changed coordinates |
| MapLibre suppressed native pin focus | Explicit pointer/click focus on the marker button | Keyboard-only pin nudge/reset passed |
| Category chevron did not open a menu | Native category select plus explicit custom type field | Category/custom/category change and search passed |
| Search controls disappeared inside a long sidebar | Dedicated visible setup band; separate scrolling result/evidence inspectors on desktop | Desktop screenshot and journey; phone stacked layout |
| Phone selection left evidence far below the map | Scroll to evidence on selection and provide Back to map | 390 px selection/navigation passed |
| Camera/scroll interaction could accidentally zoom the map during page navigation | Cooperative gestures: modifier-wheel on desktop, two-finger pan on phone; single-finger marker drag | Touch drag and browser navigation passed |
| Reviews stopped at eight with no in-app expansion | Show more in groups of eight; reset expansion on theme/selection | Sample and real review expansion passed |
| Recommendations were only a score and generic title | Address hint, observed competitors/reviews, evidence support, detailed reason, site-visit checks, compare table and Set search pin here | Three-area comparison, evidence and pin staging passed |
| Competitor list was difficult to navigate | Name/address filter, sort and clear empty-state guidance | One-match/no-match/reset/sort/profile journey passed |
| Coordinates always displayed N/E | Correct hemisphere labels; validate manual bounds and normalize map world copies | Coordinate validation and normalization tests |
| Nearby points could be assigned far away across the date line | Wrap longitude delta in the local geographic projection | Cross-date-line cell test passed |
| Small controls and weak text contrast | 44 px action targets, clearer menu indicators, darker supporting text, readable reviews | Final viewport measurements and screenshots |
| Map timer remained after unmount; zoom ignored reduced motion | Clear load timer; reduced-motion-aware fit, focus, north, tilt and zoom; disable CSS animations | Source/type/build checks and reduced-motion browser journey |

## Deliberate limits

The shortlist ranks areas for investigation using observed competition and public review activity. It does not identify the most profitable premises or measure demand, sales, footfall, growth or rent. Missing/empty cells stay unscored. Address hints are listing-derived, not verified neighbourhood boundaries.

Street view here means zooming into independent OSM building geometry. The app does not provide Google Earth-style photorealistic imagery. Missing building heights use the labeled 12 m visual estimate.

See `VALIDATION.md` for exact runs and remaining coverage. No statement that every possible bug or external failure has been eliminated.

## Missing recommendations after moving or resizing the circle

The area shortlist was filtered to scored cells, requiring at least three businesses with supported ratings per 400 m cell. Sparse and empty searches therefore offered no area at all. The results tab also remained on Competitors after a new search.

Fix: keep supported scores and add an explicitly unscored limited-data shortlist from observed cells. When the search has no listings, offer the centre cell as one site-visit starting point with coordinates and absence-of-evidence guidance. The existing map marker, inspector, evidence endpoint, exports and signed restoration all share the same zones. New successful searches reopen Recommended areas. Tested on sample and real SerpApi circles; see VALIDATION.md.
