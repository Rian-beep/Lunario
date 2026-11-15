# Locked parallel contracts — terminal landing revision

User direction: realistic descending approach and distance, consistent surface contact/crash continuation, deterministic Lander focus, and controls in the header. All limits below are editable demonstration assumptions, not NASA acceptance criteria. New workers run only on Clevo; total active concurrency at most five including integration.

## Owners

- Header lane: `components/navigator.tsx`, `app/globals.css`, `components/workbench/scene.tsx`, `components/workbench/physics-reference.tsx`, own new header components/tests. No runtime or numerical files.
- Flight lane: `lib/flight.ts`, `lib/scenario.ts`, `components/workbench/panels.tsx` FlightPanel sections only, flight/schema tests and own new landing numerical helpers. No Scene/Navigator/sharedCSS or rigid-body files.
- Contact lane: `components/workbench/scene/runtime.ts`, `lib/touchdown-physics.ts`, own new scene contact-dynamics helpers/tests. No Navigator/Scene.tsx/header/flight/schema files.
- Precompiled math lane retains `lib/math-typesetting.ts`, generated MathML/script/tests ownership.
- Integrator owns `lib/landing-contract.ts`, `lib/landing-presets.ts`, final builds/artifacts, documents and merge sequencing. Change these contracts only through integrator coordination.

## Flight API

`FlightInputs` gains optional `landing?: LandingConfiguration`, `eastOffsetM?: number`, `northOffsetM?: number`. Existing absent values retain manual compatibility. The parser must retain and strictly validate supplied fields; no silent truncation.

`FlightResult` gains optional `contact?: LandingContact`, `landingOutcome?: LandingOutcome`, `previewEndTimeS?: number`. Types are in `lib/landing-contract.ts`. Contact velocity tuple uses the existing flight axes: east, tangent/radial-up component, north (SI). `eastM/northM/yM` match existing FlightPoint meanings and frame. `terrainHeightM` is callback height relative to the supplied reference radius; no callback/unknown callback is not measured terrain. The scene uses right-handed east/up/south display axes; contact conversion must account for this explicitly.

`createLandingFlight(current, reset=false)` from `lib/landing-presets.ts` supplies a 300 m altitude, 300 m west, eastward 10 m/s, descending 8 m/s terminal example centered on the selected location. Hardware remains user-supplied. Revisiting Lander preserves edits; explicit reset restores the example. It is an ideal assisted approach, not a reconstruction of Apollo guidance.

The assisted branch must integrate bounded thrust, propellant depletion and the Moon's gravity; stop at the same numerical terrain callback used for the display/clearance. It must not draw an artistic parabola or silently clamp impact speed. Define surface downrange from the selected target consistently. `previewEndTimeS` includes contact.timeS + landing.contactPreviewSeconds so the parent clock continues through contact physics.

Outcome names are preview requirement states. Green means within entered contact limits with known numerical terrain; red means outside entered limits or no landing in the requested preview; amber means missing/unsupported evidence. Always show text/symbols, not color alone. No result certifies footprint safety or mission readiness.

## Scene/Header API

SceneProps adds optional `focusRequestId?: number`, `controlsTarget?: HTMLElement|null`, `flightPlaying?: boolean`, `onLandingDynamics?:(value:LandingDynamicsReadout|null)=>void`. Existing assetFocus/onAssetFocusChange remains. Header owns the external Moon/Earth/Lander controls; it increments focusRequestId on every explicit request, including a repeated Lander click, configures the first landing preset and preserves later edits. Header moves camera controls via a portal into controlsTarget; no overlapping floating toolbars. Physics reference moves to a roomy dismissible Learn surface opened from the header.

Parent flight clock uses `flight.previewEndTimeS ?? flight.points.at(-1)?.t`. It passes flightPlaying and uses current contact readout for HUD speed/position while terminal physics is active. No static end-impact speed may be shown as post-contact live speed.

Runtime reads getLive().flight.contact and landingOutcome through the optional API. The contact numerical lane publishes all fields. During contact it advances/replays the SAME Rapier engine used in the touchdown lab from exact incoming position/velocity/mass, with the same configured friction/restitution/failure energy. It preserves the physical 7 m model, actual NASA mesh fragments and continuous pose. Pausing/scrubbing/resetting/edits must not duplicate worlds, reload models or mix old physics with new inputs. Contact uncertainty/unsupported speed stays explicit, not clamped into a false pass.

The contact lane may add an optional third terrain-heightfield argument to createTouchdownSimulation; default synthetic-plane API and existing tests remain unchanged. Heightfield must match the numerical displayed terrain locally; unknown terrain is not filled with qualified evidence. Record any finite-patch and proxy limitations. Contact fields/sampling must be prepared cooperatively, not stall the arrival frame.

Root will integrate flight first, then header and contact, rerun each relevant test suite and combined browser/offline proofs. Isolated workers can use the locked types and structural optional-result casts while dependent deliveries are in flight; final typecheck must be green before integration.

`simulateFlight` may take an optional fourth `LandingEnvironment` argument (latitude, optional documented sidereal spin rate). Assisted local-frame dynamics can include consistent Coriolis/centrifugal terms; preserve legacy manual behavior for omitted configuration. Root will pass the selected latitude after integrating the flight delivery. Record approximations (ideal attitude/throttle, reference rotation, omitted tides/GNC/soil); do not claim a full qualified 6-DoF mission model.
