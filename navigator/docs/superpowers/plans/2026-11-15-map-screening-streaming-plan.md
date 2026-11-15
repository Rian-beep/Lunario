# Map screening and streamed terrain implementation plan

**Goal:** add honest map-based screening/ice exploration and faster progressive Moon detail.
**Architecture:** isolated numerical/source lanes feed small map-layer components; the integrator owns all existing shared UI, renderer and loaders. Existing evaluator remains the full-mission authority. No schema/model change to mission approval.
**Stack:** Next/React/TypeScript/Canvas/Three.js; optional connected Cesium Moon 3D Tiles.

- [ ] Lock contracts/ownership and establish baseline profile.
- [ ] Screening lane: tested reusable date-dependent physical metrics, regional slope sampling, unknown support, normalized configurable score, bounded cooperative jobs.
- [ ] Ice lane: obtain and validate published source evidence, compact offline-safe geodata and primary references; no inferred ice from hydrogen.
- [ ] Performance lane: measure concrete startup bottlenecks and propose verified deferred loading/cache improvements, no shared source edits.
- [ ] Integrator: map-layer UI, legends/details/accessibility, both projections, click-to-inspect, cancellation; deferred data/compute improvements.
- [ ] Integrator: authorized ion asset/auth setup, Three.js tiles/frame binding, progressive refinement/cache/cancel, failure/offline fallback, attribution.
- [ ] Validate each lane before integration; run all numerical/source gates and web/file workflows, realistic performance measurements, regenerate offline and exact receipt; push/merge current team repository.
