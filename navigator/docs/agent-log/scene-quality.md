# Scene quality worker — 14 November 2026

Workspace: `/home/luke/Storage/solarreach-navigator-20261114-worktrees/scene-quality`; branch `codex/scene-quality`. Owned changes: `components/workbench/scene.tsx`, new `components/workbench/scene/**`, this log. No push.

## Direction and completed implementation

Read `AGENTS.md`, `docs/CONTRACTS.md`, the approved map-first design and `docs/qa/rejected-flight-scene.png`. Current warm ivory UI and the two explicit 3D rejections override the archived dark-blue proposal. Applied the local frontend-design guidance without another interview. Instruction parity check passed. Qdrant recall was denied by the runtime's never-approve policy; searched canonical vault notes with `rg` instead, finding the older, different SolarReach lead-generation project rather than this lunar project. Do not merge those product histories.

Success criteria: continuous ground beneath the full propagated flight; numerical elevation separated from image appearance and reference context; readable current vehicle and spatial units; useful camera presets; meaningful imagery fallback and graphics failure recovery; ownership preserved. Visual acceptance remains the parent's/user's decision.

- Replaced the 30 km floating square and cream fog with one closed, curved Moon surface. Near-site rings resolve the fine numerical cutouts, then widen through regional DEM sampling to the far side. No procedural mountains or brightness-derived elevation. Heights stay at 1×.
- Blend nested DEMs from coarse to fine, with four-grid-cell display seams. Nodata/outside DEMs uses the flight's site-radius reference sphere, explicitly subdued/cooler and labelled. Fine-patch, regional-only and sphere coverage are distinguished; regional topography is not claimed as flight terrain-clearance evidence.
- Map the global equirectangular texture by body longitude/latitude; map polar overview and selected-site imagery by each image's `x0`, `y0`, `stepM`, width and height. Blend imagery at its extent edges. Fall back to bundled hillshade if imagery metadata is absent, or neutral material/remaining successful images on image load failure. Data URLs remain supported for the offline build.
- LROC images have acquisition lighting. The scene explains that baked shadows are historical and cannot become date-specific illumination or new numerical heights.
- Added a substantive generic lander: octagonal foil stage, equipment body, window, tanks, four braced legs with footpads, nozzle and antenna. Nominal leg span is 6 m. Automatic enlargement keeps approximately 48 pixels of leg span and exposes the current factor. Position remains the interpolated propagated ENU anchor; radial-up attitude is illustrative. Plume uses held powered state. Vehicle shadows are suppressed above 4× display scale to avoid fictitious kilometre-scale vehicle shadows.
- Thick depth-tested trajectory, brighter elapsed section, future section, four elapsed-time annotations plus ignition, dashed ground projection, current-vehicle reticle/label and ground guide. No physics changes.
- Flight camera fits complete bounds and aspect ratio with padding; Follow translates with the current vehicle while retaining user orbit offset; Orbit frames the selected site; Surface begins 3 m above displayed ground. Camera presets change without rebuilding terrain. Reset, pointer/touch orbit, zoom and focused W/A/S/D +/− controls are retained/provided. Root left/right time keys remain untouched; damping and automatic decorative motion are absent.
- Local scene coordinates are km: +X east, +Y tangent up, −Z north. Frame basis, input metres, reference radius and radial surface construction are explicit in code. Named ENU arrows have km lengths; text telemetry distinguishes tangent up from radial altitude/clearance. Sun is filled amber; Earth is a blue ring.
- Warm ivory glass camera controls and an expandable Surface & scale description explain source sampling, coverage, lighting, camera choices and scale. Controls/readout are raised above the existing root flight telemetry when flight is shown. The horizon overlay is opt-in for Surface view, with configured observer height distinguished from the 3 m camera; unknown mask intervals are not joined.
- Lighting: no fog/atmosphere or decorative stars; black lunar sky, supplied site Sun azimuth/elevation retained even below the horizon, directional light intensity 3.5, small disclosed 0.18 display fill, ACES tone mapping/exposure 1.25, 2048² shadow map with camera-dependent shadow coverage. Illumination outcomes continue to come from the root science path.
- Context loss, initialization/render/shader failure display a text fallback and Retry 3D; failures preserve diagnostic console errors. Cleanup releases controls, observers, listeners, animation frame, geometry, materials, textures (including late asynchronous loads), shadow target and renderer. No server/browser/package install/heavy render was used.

## Parent integration

The existing SceneProps contract remains compatible. Added optional `referenceHeightM?: number`: parent should pass **the exact base elevation already used in `simulateFlight(..., 1737400 + base)`**. Default is `heightAt(terrain, lat, lon)?.heightM ?? 0`, matching normal covered sites. Passing this prop matters when terrain is unavailable and the parent instead uses catalog `site.demHeightM`; scene cannot reconstruct that catalog fallback from current props. `imagery` is already passed by root. No other prop additions needed.

Parent synchronized imagery assets, packed finer DEMs and `lib/terrain.ts` into this worktree while work proceeded. Those files are intentionally excluded from worker staging/commit. Surface precedence follows effective DEM source sampling; nested seams blend down through the next coarser cutout.

Scene-specific tests live in the owned directory, `components/workbench/scene/surface.test.ts`. The repository's current `npm test` glob covers only `tests/*.test.ts`; parent can include the scene test path in its validation invocation or extend that glob in its owned package configuration.

Parent owns visual QA: inspect wide/split/narrow layouts, both side panels open/closed, black-scene header contrast, flight start/midpoint/end, reverse scrubbing, all four cameras, daytime/nighttime, fine/regional/sphere boundaries, texture failure, context loss/retry and offline image data URLs. No screenshots from a new render and no user creative acceptance are claimed here.

## Verification

Dependency ready marker observed before validation.

- `npm run typecheck && npm test && npm run lint`: typecheck passed; `npm test` stops at `listen EPERM /tmp/tsx-1000/*.pipe` because the sandbox prohibits the tsx CLI IPC listener, so this exact chain cannot reach lint. Reproduced the same failure on an isolated `git archive HEAD` baseline in `/tmp/solarreach-scene-baseline`.
- `npm run lint` separately: exit 0, eight warnings in unchanged `components/navigator.tsx`, zero scene warnings. Isolated baseline lint reproduces those exact eight warnings.
- Sandbox-compatible test run: `GOMAXPROCS=2 node --import tsx --test --test-concurrency=1 tests/*.test.ts components/workbench/scene/surface.test.ts`: seven test files pass. Also ran direct import registration to obtain individual results: **36 tests passed, zero failed** (30 existing + six new scene cases). Bounded Go concurrency avoids esbuild's sandbox thread limit. Node-only CommonJS loading of Three emits its upstream deprecation warning; browser source imports use ES modules.
- Six scene cases verify ENU metre/km mapping and exact spherical curvature beyond 150 km; missing DEM/context radius; nested-height precedence/seams; polar image orientation/non-square extents; finite, outward-facing complete surface beyond a 100 km footprint; Sun/Earth compass convention.
- Generated the actual custom shader callback snippets into minimal GLSL harnesses and ran `/usr/bin/glslangValidator -S vert /tmp/solarreach-surface.vert` and `-S frag /tmp/solarreach-surface.frag`: both passed. This checks custom shader syntax, not browser GPU integration.
- CPU geometry smoke check using synchronized packed DEM decoded by `decodeTerrain`, LCROSS coordinates: 274,505 vertices, 546,816 triangles, zero nonfinite coordinates. Site numerical and display height both −3647.7348567555437 m; geometry generation about 777 ms in this run. This is not a GPU frame-time benchmark.
- `git diff --check`: passed. `slop-scan` is not installed/configured; none was installed.

## Genuine limits / durable handoff

Global context is a smooth site-radius sphere outside numerical DEM coverage, with real image appearance where available. Mesh sampling becomes coarser away from the selected site and is not full source resolution everywhere. Orbital images retain historical shadows. Lander geometry, attitude, plume and display fill are illustrative, explicitly separated from physical translational results. Shadow-map fidelity varies with the preset and region extent. GPU speed, actual WebGL visuals, screen-reader/200% zoom behavior and offline browser operation await parent QA; CPU tests and shader syntax are not creative approval.

Durable decisions and rejection context are saved in this owned log. Canonical shared-vault writing/indexing is outside this worker's explicitly limited file ownership and filesystem write roots; parent should fold relevant accepted integration results into the lunar project's canonical memory hub. No claim of canonical memory indexing is made.

## Commit delivery constraint

Staging in the worktree failed before any index change: the shared `/home/luke/Storage/solarreach-navigator-20261114/.git/worktrees/scene-quality/index.lock` is on a read-only filesystem in this worker sandbox. Approval policy is never. To deliver a real reviewable commit without changing shared metadata, create a private Git store under `/tmp/solarreach-scene-quality-git`, parented to this checkout's HEAD, and commit only the explicit owned paths. Deliver `/tmp/solarreach-scene-quality.bundle`; parent can import with `git fetch /tmp/solarreach-scene-quality.bundle HEAD` and cherry-pick `FETCH_HEAD`. The original shared branch is unchanged by this workaround. No remote is contacted.
