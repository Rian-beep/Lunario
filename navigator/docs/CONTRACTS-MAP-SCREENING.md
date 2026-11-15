# Map screening, ice evidence and startup — shared contracts

Locked for this build. Integrator approves changes. Base team main05b3aea / PR12.

## Ownership

| Lane | Owns (only) | Reads |
| --- | --- | --- |
| screening | lib/suitability/**, tests/suitability/**, docs/research/suitability/** | Existing astro, visibility, terrain, global-horizon, analysis/evaluator modules |
| ice | lib/ice/**, public/data/ice/**, pipeline/ice/**, tests/ice/**, docs/research/ice/** | Published NASA/PDS/author datasets and existing map projections |
| startup | scripts/startup-profile/**, docs/qa/startup-profile/** | All app sources; no shared code changes |
| integrator | Existing UI/maps/loaders/renderer/package/offline and all other paths | Every lane |

Workers are not alone: never revert other edits or touch another lane. No app server, Simulator, Metro, package changes, publishing, root release files or generated offline HTML. Isolated worktrees and branch commits; return tested SHA and exact commands/results. Integrator alone merges and regenerates artifacts. No unsupported data/claims, invented measurements, credentials or new full-mission assessment path.

## Screening module: lib/suitability/index.ts

Export types and functions, no React/browser globals at import:

- `ScreeningWeights = {sun:number;dark:number;slope:number;comms:number}` nonnegative finite, positive total. Default equal1 each.
- `ScreeningRequest = {catalog:Catalog;startIndex:number;endIndex:number;arrayHeightM:number;antennaHeightM:number;antennaMaskDeg:number;slopeScaleDeg:number;weights:ScreeningWeights;terrain?:TerrainData|null;globalTerrain?:GlobalTerrainData|null}`. slopeScaleDeg default10 is an explicitly labelled ranking preference, not a safe-landing limit. Do not mutate requests/data.
- `ScreeningPoint = {lat:number;lon:number;sunFraction:number|null;longestDarkHours:number|null;darkLowerBound:boolean;commsFraction:number|null;slopeDeg:number|null;score:number|null;source:string;spacingM:number|null;notes:string[]}`. score0–100, not probability/readiness. Weighted arithmetic mean of sunFraction, 1−longestDarkHours/stayHours, max(0,1−slopeDeg/slopeScaleDeg), commsFraction. Clamp finite component ranges; unknown with a positive weight makes composite unknown. Zero-weight components remain reported unknown but do not invalidate composite. All-zero weights invalid. Full-stay darkness is a bounded observation/lower-bound duration, not an arbitrary max.
- `screeningPoint(request,lat,lon):ScreeningPoint`. Reuse canonical buildSeries/summarize/visibility predicates and exact prepared horizons at the actual sampled coordinates/height. Global fallback is explicitly coarse, never a fabricated smooth terrain horizon. Unsupported heights/coverage stay unknown. Regional slope is derived from numerical elevations with measured grid spacing; no footprint safety claim.
- `screeningSamples(request, projection:'polar'|'global', options:{signal?:AbortSignal;onProgress?:(completed:number,total:number)=>void}):Promise<ScreeningPoint[]>`. Polar uses actual precomputed1980 grid points; whole Moon uses explicit coarse lattice (initial15° centers, max288 cells) and polar prepared points retained if practical. Yield cooperatively ≤one point/≤8ms work chunk, abort/cancel and avoid stale publication. Cache bounded geometry/horizons only, reuse across date/weight changes. Document sampling/resolution. No fake spatial smoothing or filling unknowns.

Integrator rasterizes/display-interpolates only within supported cells and reports lattice spacing. Map click uses existing exact-coordinate scenario analysis; layer is a regional screen. Full `evaluateScenario` remains sole full-mission authority.

## Ice module: lib/ice/index.ts

Prioritize actual published surface-ice detections / PSR regions carrying published M3 positive-detection evidence (e.g. author data with coordinates/polygons). Export a compact typed catalogue:

`IceFeature = {id:string;name:string;geometry:{type:'Point';coordinates:[number,number]}|{type:'Polygon';coordinates:number[][][]};evidence:'surface-ice-detection'|'ice-bearing-psr'|'impact-water-detection';sourceId:string;description:string;resolutionM:number|null;observationUtc:string|null;value:number|null;unit:string|null}`. GeoJSON longitude east, latitude degrees; store no invented footprints, no interpolation outside observations, no reserves/extractability claim. A regional PSR association is not a claim every point contains ice. Export `ICE_SOURCES`, parser/loader and data reference. Sources carry publication/dataset URL, version, frame/projection, original SHA and processing notes.

If usable confirmed-ice geodata cannot be obtained, report the precise evidence gap with a verified primary source and do not silently relabel hydrogen as ice. A separately named hydrogen proxy may be included as optional additional data only with explicit units, original source validity warning, nodata handling and no conversion to water/ice mass. Preserve licences and dataset credits. No gigantic downloads in Git; build reproducible compact files. All data must work offline without HTTP after embedding. Integrator handles embedding; provide a static JSON export or small validated data asset.

## Startup lane

Measure current web production preview on4317 remotely only if reachable; otherwise reproduce from a local build without running a server (static chunk/source analysis) and report limitations. No server/browser shared user changes. Produce concrete bytes/CPU/network evidence and targeted recommendations for eager global DEM6MB/local DEM12MB fetches, imagery metadata and flight calculations. Identify module cache/retry behavior, await/paint order and loader timing. No code edits outside own directories. Do not claim measured milliseconds from inspection or fabricate cold-cache runs.

## Gates

Each lane: focused meaningful tests and `npm run typecheck -- --incremental false`, `npm run lint` (no missing docs/code hidden by skips). Existing tests unaffected; document limits and report exact commands. Run with explicit paths, no Simulator/Metro. Commit only owned paths. No source/API/model or external operational-authority changes. Integrator validates combined app, actual web/file journeys, resource/request/latency receipts and current team-base integration before push/merge.
