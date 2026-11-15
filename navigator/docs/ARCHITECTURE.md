# Architecture

Lunario (legacy internal names SolarReach and Lunar Window) is a Next.js / React / TypeScript lunar-site workbench with a self-contained HTML export. There is no account system, backend database or private vehicle data service.

`components/navigator.tsx` owns scenario, audience, date range and playheads. Site, date, observer height and hardware assumptions are shared across 2D map, 3D rendering, charts and saved comparisons. Environmental time is in UTC/hourly samples; the flight preview has its own seconds clock. Radio assumptions are part of the scenario. End UTC is the exclusive end of the final hourly integration interval. Scenarios and comparison preferences are saved in browser local storage and can be exported. Scenario links encode their inputs; they do not share a private backend record.

`lib/catalog.ts` decodes the supplied Horizons/LOLA catalog. `lib/astro.ts` remains the original celestial geometry and terrain-horizon analysis path. `lib/mission.ts` consumes its samples for array, battery and direct-contact screening. `lib/flight.ts` integrates generic finite-burn 3-DoF central-gravity motion with bounded mass and optional terrain contact. `lib/terrain.ts` reads georeferenced numerical height patches and distinguishes unavailable height from a real zero value.

`components/polar-map.tsx` renders the polar-stereographic canvas, with bounded supported Moon Trek WMTS imagery over bundled relief. `components/workbench/scene.tsx` uses Three.js. Scientific SVG charts use named axes, units, legends, numerical hover values and preserved gaps. `info.tsx` and `lib/glossary.ts` provide audience-specific explanations and physical/mission-specific limits.

Numerical terrain and imagery preparation are separate from runtime. The archive's horizons came from 40/240 m LOLA DEMs. New mesh heights use nested NASA PGDA 5 m, 10 m, 40 m and 80 m products with explicit source and display sampling. Int16 packed heights retain 0.1 m quantization where their range permits; missing samples remain missing. LROC imagery has historical acquisition illumination and must not be treated as epoch-specific simulated light. Numerical terrain, map imagery and visibility masks have different resolutions and coverage.

The offline build inlines catalog, terrain, imagery and code. Optional online imagery can fail independently; supported bundled assets remain usable. WebGL failure does not disable the 2D map or numerical analyses.

This is a screening and educational workbench, not a qualified flight-navigation system. See the numerical model notes and validation evidence for bounds.

Audience introductions are native modal dialogs with distinct Public, Educator and Planner explanations. Each mode selection opens its dismissible guide; the header can reopen it. `lib/windows.ts` derives four-state visibility counts and next sampled transitions without crossing unknown intervals. These transitions are approximate hourly boundaries, not fitted event solutions.

Charts preserve native samples and gaps, offer keyboard sample traversal and persistent text readouts, and distinguish UTC, elapsed flight seconds, radial altitude and local tangent coordinates. Inspection light affects the rendering only; epoch light and numerical sunlight remain separate.

NASA’s original topographic GLB is prepared into a lossless position-welded mesh retaining all 1,015,808 triangles and its unchanged 8K JPEG. `lib/nasa-model.ts` validates/decompresses fetched or embedded assets. The globe camera loads it on demand and rotates its verified +X prime-meridian, +Y north, −Z east frame into local east/up/−north scene coordinates. Its unitless relief has a documented nominal globe scale and is never used for contact, visibility or site elevation. Local LOLA geometry remains physically separate.

Timeline presentation has compact, expanded and dismissed states stored separately from mission assumptions. Dismissing pauses environmental playback; restoring preserves the scenario and playhead. Prepared-only locations without a measured horizon use explicit unknown masks. Explicit coarse global modes compute requested-coordinate terrain context from calibrated LOLA; this remains partial evidence and cannot certify local hazards. Older records do not silently change mode.

## Shared planning decision layer

Schema-2 scenarios retain display height plus independent array/antenna heights, requirements, operations and optional external reports. `lib/analysis-context.ts` resolves body channels separately against `public/data/evidence-manifest.json`. `lib/assessment.ts` is the full-scenario authority; it invokes `lib/mission.ts` for terrain and sphere, then applies transparent constraints. Model events use `lib/mission-events.ts`.

`lib/planning-search.ts` evaluates complete stays with cooperative cancellation; `lib/alternatives.ts` adapts the regional contingency matrix to the same assessment. `lib/scenario-diff.ts`, `lib/sensitivity.ts` and `lib/mitigations.ts` explain actual changed inputs and tested outcomes. `lib/decision-export.ts` packages evidence and always recomputes imports. `lib/teaching.ts` captures controlled experiments without a second energy model. No additional backend or external runtime model is introduced.

NASA equipment uses a pinned original GLB with the local upstream Draco decoder. The standalone builder embeds both and the evidence manifest. Decoder code is preserved as third-party distribution and excluded from application-style ESLint rules; original hashes and licensing remain auditable.

## Engineering, physical-scale views and live rendering

Optional schema2 engineering inputs and source records are validated separately from qualified external reports. `engineering-context.ts` binds them to site, stay and dataset. `engineering-screens.ts` performs bounded SI-valued analytical calculations; `assessment.ts` includes supplied required screens while retaining independent missing qualified evidence. Comparisons and exports read that authority and preserve identity/provenance. `physics-reference.ts` is explanatory, never an additional assessment engine.

`lib/playback.ts` anchors simulation position to wall time; frame stalls do not discard elapsed time. Source sample duration converts physical hours per wall second to sample positions per second. Resource and elevation charts share the cursor. Reduced motion changes publication cadence, not the underlying clock rate.

The Moon renderer reads live flight/horizon data and updates their buffers without reconstructing NASA assets or the WebGL context. The nominal7m lander stays1× in kilometre world units. The Earth–Moon view uses installed NASA geometry and a separate georeferenced Blue Marble ellipsoid for DSN coordinates. Provider weather is optional, dated, independent of mission-date geometry and unavailable offline; the offline scene/data remain complete.

## Terminal flight and camera follow

The header owns view, asset focus and repeated focus-request identity. Scene instruments render into its stable portal target; opening Learn or closing Inspector does not remount WebGL. Flight and environmental clocks remain separate wall-time clocks. `landing-flight.ts` owns configured terminal guidance, while `flight.ts` preserves legacy manual trajectories. Both publish metre/second incoming contact states when available. The parent passes latitude and entered collision assumptions explicitly.

`scene/contact-dynamics.ts` prepares a bounded finite numerical heightfield and fixed-rate Rapier replay before contact. The frame cache is cancelled and invalidated when scenario, terrain or geometry changes. Runtime converts once between physical SI values and the kilometre display frame. Follow translates camera and target by the rendered vehicle mass-centre displacement, preserving the user's relative offset through contact. Telemetry callbacks are throttled by wall time with playback-rate-aware freshness; paused and scrubbed frames reject unrelated samples. Actual body data remains separate from the display origin.

Authored formulas are precompiled to native MathML by `scripts/build-mathml.ts`; web and offline builds check the immutable expression registry before bundling. The Temml parser is a build dependency rather than a browser dependency.


## Unified replanning and audience workspaces

`components/replanning` and `lib/replanning` capture exact reference/candidate states, reuse `evaluateScenario` and link an explicitly elapsed or overlapping-UTC cursor to measured resource/contact curves and site context. Controlled candidate scans yield and cancel between canonical evaluations; partial/conditional evidence is never promoted by a score. Header task context uses the same assessment. Full teaching dialogs reuse notebook schema/storage, and the inspector notebook is unmounted while the studio owns those keys.

`components/engineering` and `lib/engineering-evidence` own separately scoped station and declared-bound envelopes. They never mutate the canonical scenario or issue an operational approval. Dated geometry, lunar masks, station skyline, radio/weather assumptions and allocation must all cover a slice before conditional capacity is summed. Raw Horizons responses are reparsed on import; source labels are not authenticated mission evidence. Independent developer fixtures are under `public/data/engineering-evidence`. Engineering draft state remains mounted when its native dialog is closed; export preserves it across leaving the app.

Native `WorkspaceDialog` preserves the mounted Moon scene and supplies modal focus/Escape behavior. Global time shortcuts ignore dialogs. Camera framing uses measured DOM obstacles, decoded vehicle bounds and off-axis projection rather than moving the physical COM target or resizing NASA geometry.

## Shared imagery and authored teaching materials

`lib/moon-atlas-texture.ts` gives globe and local terrain separate reference-counted leases on one original NASA8K atlas. Cancelling a consumer settles that consumer immediately; another active consumer retains its image. Last-owner release and late image settlement dispose resources. Imagery is independent of numerical terrain and cannot establish fine landing hazards. Six bundled NAC centre patches provide approximately2.09m/output pixel within their stated bounds; arbitrary points retain coarser actual coverage. The standalone builder aliases the embedded global atlas rather than encoding the same image twice.

`lib/education-materials/index.ts` builds student-safe captured givens, teacher interpretations and printable documents from an immutable actual scenario/evaluator capture. `components/education-materials/material-builder.tsx` owns explicit capture/recapture, topic selection, editable prompts and separate student/teacher downloads. Merely changing the navigator does not overwrite a captured lesson. Student exports exclude teacher answers and full scenario payloads. Known zero generation and unavailable forcing remain distinct even when collecting area is zero; native symbol legends and units remain visible. Authored mathematics uses the same precompiled native MathML catalogue as the app.

## Brand startup and flight interaction

The original Lunario logo and loader are pinned under `public/branding/lunario/`; `components/branding/generate-lunario.mjs` generates self-contained strings/data URLs. The document owns one vendor overlay across React remounts. Its supported minimum-duration option is 3000 ms and the session-only suppression option is omitted, so old session keys cannot hide a reload. The original reduced-motion behavior is retained; real catalog readiness requests its exit, and the returned vendor completion promise gates the native audience dialog. This avoids a top-layer dialog obscuring the source animation. The original altitude animation is disabled through its supported option because it is not mission telemetry. Fonts and SVGs remain available in the disconnected export.

`lib/flight-experiments.ts` creates explicit reference inputs and scoped diagnostics. It does not alter the production integrator, planning authority or contact coefficients globally. Navigator owns the seconds clock, reset/replay request and pending play; the scene reports completed-render Follow readiness. Switching local vehicle/Follow views preserves the viewing offset instead of taking the celestial transfer arc. Loading a reference or editing inputs pauses/resets the experiment; camera changes preserve edits.


Scene initialization yields through an animation-frame opportunity and a subsequent task before constructing WebGL. This lets an asset selection paint first. The pending mount is cancelled when dependencies change or the scene unmounts; a transferred globe is retained for the next mount or the existing unmount disposer. Already-mounted scenes keep consuming live inputs without rebuilding the renderer. `tests/after-paint.test.ts` checks both cancellation windows and one-shot execution; actual framing/playback is checked in the browser. This scheduling change does not change the physical model or guarantee a frame-rate/latency bound on every device.

## Optional Earth orbital context

`lib/orbits.ts` validates dated GP elements and predicts positions with satellite.js SGP4. `earth-orbits.tsx` owns explicit catalogue controls; the persistent scene updates markers without rebuilding lunar assets. `app/api/orbits/route.ts` caches a fixed, bounded set of CelesTrak identities and retains prior dated data on failure. Offline imports use the same validator and no HTTP. Orbital time never modifies the lunar scenario or evaluator. See ADR 0011 for frame, cache and validity boundaries.

Measured close-view tessellation uses `lib/terrain-lod.ts`; existing source spacing and coverage determine detail. Cooperative geometry replacement retains the prior mesh until ready. `lib/lunar-projection.ts` avoids polar floating-point cancellation in texture lookup. Chart SVG viewboxes and circular variable controls preserve proportions across layouts.

## Audited inputs and reference replay

Planning-5 binds corrected Moon-observed Earth range and registered terrain to new dataset identities. The verification compiler requires explicit reviewed hash bindings for numerical code, inputs and receipts, plus outcome/coverage gates; it never creates new observations. The Sources panel renders native equations and pipeline dependencies alongside scoped findings. Historical baseline evidence is labelled separately.

The lazy mission-path workspace owns a separate monotonic seconds clock and bounded source-frame positions. Its NASA visual Moon is an IAU_MOON display with unqualified map registration; no replay position enters evaluateScenario or the contact solver. Ordinary editable landing previews retain the canonical flight engine. Progressive NASA colour/visual-only radial samples never enter scientific height or horizon calculations. Offline embeds1K/2K/4K tiers and calibrated radii; high-memory web clients may upgrade to8K. Texture leases, cancellation and disposal are per-renderer and bounded independently of date-variable changes.

## Evaluation evidence boundaries

`evaluateScenario` remains the overall mission assessment authority. `evaluateEvidenceConfidence` interprets that exact scenario and analysis context for audience-specific disclosure; it creates no success probability. Finite cases export the full held scenario and refuse stale result downloads. Data & math is loaded on demand.

The separate `station-comms-2` evaluator reparses archived observer bytes, request settings, UTC sampling, EOP coverage and input chronology before computing conditional capacity. Its evidence summary separates station geometry, lunar rays, local horizons, compatible radio hardware, dated weather and allocation assumptions from authenticated service support. Imports retain original retrieval provenance and API JSON metadata when supplied.

Historical CLPS extracts use hash-pinned source kernels and an independent historical clock. Moon-fixed IAU_MOON display is kept separate from mean-Earth planning terrain and educational contact dynamics. Renderer paths split at missing intervals; unsupported inertial frames cannot be drawn as Moon fixed.

The scientific publication compiler checks reviewed source identities and outcome receipts, including current station comparisons and 740 CLPS source states. It refuses stale evidence or failed residual gates. Live HTTP failures remain explicitly incomplete; they are not converted into comparison passes.
