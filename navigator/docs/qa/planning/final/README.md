# Release evidence

Final offline artifact: `public/solarreach-navigator.html`; SHA-256 `d7d38c5ae28fbb8f69244aeae2fd5be526f3750103158173dc110ab8473a44ce`.

- 589 unit/numerical/regression tests passed, zero failures, on the integrated source. TypeScript and ESLint exited0; production and standalone builds completed. Native MathML compilation checked309 expressions.
- `r7-offline-planning.json`: nine disconnected real UI workflows passed, including controlled date/site comparisons, decision JSON round-trip, finite sensitivity/cancel, teaching retention and unknown historical terrain.
- `r7-web-contact.json` and `r7-offline-contact.json`: six checks each. The antenna cutoff is active at0° and2°; public summary, horizon windows, forecast, comparison and exported assessment agree while raw terrain-only visibility remains separately labelled.
- `browser-reflow.json`:17 passing checks, real200% Chrome zoom and keyboard/reflow coverage. `contrast.json`:11 measured passing contrast cases. These preceding R4 browser checks do not establish whole-app conformance.
- `../cold-demo-final.md`: non-author agent HTTP/file walkthrough, original findings retained, bounded R7 contact-resolution follow-up passed. Human acceptance remains outstanding.
- `guided-landing-r4.json` and `../guided-landing-review.md`:88 passing independent physical Follow/contact checks. Flight solver, contact engine and scene runtime have no diff between R4 checkpoint849bff6 and R7; R7 changes concern communication presentation, shared visibility predicate and learning copy. Do not describe R4 full trajectory replay as an exact R7 byte-level replay.
- `../../horizons-decoded-validation.json`: fresh56 decoded samples/112angles, max azimuth error0.0115762° and elevation error0.0088293°, below0.02° tolerance.

Recorded slop scan findings were reviewed: NASA loader rethrows retain causes; scenario validation returns null for invalid external input by contract; library/script directory fan-out is structural. No empty caught exception was concealed or score suppressed.

The illustrative rigid contact model uses numerical coarse terrain and mesh-box proxies, a bounded12-second replay and entered acceptance limits. It is not qualified vehicle structural/GNC/soil simulation. Unavailable terrain/contact evidence remains explicit. Actual screen-reader testing, independent frame/terrain uncertainty qualification, operational station support and mission-specific evidence remain open; see `../../../IN-FLIGHT.md` for the full teammate TODO list. Deployment belongs to the teammate.
