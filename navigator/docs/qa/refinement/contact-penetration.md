# Contact penetration: F8 reproduction and bounded CCD resolution

14 November 2026. Clevo isolated branch `codex/refine-contact-penetration`, base
`a31ca0577f3c1f811080be82994511bf082a29af`. Intended for Root's C12 physics
candidate; C11 UI work remains separate. This report is numerical proxy
verification, not human visual acceptance, qualified soil/structural fracture
analysis, or landing/mission approval.

## Acceptance and scope

Retain the signed vertical clearance gate **≥ −0.05 m**, using every original
NASA proxy against the finite triangle collider at every 120 Hz state. Unknown
coverage, missing pieces and leaving the collider are failures to establish
clearance, never passes. Preserve all mass, finite state, friction/restitution,
deterministic fresh worlds, backwards replay and the full 12 s preview.

Only `lib/touchdown-physics.ts`, the explicit model note in
`components/workbench/scene/contact-dynamics.ts`, new
`tests/contact-penetration.test.ts`, and this report change. Existing tests and
all golden values remain unchanged. No runtime, scene, camera, map, UI,
evaluator, datasets, assets, configuration, dependencies or generated files
change. No server, browser, build, Simulator, Metro, push or merge was used.

## Actual-source RED reproduction

Inputs come from `/tmp/refinement-dark-c10-clearance-failure.json` and
`/tmp/refinement-framing-dark-c10-physical-r7/http-1280-breakup-samples.json`.
The independently owned framing verifier was read only. Its F8 was a physical
clearance failure despite all 157 pieces being framed; visibility is not the
clearance test.

The regression decodes original Draco positions **and indices**, follows the
original node matrices/TRS, supplies original glTF accessor bounds as
`GLTFLoader` does, applies the production nominal 7 m normalization/centred
origin, then calls production `prepareTouchdownFragments`. No invented boxes
replace source primitives. This produces all 157 production proxies and
geometry-based mass shares, including the existing thin-proxy floor. Committed
`terrain.json` is decoded with production code; `prepareContactTerrain`,
`contactInitialPose` and `prepareContactReplay` reproduce the finite 65 × 65
patch at −89.53432°, −150.05233°. The field is approximately 1683 m wide with
26.3 m triangle sampling. Reference elevation comes from the actual DEM at the
site. No ephemeris or terrain formulas change.

Captured contact: time 15.136624609414739 s, east −148.38206356441725 m,
north 0.006092578768924429 m, tangent height −4.349747228669003 m;
E/up/N velocity `[10.019567559574236, −32.21334474154138,
0.0008057009228747061]` m/s; mass 4699.503695770914 kg;
tilt 0.5978379405954839°, heading 269.96951869036235°.
Friction 0.8, restitution 0.1, breakup threshold zero. Full precision is retained
in the test. The 100 N airborne descent is already represented by this captured
incoming state; it is not re-integrated to approximate the failing contact.

Command: `npx tsx --test tests/contact-penetration.test.ts`.
Before the fix, the retained gate failed in **19 of 1441 states**. Frame 12,
0.1 s after impact, exactly reproduced **−0.14322332847795147 m**, bit for bit
equal to F8. The worst gap was **−0.25009984343061104 m at frame 3** (0.025 s).
The early 0–0.25 s window and full twelve seconds were inspected, not only the
rendered frames that happened to be sampled by the browser.

An initial fixture normalized from decoded extrema alone differed from F8 by
0.317 micrometres at frame 12. Retaining `GLTFLoader` accessor bounds removed
that discrepancy; the exact RED log is
`/tmp/refine-contact-penetration-red-exact.log`. The initial log is retained as
`/tmp/refine-contact-penetration-red.log`, not substituted for the exact result.

## Cause and engine experiment

Ranked hypotheses were contact integration resolution, insufficient CCD sweeps,
and insufficient constraint iterations; penetrating breakup spawn was also
checked. The original detached frame 1 has a **positive 0.005022903192861805 m**
minimum gap. The major failure develops after detachment: frame 3's worst
rotating proxy is part 31, with angular velocity approximately
`[−5.4634, −0.4994, −3.4776]` rad/s. Pieces start clear; adding a spawn lift
would conceal the subsequent contact-resolution failure.

Rapier 0.21.0 was verified in the installed package and its installed
`World`/`IntegrationParameters`/`RigidBodyDesc` declarations were read before
changing settings. Official references:
[CCD behaviour](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/#continuous-collision-detection),
[World.maxCcdSubsteps](https://rapier.rs/javascript3d/classes/World.html#maxCcdSubsteps),
[IntegrationParameters](https://rapier.rs/javascript3d/classes/IntegrationParameters.html).
CCD sweeps clamp trajectories at impact; the solver resolves velocity/contact.
Additional CCD substeps allow successive impacts during a timestep. Soft CCD
prediction and increasing constraint iterations are distinct controls.

Each probe changes one engine setting from the baseline and checks all 1441
states against all proxies on the identical finite field:

| Solver iterations | CCD cap | Worst gap (m) | Frame | Failed states | Frame 12 gap (m) |
| --- | --- | --- | --- | --- | --- |
| 8 | 1 (original) | −0.25009984343061104 | 3 | 19 | −0.14322332847795147 |
| 32 | 1 | −0.25533624297727237 | 3 | 13 | −0.143295593299316 |
| 8 | 4 | −0.03437616832227933 | 9 | 0 | −0.000005659653347936389 |
| 8 | **8 (selected)** | **−0.036762394522795616** | **2** | **0** | **−0.000021306776364637958** |
| 8 | 16 | −0.04619998466503927 | 23 | 0 | 0.000004362388534795425 |

Increasing solver iterations alone does not resolve F8. Allowing successive CCD
impacts does. The selected cap of eight leaves capacity beyond the passing
four-substep experiment with a bounded sweep budget. The table is a parameter
sensitivity check: debris paths differ and residual errors are not monotonic;
it does **not** establish continuum/whole-trajectory convergence or universal
nonpenetration. No golden tests were changed or tolerances relaxed.

The implementation sets `world.maxCcdSubsteps = 8`. The outer physics timestep
and returned/cache cadence remain **1/120 s**. Rapier may subdivide an output
interval internally up to eight times for CCD; this is **not fixed 960 Hz
integration**. The public contact model note explicitly discloses the cap.
Gravity, mass assignment, inertia proxies, coefficients, contact threshold,
fracture poses/velocities and cache layout are unchanged. No postprocessing
clamp, arbitrary lift, added impulse, rendered-only shift, hidden piece or
invented terrain is introduced. `planning-4` is unchanged: mission assessment
authority/numerics are untouched.

## GREEN verification and remaining boundary

The regression checks every state from 0 to 12 s, root and all fragment
positions/quaternions/velocities/spins for finiteness, quaternion normalization,
positive fragment mass, exact total mass, all 157 pieces, and signed clearance
through production lower-face/terrain-triangle clipping. It requires a complete
1441-frame cache with no stopped reason. The last piece outside finite bounds
and missing geometry explicitly produce unavailable clearance, not a pass.
Fresh breakup worlds have identical entire packed states, flags and masses;
backwards/forward reads, held final state and returned-sample mutation are
checked.

| Case, all 1441 states | Minimum gap | Behaviour |
| --- | --- | --- |
| Exact C10 F8 breakup | −0.036762394522795616 m | 157 pieces in all 1440 post-contact states; mass conserved |
| Captured C10 nominal contact | −0.006529815868060507 m | Intact; settles below 0.03 m/s; mass conserved |
| Controlled bounce on same actual DEM | −0.004981498341951732 m | Intact; upward speed 1.6650739908218384 m/s and subsequent separation |

Nominal inputs are separately captured from C10 nominal samples. The bounce is
explicitly a controlled numerical experiment: nominal geometry/site/mass with
vertical entry −3 m/s, zero horizontal velocity, restitution 0.8 and a high
breakup threshold. It is not represented as captured spacecraft telemetry.

Fresh checks on final code:

- Existing focused touchdown/fragments/contact/terrain tests: **45/45 pass**, unchanged.
- New NASA/actual-terrain regression: **4/4 pass** including its parent test.
- `npm test`: **762/762 pass**, zero failed/skipped.
- `npm run typecheck -- --incremental false`: pass.
- `npm run lint`: pass.
- `npm run math:check`: **314 native MathML expressions**, pass.
- Working/staged `git diff --check`: pass.

Existing tests retain free fall, normal soft landing, restitution/nonlatched
contact, threshold energy, maximum accepted 100 m/s breakup, friction on both
slope signs, finite negative terrain and bounds, cancellation, solved fracture
pose/point-velocity continuity, determinism, and finite-surface clearance
sentinels. No failure is dismissed as pre-existing. Cached `slop-scan` 0.3.0
was found outside PATH and run without installing anything: 289 source files,
five reviewed findings (NASA contextual rethrows retaining causes, strict
scenario-validation null returns, and three directory fan-out metrics). The
same scanner on an isolated `git archive a31ca05` source tree found the same
five findings; the delta has **zero added/worsened findings**. None concerns the
owned physics/test change. Reports are
`/tmp/refine-contact-penetration-{base-slop,slop,slop-delta}.json`.

Logs are `/tmp/refine-contact-penetration-{focused-existing,green,full,types,lint,math}.log`.
Probe logs use `probe-{base-detail,solver32,ccd4,ccd8,ccd16}.log`. All have the
same `/tmp/refine-contact-penetration-` prefix.

Root must integrate this delivery into C12 and independently repeat final
immutable HTTP/offline completed-render physical QA. This worker did not test
browser appearance, rendering performance or final artifact identity. The
retained 5 cm numerical proxy gate passed these experiments; small negative
solver residuals remain. Box proxies, geometry-based mass, coarse finite DEM
triangles, threshold breakage and omitted mutual piece contact remain explicit
model limits, never qualified soil/structural-fracture evidence.

## Evidence identities

SHA-256:

- Original NASA GLB: `379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e`.
- Local Draco decoder: `8625489da79a805f4f2a7d511c3e52d8b4085608a9d2a4d5f4f9de5db0aea04f`.
- Committed terrain JSON: `be7f59a95901f36cda1050538ea75fb1ce51e8b9cf5aebb532073086c0f70c32`.
- F8 failure JSON: `831244afa6ef008aa18953428fdfd71ddb4880796c7ecc6b43371b61fae3c458`.
- Raw C10 breakup samples: `08826371164e5ba2b812c4a3f0e64c54ce886dfd96db7b3e7e00b2b086794eb6`.
- Read-only framing verifier: `9001f13dcb2cfb786d1d526092628b62853ad4b97c60577caacc0db6d09924ac`.
