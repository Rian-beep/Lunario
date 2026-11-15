# Geometric date-search invalidation

The search key captures latitude, normalized longitude, observer height, full terrain-mask values and cell/height metadata, catalogue metadata including generation time and coverage, sample bounds, stay length and Earth-view threshold. Equivalent longitudes use [-180, 180). Any change hides results immediately; key effects clear stored results and pending status. Each request has a generation token; site A → B → A cannot resurrect an earlier A request. Unmount and replacement requests invalidate pending tokens.

Rendered metadata is captured with the request: coordinates, observer height, stay duration, Earth threshold, dataset generation and searched sample dates. The panel explicitly labels geometric sunlight windows and excludes battery, electrical load and masked-contact assessment.

Validation: `node --import tsx --test tests/search-key.test.ts` checks every key field, equivalent longitudes, unchanged renders, replacement, cancellation and A/B/A stale-token rejection. `npx tsc --noEmit` checks integration. No browser/server was started in this worker. Integrator still needs browser checks: search A then choose B while the panel remains open; change observer height and thresholds; rapidly search A/B/A; only current inputs may display results. This records automated lifecycle evidence, not a claim of browser verification.
