# Integration verification — 14 November 2026

The delivered work is an educational and preliminary engineering workbench. These checks do not certify a spacecraft, validate hazard avoidance, or imply user acceptance of the visual design.

## Numerical and build evidence

- **95 tests pass** in the integrated source. Project unit tests include scene geometry, chart/glossary contracts, energy/storage/contact, RK4 flight/contact/fuel, scenario schema, unknown coverage, packed terrain, NASA original asset provenance and window-state logic.
- Typecheck and ESLint pass. Production Next.js build and single-file HTML generation pass. `npm test` includes the scene tests rather than silently omitting them.
- Fresh Horizons evidence covers 56 samples including Apollo 11; maximum azimuth difference 0.01158°, elevation 0.00883°, both below 0.02°. Evidence is in `horizons-decoded-validation.json`; source requests compare decoded/quantized browser data with observer tables, with a 0.02 degree bound. This is not validation of terrain shadows against photographs.
- A read-only independent review found and verified fixes for incomplete input schemas, unknown darkness ranking, radio assumption persistence, shared terrain reference radius, exclusive UTC end times, complete comparison CSV assumptions, NASA globe zoom bounds and hidden enlarged flight overlays in globe mode.

## Browser observations

Checked in isolated browser contexts, leaving the user's browsing context alone:

- Public, Educator and Planner guides show distinct content. Action button and Escape dismiss them; Mode guide reopens them.
- Chart axes have visible names and units; actual-sample readouts work with next-sample controls. Hover help shows variable meaning and applicable limits.
- Nine radio assumptions survive switching panels and are retained in saved scenarios. Downloaded comparison CSV contains both radio and flight assumptions and the exclusive end UTC.
- A 14-day stay starting 29 June 2027 at 11:00 UTC ends 13 July 2027 at 11:00 UTC.
- Timeline compact height 63 px versus 173 px expanded at 1600×1000. Minimize, dismiss, reload while dismissed, and restore pass. Dismissal pauses playback.
- The floating camera toolbar is replaced by a compact View controls menu. Coordinate guides are optional; solid black label rectangles are removed.
- 390×844, 800×500 and 1920×1080 reflow checks show no horizontal document overflow; mode dialogs remain within the viewport and scroll. 800×500 is a reflow proxy, not a claim of a complete 200% zoom or screen-reader audit.
- NASA original model loads its 1,015,808 triangles and 8192×4096 image. The globe camera is constrained to a globe-appropriate distance; local Orbit/Surface views use separate measured LOLA terrain.
- The standalone HTML opens directly with file:// and networking disabled, rendering the NASA globe with zero HTTP requests and zero page errors. The file is about 41.7 MB because imagery and numerical data are embedded.

## Data interpretation

Original horizon masks retain 40/240 m source sampling even when displayed local terrain is finer. LROC images contain historical shadows; inspection light is display-only. NASA's original GLB has uncalibrated unitless relief and documented polar artifacts, shown at a nominal globe scale. It never supplies scientific terrain heights, contact or hazards. Unknown global terrain horizons remain unknown; historic spacecraft pins do not generate measured masks.

## Static analysis

`npx slop-scan scan .` was run. Parser-return-null contracts, explicit loader errors with causes and graphics-loss reporting were inspected rather than hidden to reduce a score. A silent comparison-preference fallback now gives a visible notice. The library file-count metric does not justify an unrelated refactor.

## Global catalogue integration

40 sourced mission records cover six Apollo landings plus robotic landings, off-nominal touchdowns and failed attempts. Existing polar scientific coordinates/masks remain intact. Global latitude input, unknown-mask propagation and unknown-window rejection have regression tests. Source links and coordinate kind survive the catalog adapter; planned targets and observed features with uncertain mission associations retain their caveats.
