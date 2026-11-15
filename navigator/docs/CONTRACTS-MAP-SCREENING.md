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

## UI integration lane (revision2, after numerical/data lanes verified)

Owner `map-ui` only: components/map-screening/**, lib/map-overlays/**, tests/map-screening/**. Integrator owns all existing maps/Navigator/styles/loaders/package/builder/renderer. Do not edit those. Base includes verified ice/suitability and `reweightScreeningPoints(request,points)` plus bounded `screeningLocations(request,locations,options)` exports. Existing lanes are complete; no active overlap.

Export from components/map-screening/index.tsx:

- `MapLayerSettings = {enabled:boolean;metric:'combined'|'sun'|'dark'|'slope'|'comms';weights:ScreeningWeights;slopeScaleDeg:number;opacity:number;iceEnabled:boolean}`; `DEFAULT_MAP_LAYERS` all layers off, weights1, scale10°, opacity.55. No localStorage/scenario-schema changes.
- `ScreeningViewport={west:number;east:number;south:number;north:number;cols:number;rows:number}` (unwrapped east/west permitted). At most256 point centres. Integrator will provide12×8 visible whole-Moon bounds only when zoomed; use minimum sample step at least global DEM angular spacing. Otherwise use global288 or exact polar1980. All geography/frame/source limits explicit.
- `useMapLayers({catalog:Catalog|null,state:ScenarioState|null,terrain:TerrainData|null,projection:'polar'|'global',visible:boolean,settings:MapLayerSettings,viewport?:ScreeningViewport}):MapLayerModel` with publicly typed model including `{raster:MapScreenRaster|null,iceFeatures:IceFeature[],points:ScreeningPoint[],status:string,progress:number,error:string}` plus controls needs. Async dynamic-import source lanes only on user demand; disabled does no large fetch/job. Request/coalesce global and local DEMs only when ranking is enabled, preserving failures/partial/unknown. No blocking initial map readiness. Abort stale/unmounted jobs, debounce viewport250ms, throttle progress, bound results cache≤2. Date/heights/mask/viewport/projection recompute physical metrics; weights/scale/metric/opacity recolour immediately with reweightScreeningPoints, never recompute physical jobs. Ice dynamic-imports compact static catalogue and validates; preserve offline by importing JSON within lazy chunk rather than requiringfileHTTP. No automatic external network service.
- `MapLayerControls({settings,onChange,model,onInspect:(lat,lon)=>void})`: compact controls to insert inside existing Layers popover. Rank toggle, factor selector, opacity, collapsible weight/scale configuration, exact explanation/units/intuition via accessible i/expandable details. Separate ice toggle, published evidence descriptions/links and optional select/inspect region. Do not call regional reference markers deposit footprints. No new full-page dialogue.
- `MapLayerLegend({settings,onChange,model,onInspect})`: compact dismissible/minimizable legend suitable over map, bounded width and scroll. Clear lower/higher/index or selected metric units; unknown uncoloured; selected dates, source/lattice resolution. Optional expandable top sampled points with raw factors/units and click-to-inspect exact sourcepoint. Public plain language; no readiness/probability claim. Existing theme vars, no NASA recolour, accessible labels, reduced motion. Component-owned styles.css, no globalfile edits. Avoid repeat assessment banner or big bars.

Export from lib/map-overlays/index.ts:
`MapScreenRaster={canvas:HTMLCanvasElement;projection:'polar'|'global';bounds?:{west:number;east:number;south:number;north:number}}` (polar covers catalog.map's full pixel rectangle; global default bounds−180..180/−90..90, optional viewport bounds). Integrator draws before pins/graticules using existing map transform; raster and text/circles must retain projection scale. Display cell colours only within sampled support; no fabricated unknown fill or spatial confidence. Index palette violet→amber→mint, text legend; ice blue with distinct shape. `drawIceMarkers(ctx,features,project:(lat,lon)=>{x,y}|null):void`, actual published location reference markers only, enlarged annotation symbols not deposit boundaries. No data inference from colour/counts. Expose pure raster sampling/ramp helpers for meaningful tests; no DOM at module import.

Metrics semantics: sunFraction in verified lane is mean **visible solar-disk fraction**, not fraction of time sunlit or electrical power. Darkness is longest observed within selected stay, lower-bound marker when censored. Comms is Earth-centre geometry including antenna cutoff, not station/RF strength. Slope is regional elevations, not footprint. Weights/10° scale are preferences, not launch/landing critical limits. Do not change these meanings for concise labels.

Gate: tests/map-screening/*.test.ts including unknown/known0, seam/poles/projection support, weight edits, bounds and SSR control labeling/source descriptions. Typecheck/lint green, no shared edits/servers/Simulator/Metro/push. Root performs actual browser integration and full offline build.

## Streaming and hosted entry lanes (revision3)

- `web-entry` owns scripts/build-web.mjs, web-source/**, lib/public-assets.ts, tests/public-assets.test.ts, the existing library IO URL boundaries listed in its dispatch, and focused docs/DEVELOPMENT.md. It never changes canonical metadata paths, maps/Navigator/runtime/material, package or root shell. Runtime `publicAssetURL(path)` defaults to existing Next paths and resolves canonical public paths against a validated web-only base. Parent resolves map/renderer IO paths.
- `ion-stream` owns lib/ion/**, components/workbench/scene/ion/**, tests/ion/**, docs/research/ion/**. It uses pinned NASA-AMMOS 3d-tiles-renderer0.5.4, fixed Moon asset2684829, conventional lunar body axes +X0°/+Y90°E/+Znorth mapped through scene/surface.ts. It never imports legacy NASA model axes as body axes. Tokens are explicit in-memory input only, never committed, stored, logged or embedded offline. Parent alone owns UI/runtime adapters.
- Integrator owns existing maps, Navigator, scene/runtime/material, package/dependency lock, root shell, generated web/offline artifacts and final validation. Maximum three active Sol workers plus integrator. Web/offline test claims require actual rendered journeys after merge.
