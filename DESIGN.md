# GapCity design constraints

The direction is a field research desk: white inspectors, forest ink, a warm geographic surface and lime selection. Owners set an area, inspect a shortlist and check the source evidence before a site visit. The map is the working surface; controls must remain visible while results grow.

References and their roles: [visual reference notes](docs/visual-references/README.md).

## Typography and colors

- Body: DM Sans with Avenir Next/sans-serif fallback; headings: Manrope with the same fallback.
- Body base 16 px; controls 14 px; supporting labels 12 px; heading 31 px/1.18; review text 14 px/1.65. Keep long evidence readable and business-name truncation confined to list rows.
- Ink `#20382c`, muted `#5c6e63`, border `#e1e7de`, selection `#d1f884`, surface white, secondary surface `#f5f7f2`, error `#b33a2f`. The darker secondary text improves legibility.
- Map competitors `#365743`, selected business `#d76c53`, centre `#677dcc`, selected zone `#a9d862`. Geographic heights must never depend on business metrics.

## Layout and shape

- Desktop header 64 px. Search controls sit in a dedicated full-width band above the results/map/evidence grid. Results 300 px, map flexible, evidence 340 px; desktop inspectors scroll independently. The search band must never disappear inside a result-list scroll.
- Panel padding 20 px, 4 px spacing unit, commonly 8–16 px gaps; cards/inputs 10 px radius, modal 16 px. Borders define panels; subtle elevation only for floating map controls.
- At 1100 px, evidence sits below the map. At 700 px, stack search, map, results, evidence; use two-column search fields and a 500 px map. Inspector links jump to mobile evidence. No horizontal page overflow.

## Components and states

- Explore area is the primary action. Native category selection visibly opens its options; custom categories use a separate labeled text input. Input changes preview a blue draggable centre and dashed radius immediately; green results stay tied to their completed search. A pending banner offers reset. Preview changes never silently run a paid search.
- Centre selection supports click, drag, arrow-key nudges and manual coordinates. Clamp map coordinates to the supported latitude range and wrap longitude. Fit frames the preview; selecting a result focuses that result. Buildings view zooms to street level and remains explicitly geographic, with estimated heights labeled.
- Shortlist cards state why each area is worth investigating and link to evidence. A side-by-side comparison uses existing zone metrics. Research scores and review activity do not establish sales, demand, profitability or a best premises.
- Every successful search opens its area shortlist. Review-supported cells retain their scores; sparse observed cells show “Limited data” and no score. With no listings, show one centre-based “Site visit” starting point with coordinates and an explicit absence-of-evidence explanation. Reuse the existing card, map marker and inspector; never manufacture reviews, scores or street names. Preview circles update recommendations only after Explore area.
- Competitors can be filtered by name/address and sorted. Reviews can be expanded beyond the initial eight; selection/filter changes reset pagination. Initial loading uses samples only.
- Label synthetic and SerpApi sources explicitly. A live error preserves the current result; never silently substitute samples.
- Evidence opens from a map marker, zone or accessible list. Show loading, errors, sparse evidence and source links. Scores prioritize research, not demand or profitability.
- Live credentials remain server-only. Public live deployments omit the entire access-code field; visitors choose Live search and Explore area. Optional private demos retain a password gate in component memory. Exports omit secrets and signed tickets. This removes a setup obstacle without adding new visual styles or dependencies; the existing theme remains consistent with the current tweakcn reference.
- Map controls reflect their current state. If SDK/tiles fail, retain the geographic plot and list, label that the street map is unavailable, and disable unavailable camera controls.

## Accessibility, motion and performance

- Visible 3 px blue focus ring; semantic labels, dialog, buttons, lists and keyboard-operable plot markers. Preserve native inputs and selections.
- All action buttons and input rows target at least 44 px. Native menus, visible chevrons, descriptive labels and pressed states make options discoverable. Tab buttons support arrow navigation.
- Reduced motion removes routine transitions and camera-fit/tilt animation. Do not add decorative motion or new visual dependencies for the loader repair.
- MapLibre is lazy-loaded from the pinned CDN version. Keep the existing fallback and bounded load timers. Source-linked reviews and list navigation remain available without WebGL.
