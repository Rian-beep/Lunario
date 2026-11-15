# Camera navigation regression — 15 November 2026

Worker branch `codex/eval-terrain`, parent `e5b8ebc` from
`refs/remotes/mac/evaluation-final-source` (fast-forward merged before edits).
Production ownership is limited to `components/workbench/scene.tsx` and
`components/workbench/scene/runtime.ts`. No shared CSS, navigation shell, NASA
globe/shader/assets, science engine or generated web/offline output was edited.

## Reproduced causes

The private browser fixture mounts the actual React `LunarScene`, runtime,
OrbitControls, committed numerical terrain and original NASA assets. It uses an
isolated Chromium instance and intercepted local file transport, without starting
a server or connecting to a shared browser.

An ordinary blank-canvas click during Moon → Lander travel canceled `assetMotion`
on pointer-down. The parent then settled at **4,114.38 km** from the spacecraft,
with `cameraMode=vehicle`, `assetFlight=idle`, and Lander still selected. The
existing `vehicleFraming=framed` flag also described this pose, despite projected
bounds under 0.003 px wide. Thus mode/framing flags alone cannot verify arrival.
Evidence: `/tmp/lunario-camera-red/report.json` and `1-failure.png`.

Two further event paths were reproduced by executing the production handlers:

- A spacecraft pick in Vehicle/Follow called the same-focus selection callback,
  increasing the reset/request and starting another full celestial camera trip.
- Ending an interrupted site journey called `onSiteMode()` unconditionally,
  overwriting an already selected or newer Vehicle/Follow request with Orbit.

## Repair and interaction contract

- Pointer-down and movement below the existing 5 px pick threshold preserve
  pending travel. Below-threshold movement cannot fight its animated pose.
- A real drag takes manual camera control. On release, an interrupted asset trip
  resumes its selected destination from the actual adjusted camera and target.
  A newer mode/reset/site/geographic request supersedes that pending trip.
- OrbitControls refreshes its cached up axis before a transition drag and after
  release; it is not disposed during the captured drag. Wheel follows the same
  interruption path. Settled manual views keep their orbit/pan/zoom.
- Site cancellation uses `retainCameraAfterSiteArrival`, just like successful
  arrival. Explicit asset/Follow requests remain owed; ordinary site cancellation
  releases into local Orbit without applying a preset. The React callback checks
  its mode/reset request against current settings before changing mode.
  A held asset drag reports `assetFlight=interrupted`, so the tracking-ready
  callback cannot start a pending flight before the approach has finished.
- Picking an already inspected/followed spacecraft leaves its camera alone.
  Explicit topbar focus/reset actions remain available. Flight/source time is not
  changed by any of these camera handlers; Follow retains COM translation.

## Verification

`tests/camera-navigation.test.ts` executes the production gesture and pick
handlers. The first five tests run against the isolated parent source produced
four failures and one pass; the additional already-selected spacecraft pick test
also failed before its fix. All six pass after repair. Red logs:
`/tmp/lunario-camera-parent-red.tap`, `/tmp/lunario-camera-pick-red.tap`.

Fresh checks:

- 123 focused tests passed, zero failures/skips: camera navigation, asset focus,
  site transitions, scene/contact/framing, legacy contact and Moon lifecycle.
  `/tmp/lunario-camera-focused.tap` records the run.
- `npm run typecheck -- --incremental false` passed.
- Owned-file ESLint and `git diff --check` passed. `slop-scan` is not installed.
- `node scripts/verify-camera-navigation.mjs /tmp/lunario-camera-delivery`
  drives ordinary clicks, spacecraft picks, interrupted and settled drags,
  wheel, rapid retargets, actual portal controls, site interruption, Follow
  forward/rewind/edited paths, renderer/canvas identity and warmed GPU counts.
  The script records source hashes, completed-render datasets and a final image.

The prior complete seven-group browser run passed with zero page errors at
`/tmp/lunario-camera-final/report.json`. Click, drag and interrupted-site arrivals
all reached **26.57066 m** from the vehicle. Renderer identity stayed constant;
after each asset mode was warmed, repeated switching made no new image/model
requests and did not accumulate geometry/textures. The final expanded receipt is
recorded below.

Final source: **10/10 browser groups passed**, zero page errors, in
`/tmp/lunario-camera-delivery/report.json` (log
`/tmp/lunario-camera-browser-delivery.log`). The held Follow approach reported
`interrupted` with tracking-ready false and source time 0; readiness became true
only after arrival. All three final Lander arrival samples were 26.57066 m.
The final image `/tmp/lunario-camera-delivery/lander-final.png` was inspected.
Both production file SHA-256 values in the receipt match the delivered sources.

## Remaining scope

This is Chromium 149 / SwiftShader at 1100×900, with controlled source clock and
sky inputs. CSS modules are omitted; styled-JSX is emitted as plain fixture CSS.
The sole runtime probe exposes read-only renderer memory. Initial harness-only
failures (invalid horizon input/module format; stale reference height on a new
fixture site; comparing first-use Earth resources with an unwarmed baseline) were
corrected without relaxing arrival assertions; intermediate reports remain in
`/tmp/lunario-camera-*`.

Full app shell, rebuilt web/offline artifacts, target GPU frame times, native
zoom, touch/multitouch, screen readers and user acceptance remain with the parent.
Existing `vehicleFraming=framed` does not guarantee a large visible vehicle;
regressions now additionally assert actual camera distance and visible geometry.
No ephemeris, numerical model or constraint meaning changed; no Horizons rerun
or scientific/mission qualification is claimed.
