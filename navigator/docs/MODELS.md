# Planning models and evidence boundaries

The `planning-5` assessment evaluates explicit mission assumptions against prepared celestial directions and terrain horizons. It is a resource screening tool. Selecting landing-readiness scope adds required external evidence rows; it does not create missing trajectory, hazard or thermal evidence.

## Time and coverage

Catalogue epochs span 2026-01-01T00:00Z through 2028-01-01T00:00Z. Each forcing sample supplies the following interval. The final epoch is an endpoint only; no additional interval is extrapolated. Arrival and departure describe a half-open UTC stay. Inclusive forcing indices end at most at `n−2`. Imports and date changes that exceed coverage or invalidate a scheduled window are rejected without trimming the inputs.

Environmental forcing remains hourly. Subsegments split that forcing at user-configured deployment and load boundaries; those splits do not add physical sunlight measurements. Rise/set countdowns show adjacent-sample brackets. Internal event offsets are model estimates within the forcing bracket.

## Independent instruments

Display-observer height remains separate from solar-array and antenna height. Named sites have prepared masks at 0, 2 and 10 m. Custom points use a nearest prepared 2 m grid horizon, with actual cell coordinates and distance exposed. No safe borrowing distance is assumed. Unsupported heights or absent horizons remain unavailable. Historical spacecraft coordinates do not acquire invented polar masks.

Prepared named/custom azimuth spacings are 1°/3°. The original horizon calculation used 40 m terrain with 240 m fallback. Finer display DEMs do not upgrade those masks. Source frames and unresolved equivalence are documented in [ADR 0005](decisions/0005-planning-evidence-contract.md); otherwise passing terrain requirements remain conditional.

## Electrical resources

Generation uses the existing fixed irradiance × array area × conversion efficiency × retained fraction × incidence × uniform visible solar-disk fraction. This is a disk cut by the local sampled horizon, not a two-dimensional terrain-disk integration. Before array deployment, useful generation is zero. Baseline load and all overlapping scheduled additional loads sum.

Charging surplus and discharging deficit are capped on the bus, then storage efficiencies apply. A null cap explicitly means unlimited in this model; zero prevents that flow. Stored energy is bounded by zero and capacity. Unserved demand remains visible rather than disappearing behind a zero battery reading. Unknown solar forcing poisons subsequent storage; known violations before a gap remain reportable.

The evaluator retains interval-end storage and all operation subsegments. It finds reserve crossings and unserved demand onset analytically within constant-power subsegments. Four dark hours at 100 W with 300 Wh initial energy, 20% reserve and unit efficiencies give 100 Wh unmet demand, a reserve crossing at 2.4 model hours and 1.6 hours below reserve. These are analytic checks, not lunar measurements.

## Requirements and identity

Equality meets a configured limit. Canonical assessment requirement comparisons use a 1e−9 tolerance in the metric's units, not an engineering safety margin. Required failures take precedence over missing evidence; missing required evidence prevents a complete pass. Borrowed or partial evidence makes an otherwise passing result conditional. No configured requirements gives `not-configured`.

Free-space radio calculations use user-provided hardware and range assumptions. Geometric Earth visibility is not station availability, link acquisition or a service commitment. External reported passes remain conditional; changed physical inputs or requirements make their binding stale. An untimed aggregate failure is identified without inventing a first event time.

Scenario identity includes canonical inputs, dataset identity and model version. Asset integrity uses SHA256 separately. External reports bind to an evidence scope key excluding the reports themselves, preventing circular self-invalidation. Audience changes do not change the scenario.

`planning-2` replaces the earlier continuous-load interval model with deployment, scheduled loads, bus limits, exact model events and independently resolved subsystem horizons. Imported decision records are always recomputed; historical verdicts are never trusted as current.

## Rendering and flight

NASA's original globe is visualization geometry at a nominal scale, separate from numerical LOLA terrain. The original NASA Apollo Lunar Module mesh is normalized to a disclosed nominal 7 m display height. Neither mesh changes the generic finite-burn flight solver into an Apollo mission simulation. Inspection lighting and historical image shadows do not alter computed illumination.

See [scientific validation](qa/planning/scientific-validation.md) for analytic checks and the unresolved independent terrain/frame gate. Station-specific service, fine footprint hazards and vehicle thermal survival remain unassessed unless their independent source/model requirements are met.

## Reference constants and flight integration details

The reference lunar radius is 1,737,400 m. Central-gravity GM is 4.902800118×10¹² m³/s² (the DE440 value in [JPL astrodynamic parameters](https://ssd.jpl.nasa.gov/astro_par.html)); standard gravity for mass flow is 9.80665 m/s². Legacy manual flight uses Cartesian RK4 steps of at most 0.25 s, mass flow F/(Isp g0), a prescribed linear pitch-over and a site-elevation-adjusted reference radius, with lunar rotation omitted. Configured terminal flight uses ≤0.1 s RK4 force commands and ≤0.025 s collision probes with refined crossings. Assisted guidance uses ideal instantaneous attitude and continuously variable throttle bounded by entered thrust, burn time and propellant. The primary workspace supplies latitude for constant-spin Moon-fixed Coriolis and centrifugal terms. Numerical-terrain contact is distinct from reference-sphere contact. This is a three-degree-of-freedom flight model, not reconstructed Apollo guidance, an attitude-control solution or a multi-body transfer calculation.

Thrust/weight greater than one is necessary for a vertical liftoff from rest; propellant, clearance and terminal conditions impose additional requirements. These are physical model conditions, not a universal mission approval threshold. Landing slope/speed, reserve and radio requirements belong to the actual vehicle and mission.

The existing decoded Horizons verification record contains 56 samples at four sites including Apollo 11, with 0.02° test tolerance. That record checks the celestial direction calculation against observer tables; it does not establish terrain occlusion accuracy or resolve the source-frame gate. Its measured errors and timestamp are retained in the JSON record rather than replacing them with claimed precision.

## Global terrain context and viewing scale

`planning-4` adds an explicit global-context option using the calibrated PDS LOLA LDEM_16 height product. Its1895.21m source cells are area-averaged to approximately4264m equatorial output spacing. The on-demand horizon uses200 logarithmic radial samples from1m to1000km at2°azimuth spacing. This is conditional coarse context: subpixel obstacles and propagated frame/height errors are unresolved. Matching prepared site/polar masks retain priority. Older records with absent terrainMode remain prepared-only, including after location changes; enabling coarse context is explicit.

The same coarse numerical surface supports3Ddisplay outside prepared patches, without enabling fine collision/hazard claims. Coarse-camera context widens to match that data spacing and keeps a visible oblique skyline; it does not invent sharper terrain. NASA Sun/Earth models use original self-contained geometry/textures, with nominal display scale and authored orientation; their view positions follow JPL-derived directions.

## Scoped engineering calculations and observation boundaries

`planning-4` adds seven optional analytical engineering screens: measured footprint limits, ideal touchdown energy/static support, ideal propulsion/two-body transfer, supplied station-overlap capacity, a single thermal node, supplied plume keep-out geometry and traverse/return reserves. Inputs start empty. Their source/author and scope bind to the exact site, stay and dataset; changing that scope hides stale numerical results until explicit reconfirmation. Supplied screens become required when their corresponding discipline is required. Separate qualified assessment reports remain independent: a calculator cannot close their evidence gate. All successful analytical screens remain conditional. See `docs/qa/planning/engineering-screens.md` for equations and limits.

Navigation/guidance is an additional mandatory evidence discipline in landing-readiness scope. Mission planners can separately require surface infrastructure, power architecture, ISRU/resources, robotics/autonomy and habitat/life support when applicable. Selecting them records an evidence requirement, not an unimplemented solver result. Reference equations and Apollo context are explanatory; historical vehicle limits are not modern mission defaults.

An explicit `global-at-point` terrain mode bypasses a borrowed custom polar-grid horizon and computes coarse global context at the requested coordinates. It does not replace an absent DEM with a borrowed mask. Prepared-first mode retains the previous behavior and prominently states the borrowed cell and distance. The approximately4.3km global sampling is not more detailed evidence simply because its coordinate is exact.

Darkness/blackout runs touching the observation-window boundary are censored. The UI prefixes their observed duration with ≥ and states that the run may extend outside the selected stay. For example,1,104h is the length of a46day selected window, not a fixed cap or an extrapolated end time. Missing coverage remains unknown rather than a full-length dark run.

Moon-surface Sun/Earth direction models use compressed display distance with radius = displayDistance × sin(source angular semidiameter), preserving their apparent sizes from the site. Their close-up inspection cameras have separate viewpoints. The Earth–Moon scene uses kilometre body radii and JPL centre range; its body-size comparison uses common physical diameters with explicitly non-orbital layout spacing.

## Guided terminal descent and contact continuation

The Lander preset starts 300 m above the selected local reference, 300 m west of its target, moving east at 10 m/s and down at 8 m/s. It retains entered vehicle hardware. These are editable example inputs, not historical Apollo telemetry. Re-entering Lander preserves edits; Reset landing preset restores the approach. Target distance is a reference-sphere great-circle arc in metres. Outcomes compare numerical contact with the entered target radius and vertical, horizontal and tilt limits; green is conditional on those assumptions, red records exceeded limits, and amber records unknown evidence. A zero-thrust or underpowered attempt is allowed to fail.

At impact, the incoming E/up/N position, velocity and remaining mass initialize the shared Rapier contact engine in metres, seconds and kilograms. The scene converts its east/up/south coordinates to kilometres exactly once. A bounded 120 Hz replay covers up to 12 seconds after impact and supports pause, scrub and reset without rebuilding the NASA assets. Terrain contact uses a 65 × 65 finite heightfield derived from displayed numerical terrain; sampling a coarse DEM more finely adds no landing-footprint evidence. Unknown terrain and impacts beyond 100 m/s vertical or horizontal remain unsupported, rather than being silently clamped.

The NASA Lunar Module remains nominally 7 m high. The 157 original mesh primitives supply geometry-based box proxies and mass shares, with editable friction, restitution and breakup-energy assumptions. Breakup separates those primitives; it does not model structural deformation or validated material failure. Pieces collide with terrain; mutual piece collisions, soil mechanics, plume effects and a qualified landing-gear model are omitted. Follow tracks the simulated mass centre, preserving the user's viewing offset; the displayed mesh origin and mass centre can differ. Flight previews and contact-limit outcomes never approve a landing site or mission.

## Terrain visibility and antenna contact are different tests

Terrain-only Earth visibility tests whether the Earth centre clears the sampled terrain horizon. Antenna contact additionally requires Earth-centre elevation strictly above the absolute minimum antenna elevation: `e_Earth > max(horizon_Earth, antenna_minimum)`. A 0° minimum remains an active horizontal cutoff; it is not an added zero-degree terrain obstruction. Thus a depressed horizon can make Earth geometrically visible before the antenna pointing constraint permits contact.

The real demo alternative has 188/336 h (55.95%) terrain-only visibility and 168/336 h (50%) contact under its 0° cutoff. Its raw Earth window starts 19 July 2027 15:00 UTC; its contact window begins at the 20 July 11:00 sample, bracketed by 10:00–11:00 UTC. The overview retains the raw percentage as labelled context and uses the explicit cutoff for contact; the horizon plots retain the original geometry while contact windows state their cutoff and display height. Planner/comparison use the independent antenna height. If heights differ, the overview states both values. None of these tests grants station access or proves RF margin.

This correction adds a shared predicate and explicit summary mode. It does not change the mission assessment's existing cutoff, celestial azimuth/elevation, original masks, or planning-4 identity. Fresh decoded Horizons verification still passes; unqualified terrain/frame gates remain explicit.


## Station evidence and finite declared bounds

The additional engineering workspace evaluates a separate, explicitly conditional lunar-to-ground downlink chain over at most31 days. Station geometry uses archived airless Horizons observer tables; whole-disk station clearance and conservative centre range are spatial screening assumptions, not temporal error bounds. A station-specific lunar mask may be supplied; the convenience Earth-centre proxy is explicitly a user assumption. Missing geometry, horizon, radio/noise/rate, dated weather loss or allocation prevents complete delivered-data adequacy. Current observations never become a future forecast.

Seventy-five independently generated CSPICE station samples and the published JPL atmospheric arithmetic example are documented under `public/data/engineering-evidence/README.md`. Fresh source conventions identify the DE440-PA-to-DE421-ME rotation; original catalog header/EOP provenance and propagated terrain/frame/event uncertainty remain unresolved. The reference checks do not certify the old catalog or resolve fine landing hazards.

Declared-bounds results sample lower/nominal/upper combinations of at most three declared fields (27 cases), retaining exact requirements and operations through `evaluateScenario`. Sampled minima/maxima and outcome stability are not continuous enclosures, probabilities or qualified uncertainty intervals. Absent or unsupported bounds remain unquantified. Canonical `planning-4` assessment meaning/numerics are unchanged by these supplementary workflows.

## 15 November 2026: planning-5 audit addendum

Model 5 binds the regenerated registered terrain and Moon-observed Earth range to new dataset identities. The producer explicitly requests UT/AIRLESS; Earth range is target399 from Moon centre500@301, quantity20. Source code, inputs and comparison receipts are hash-bound before publishing verification; this checks freshness, not observation truth. Analytical engineering screens retain their disclosed direct/open-boundary comparisons and are not governed by the canonical 1e−9 equality rule. See the current scientific verification register and independent final review. Original full polar horizon masks remain unregenerated and frame/physical skyline qualification remains unresolved.
