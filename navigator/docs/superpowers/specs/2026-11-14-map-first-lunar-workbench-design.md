# SolarReach map-first lunar workbench

Status: proposed for Luke's approval, 14 November 2026. This supersedes implementation assumptions in the initial research proposal now that the handoff source is available. Luke confirmed lunar landing and departure first; Earth launch and translunar transfer are outside this build.

## Outcome

Turn SolarReach into a spatial workbench for comparing lunar landing sites and dates, with a dominant 2D map, true 3D terrain and a parameter-driven lunar flight preview. Public, Teach and Plan have different tools and depth while sharing scientifically consistent results. Luke requests minimalist, premium, Cadence-inspired transparent glass UI and use of every resource family in the challenge Resources tab.

## Verified starting point

Source was extracted from `/Users/lukedudley/Downloads/solarreach-navigator-handoff.zip`. The archive remains untouched. Embedded Git metadata was not activated: its origin is a temporary Cursor repository and its hooks path belongs to the previous build environment. Do not push this source to that origin. The previously supplied Rian-beep repository is public and has only a README; publication destination and visibility require resolution before pushing, without blocking local development.

Existing stack is Next.js 15.5, React 19, TypeScript and Tailwind with Base UI/shadcn primitives. Keep it. Existing source contains an interactive polar canvas map, horizon and elevation canvases, date controls, three audience toggles, fixed comparisons, a date-ranking tool and a working self-contained HTML export. The map currently sits in a 340px sidebar; the oblique view is explicitly a 2D sketch. Audience modes mostly change text and expose a few extra numbers.

Nine catalog locations, hourly 2026–2027 Horizons-derived data, per-site LOLA horizon masks at 0/2/10m, coarse custom-coordinate masks, and a 1013px hillshade are included. The map image scale is 600m/pixel, despite the source DEM being 40m/pixel. Raw elevation GeoTIFFs are not included. Existing validation metadata describes a prior pipeline run; it is not fresh verification of the decoded browser data.

The baseline offline app was opened in a browser. It rendered the map and Connecting Ridge results. The observed console errors were favicon requests returning 404 on the temporary static server. No source typecheck or full application test has yet run, and no product source has been changed.

## Approaches and recommendation

1. **Extend the existing application into one map/3D workbench — recommended.** Reuse the existing polar projection, site selection and astronomy path. Add numerical mission models and Three.js for real 3D rendering. Preserves working science and offline support while changing the product structure materially.
2. Embed Moon Trek or QuickMap as the main interface. Integration would depend on their embedding and state contracts, limiting synchronized time, custom engineering tools, coherent glass UI and offline operation.
3. Replace the whole application with a new globe stack. Adds migration and duplicate-science risk without solving a requirement the existing framework prevents.

Framework, renderer and implementation organization are builder decisions; Luke's confirmed direction is the experience and lunar scope. No database, auth, or second UI component library is needed.

## Workspace and visual contract

```text
 SolarReach     Public / Teach / Plan       Location search     Sources
 ┌───────────────────────────────────────────────────────────────────────┐
 │ [Site/layer drawer]        2D / 3D / Split        [Scenario inspector] │
 │                                                                       │
 │              Dominant lunar map / terrain / flight preview             │
 │                                                                       │
 │ [Scale / coordinates]                          [View / zoom controls]  │
 └───────────────────────────────────────────────────────────────────────┘
 [UTC / date range]   [Play / speed]   [Sunlight and Earth-view timeline]
 [Expandable comparison tray — chosen columns, thresholds and export]
```

The viewport dominates the initial desktop screen; no long introductory text or card grid before the map. Panels float and collapse. Time controls stay reachable. At narrow widths, retain the viewport and move controls to sheets rather than compressing desktop panels. Preserve selected site, custom point, date range, observer height, camera target and comparisons across views/modes. Retain keyboard scrubbing/map control, visible focus, no autoplay, shape-distinguished Sun/Earth, and reduced-motion behavior.

Proposed tokens: lunar charcoal `#10141B`, pale foreground `#EEF2F6`, subdued slate `#A8B3C2`, sun amber `#FFC56B`, Earth blue `#80C8FF`, and glass edge `#FFFFFF24`. Glass panels use sufficiently opaque dark backing plus blur; dense tables use stronger backing. Outfit remains the interface family, with tabular figures; serif display headings stop dominating the functional workspace. Palette shift follows Luke's glass UI request rather than the archived warm-paper preference. The terrain is the visual focus; no decorative glow or starfield competing with it. Sunlight and Earth remain distinguishable by shape and labels as well as color. Contrast and transparency are tested over actual imagery, with reduced-transparency and increased-contrast alternatives.

## Three substantive modes

- **Public:** explore named sites, move the date, inspect terrain/Sun/Earth in 3D, understand sunlight and communication through short explanations. Flight preview has approachable controls with advanced inputs progressively disclosed. Results retain accuracy labels.
- **Teach:** guided experiments with a question/prediction, controllable comparison and revealed explanation. Start with terrain versus smooth sphere, observer-height effects, and changing the date at a polar ridge. Provide annotated horizon/angle charts and shareable scenarios. Experiments use computed results; do not promise a particular percentage independent of dates.
- **Plan:** input mission duration, array geometry/area/efficiency/losses, load and battery assumptions, antenna mask and mission thresholds. Inspect operational windows, numerical results, data quality and constraints; compare scenarios and export reproducible data. Surface slope is limited by the provided DEM baseline; missing roughness or radio parameters display as unavailable.

## Data and resource contract

All four resources in the live challenge Resources tab have distinct roles:

| Family | Contribution | Honest boundary |
|---|---|---|
| JPL Horizons | Existing ephemerides plus supported refreshed queries when needed | Preserve one astronomy path; validate decoded data, times, longitude wrap and body frame against observer queries |
| Moon Trek | Supported lunar WMTS imagery/science layers with metadata and source links | Verify actual lunar CRS/tile matrix, coverage and service terms; rendered tiles are not numerical heights |
| QuickMap / LROC | LRO dataset discovery, high-resolution site imagery where supported, and location-specific cross-check links | Do not claim the viewer URL is a general API; integrate underlying supported products rather than scrape its UI |
| CSA Moon Exploration | Curated mission/teaching context and attributed learning resources | It is an educational portal, not a numerical terrain or trajectory source |

Numerical terrain comes from NASA GSFC PGDA LOLA products, especially product 90, with higher-resolution regional products when coverage supports them. Retrieve relevant numerical raster windows and metadata, not complete multi-gigabyte catalogues. Add deterministic terrain-preparation tooling with configurable paths, coverage/resolution and provenance. Mesh heights must come from the numerical product, never image brightness or synthetic noise.

The normal app may offer supported optional online layers and imports; the offline export retains bundled imagery, horizons, prepared terrain for available areas, science and simulation with no required external requests. Unsupported 3D terrain coverage is clearly labelled, with a smooth reference-sphere view as a usable fallback. Do not promise exact terrain under a custom point when only the nearest horizon cell is available. No full Moon-wide elevation download is required for a south-polar product.

Existing analysis covers 80–90°S and 2026–2027. Show the bounds in controls. Broader dates require fresh data and a valid provider range; unavailable dates must never silently reuse the last sample. A wider contextual map does not imply wider terrain-analysis coverage. Keep terrain and smooth-sphere results together.

## Mission calculations

One scenario consists of coordinates/site identity, landing UTC, duration, observer height and hardware assumptions. Existing `lib/astro.ts` remains the source of Sun/Earth geometry and terrain masks. Add separate pure calculation modules which consume its samples; do not fork celestial geometry.

1. **Visibility:** solar disk fraction and Earth-center clearance against the terrain horizon, time fractions, contiguous intervals, longest darkness and longest Earth blackout, simultaneous sunlight/contact windows. Preserve hourly sampling bounds; interpolation for drawing is not new scientific precision.
2. **Power:** incident flux × area × efficiency × explicit losses × panel-normal incidence × visible solar-disk fraction. Offer fixed orientation and Sun tracking. Use a sourced/documented flux assumption or available range scaling. Integrate Wh over the requested interval, separately for terrain and sphere.
3. **Battery:** load profile, initial state of charge, usable capacity, charge/discharge efficiencies and reserves. Integrate generation minus load, enforce capacity, expose unmet load and deficit energy rather than allowing negative storage to look valid. Report assumptions next to the result.
4. **Communications:** geometric visibility with a user elevation mask and known observer height. A link-budget calculator can use user-supplied frequency/power/gains/losses/noise/data-rate assumptions; report incomplete when missing. Do not turn Earth visibility into an invented DSN contact schedule or a guaranteed usable link. Ground-station visibility requires the actual station location/model.
5. **Surface screening:** provided height/slope with baseline/resolution and derived status; roughness and landing-ellipse hazard statistics only when supported by numerical coverage. No landing-safety certification.

Compare any selected subset of the nine catalog locations plus custom scenarios, including the same location at different dates. Remove the arbitrary three-site limit. Users add/remove/reorder available metric columns, sort, choose a reference and set thresholds. User-entered metrics require a name, type and unit and stay distinguishable from computed values. Include terrain/sphere companion values for relevant metrics. Export selected comparisons and a scenario/assumptions/provenance record, not only unlabeled numbers.

## Actual 3D and lunar flight preview

Use a real depth-tested Three.js scene with numerical terrain where available, local north/east/up orientation, orbit and surface camera controls, selected-site marker, Sun/Earth directions, horizon overlay, scale and model labels. Preserve a text result equivalent and a non-WebGL fallback. Separate accurate directional geometry from decorative scale: Sun/Earth discs and a lander may need explicitly labelled visual scaling.

Provide lunar ascent and terminal descent as two finite-burn 3-DoF translational previews under central lunar gravity. Integrate Cartesian position, velocity and mass with a documented solver. Use sourced lunar gravitational constants. Inputs include site/epoch, initial altitude and local velocity, heading/pitch, wet/dry mass, thrust, specific impulse, burn duration and coast duration. Descent may start at a user-defined altitude over the selected site; this is a local approach preview, not a solved transfer from an arbitrary orbit.

The initial guidance contract is a user-defined local pitch/heading held or changed by a bounded pitch-over profile, expressed consistently in the propagator frame. Document the lunar-rotation approximation or transform it consistently; changing epoch must update body orientation and lighting without inventing an artificial date effect on central-gravity dynamics. Show flight time, altitude, speed, acceleration, remaining propellant and closest surface approach. Stop/classify surface contact, fuel exhaustion and time bounds. Flight telemetry has a separate seconds-based playhead; changing the mission epoch reinitializes flight rather than confusing the hours-based environmental timeline with burn time.

Terrain collision is only classified using adequate numerical coverage/resolution. Outside that coverage, show reference-surface intersection and mark terrain clearance unknown. No claim of precision landing, closed-loop guidance, six-DoF dynamics, engine qualification, operational trajectory optimization, or certified safety.

## Implementation and verification sequence

1. Restore a reproducible local development environment, record baseline typecheck/lint/build and browser behavior, and preserve original source/data provenance. Fix verified setup issues such as the standalone script's hardcoded `/opt/cursor` output path.
2. Implement the map-first shell, responsive panels and synchronized view state. Preserve interaction contracts and all existing science outputs.
3. Add pure planner/flight calculation modules alongside meaningful numerical tests. Test known analytic cases, units, invalid inputs, battery saturation/deficits, unpowered energy conservation, mass flow, contact and termination.
4. Prepare numerical terrain cutouts; build true 3D and flight controls with labelled fallback/coverage.
5. Add modes, configurable comparison/scenarios, resource integration and exports. Verify each visible source claim against the real data path.
6. Run typecheck, lint, production build, numerical regressions, a fresh Horizons comparison if geometry/decoding changes, and appropriate browser checks. Rebuild and open the offline export with networking disabled. Check desktop/narrow layouts, 200% zoom, keyboard flow, reduced motion/transparency, errors and WebGL failure. Screen-reader qualification remains explicitly unverified until actually tested.

Add a unit-test runner appropriate to the existing TypeScript stack; the archive has none. Update README, user-facing changelog, architecture/development notes and consequential decision records with the behavior. Inspect staged changes and secrets/large assets before any publishing. Never treat historical handoff assertions as proof that a fresh build passes.

## Decisions and approval

Confirmed by Luke: supplied archive is the existing app; simulation starts with lunar landing and departure; visual direction is clean premium transparent glass; use all brief resource families and substantive audience modes.

Builder proposals for approval: extend the existing Next.js app; expand its map to the main workspace; use real numerical terrain and Three.js; add explicit simplified lunar-flight and mission-resource models; preserve a self-contained offline experience and show data limits. The handoff's kickoff-only text does not replace Luke's feature request, and its warm-paper/no-online-viewer suggestions do not override the requested redesign and resource integration.
