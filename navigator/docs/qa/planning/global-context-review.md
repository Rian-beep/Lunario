# T23 global-context numerical integration review

Reviewed the parent-owned live adapters in an isolated worktree based on `8792388`, with the actual calibrated global LOLA asset and the new `horizon-global` manifest entry. Adapter/type/schema/manifest files were copied into that worktree solely for validation and are not part of this review commit. This review owns only `tests/global-context.test.ts` and this record; it does not certify a later UI or portable build.

## Verified behavior

Seven integration tests use the real decoded 2560×1280 numerical asset, runtime historical-site augmentation, actual shared `resolveTerrainChoice`/`resolveAnalysisContext` and `evaluateScenario`, plus decision-package export/import. No alternate sunlight, contact or energy formulas are implemented in these tests.

- The manifest registers the actual gzip asset SHA-256 as partial evidence. Dataset identity includes the decoded asset hash prefix; model identity is `planning-3`.
- The frozen Apollo 11 historical demonstration without terrainMode, and explicit prepared mode, remain incomplete with unknown terrain generation. No historical missing-mask example silently upgrades to coarse coverage.
- Explicit global-context computes a finite numerical mask at the requested historical coordinates. Array/antenna evidence remains partial and describes requested coordinates, not borrowed polar-grid provenance. distanceKm0 describes computation at that point, not guaranteed spatial accuracy.
- Changing either subsystem height among 0/2/10 m preserves the other subsystem's series. A direct unsupported5m request remains unknown, and canonical input parsing rejects it.
- Matching named prepared masks take precedence at all three supported heights. Prepared2m custom polar masks retain priority; an otherwise unsupported polar0m channel can explicitly use coarse context.
- Missing global manifest registration, missing numerical DEM, and a synthetic unavailable-sample array preserve unknown obstruction. They cannot create a passing historical terrain assessment.
- Actual numerical pole and dateline queries are finite and stable. Inputs are not rounded; cache copies prevent a caller's mask mutation from corrupting later results.
- Export/import preserves explicit mode, dataset/model/scenario identity and partial evidence; imported historical metrics remain untrusted and the authority recomputes the result.

## Actual historical case, not a fabricated pass

For the stored Apollo 11 coordinates and baseline stay beginning **2027-06-29 11:00 UTC** for 336 h, explicit global-context evaluates **fails-assessed**, knownFraction1, generated energy **135332.68852925644 Wh** and unserved demand **50000 Wh**. The first known reserve-crossing bracket is **2027-06-30 17:00–18:00 UTC**, model offset approximately **30.4 h** from arrival. The same frozen scenario in prepared/legacy mode remains incomplete. These figures were read from the shared evaluator, not calculated in this prose. Availability of a coarse calculation does not make a randomly chosen site viable.

## Review finding and limits

No actionable numerical integration defect was found in this bounded review after the parent registered the actual global evidence. Initial positive tests correctly failed before the manifest entry existed; after copying the actual parent manifest they passed without fabricated source registration. A minor test fixture normalization assumption was corrected to preserve the exact positive input longitude, matching the no-rounding contract.

The underlying geodesic implementation uses calibrated PDS signed-half-metre elevations, DE421 mean-Earth registration and the existing spherical-curvature ENU expression. It does not reinterpret the NASA visualization mesh or image brightness as physical heights. Flat-sphere tangent dip, synthetic ridge, calibration, missing-data and pole/wrap unit tests remain separate evidence in `global-horizon.test.ts`.

Global evidence remains coarse and partial. Four-kilometre output spacing is not effective resolution, near-sample interpolation does not restore local obstacles, and frame/error propagation is unresolved. Full landing readiness still has unassessed external systems. This is a numerical adapter/export review; browser rendering, interaction, source labels in every UI state, offline injection/build parity, physical accuracy and accessibility remain separate gates.

Fresh verification: `node --import tsx --test tests/global-context.test.ts` passed all seven tests locally and in isolated Clevo remote Node validation using the same parent adapter/manifest snapshot and existing dependencies. Full local `tsc --noEmit` exited0. The review commit contains only the new test and this document; the parent must land its adapter/manifest integration alongside it. No server, build, browser/user context, simulator or dependency installation was performed.
