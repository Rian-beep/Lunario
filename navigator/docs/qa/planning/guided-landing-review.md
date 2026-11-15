# Independent guided landing review

**Status: final strengthened asset/reselection run in progress.** The revised artifact has completed two 88/88 functional regression runs over HTTP and file. The current run also requires a nonzero observed asset-load baseline; its authoritative result is `/tmp/solarreach-guided-landing-release-r4-review/report.json`. One actual model-description mismatch remains below. This is agent verification, not user acceptance or landing qualification.

Only the two assigned new files are owned here: this report and `scripts/verify-guided-landing.mjs`. Application/worker sources were read for contracts, locators and integration risks; none were edited. No app server, build, Simulator, Metro, shared browser or child agent was started.

## Candidate and evidence identity

| Item | Identity |
| --- | --- |
| Candidate | `/tmp/solarreach-landing-release-r4.html` |
| Exact bytes | 81,179,904 |
| SHA-256 | `b70fd3e035172a61b920b104c864ddc186d201d86e0edb54d82c909302ba2182` |
| Integration source | `0bdcf5b`; individual source hashes in ready marker and JSON report |
| Ready marker | `/tmp/solarreach-landing-release-r4-ready.json` |
| HTTP | `http://127.0.0.1:43318` |
| Current evidence | `/tmp/solarreach-guided-landing-release-r4-review/` |
| Prior complete functional evidence | `/tmp/solarreach-guided-landing-release-r4-final/report.json` |
| Manual copy receipt | `/tmp/solarreach-guided-landing-release-r4-clevo/model-copy-review.json` |

Each run records UTC, verifier SHA-256, supplied source hashes, browser/module identity, machine, launch flags, raw timing, network/errors, rendered datasets and screenshots. HTTP bytes are streamed and hashed independently before navigation and after the suite; the browser checks the same URL/status/content length. This avoids Chrome inspector eviction of the 81 MB response body. File and HTTP use the identical artifact. Marker, HTML and verifier hashes are checked again at completion.

## Actual remaining finding

**P2 — chart/glossary explanations describe the wrong assisted model.** Direct UI inspection on the candidate at `2026-11-14T18:33:18.326Z` showed the assisted result describing a Moon-fixed frame, Coriolis/centrifugal terms and ≤0.1 s force commands. Both flight-chart explanations still describe a nonrotating frame with lunar rotation omitted, ≤0.25 s solver steps and roughly 1 s output samples. Actual configured output sampling is roughly 0.5 s. This misleading copy should follow the selected flight model; legacy ascent descriptions must remain qualified to that branch.

Read-only source locators in this checkout: `lib/charts.ts:51`, `lib/glossary.ts:397`, `lib/glossary.ts:421`, `lib/glossary.ts:433`, and `components/workbench/science-charts.tsx:748`. Root was notified through `/tmp/landing-verifier-findings.txt`. No source fix or acceptance is claimed here.

## Regression coverage

Both delivery forms use separate fresh contexts at **1280, 1728 and 800 CSS px**, device scale 1, normal fine pointer, no force clicks and no emulated zoom. The full contact/launch/lab suite runs at 1280 in each form; the other widths exercise real header, pointer, Learn, pin, focus and DSN flows.

- Ordinary pointer/native-keyboard map selector, roomy native MathML Learn dialog and Escape, camera controls inside the header portal, custom polar-map and globe points, and all three named DSN complexes with dated/offline weather context.
- First Lander click configures the legitimate 300 m terminal example. Repeated Lander clicks from Flight/Follow while the asset remains selected must actually arrive at the current vehicle, and preserve edited mass across rapid Moon/Earth/Lander requests. Actual canvas element and scene-instance identity are checked.
- Original embedded NASA Sun/Earth/Lander GLB hashes, actual 157 lander mesh primitives, fixed nominal 7 m scale, and unchanged supplied Sun/Earth ranges.
- Nominal descent without an outward increase in displayed radial altitude (10 m display resolution); entered-limit text/colour and a clock extending 12 s beyond contact.
- Full selected-flight Follow through ascent, assisted descent, low-thrust crash, propellant exhaustion, target miss, oblique rebound/tumbling and breakup. Raw contact SI state, rendered COM, camera target/offset, actual body mass/count, physical cache frame and collider clearance are read from production datasets. No numerical engine or module bridge is copied/imported.
- Constant COM-relative camera offset within 0.1 m, actual 157-piece breakup with conserved incoming assumed mass, upward rebound and at least 30° of post-contact rotation, and no observed proxy penetration beyond the explicit 5 cm verification tolerance.
- Expanded HUD speed agrees with actual physical velocity at settled paused post-contact times. Live samples retain DOM, scene and physical-frame times separately: the 10 Hz React publication and software-rendering lag must not be presented as same-time measurements.
- Pause/backward scrub/replay and reset, including intact NASA geometry restored in the touchdown lab. Cached physical readouts repeat; camera replay permits 1 µm floating-point drift. These are verifier tolerances, not landing acceptance limits.
- Zero file HTTP attempts, zero uncaught/console errors and failed requests, unchanged asset requests during edits/focus, and actual production render-frame counts plus rAF intervals.

The file context uses Chrome's actual offline mode. An additional routing interceptor suppressed local blob observations in this environment; it was removed. The final observer counts blob/script/fetch resources and refuses to call a zero baseline proof of no refetch. Earlier zero-counter passes are superseded.

## Environment and performance scope

CLEVO-X2, Linux `7.0.0-38-generic`, AMD Ryzen AI Max+ 395 with Radeon 8060S, 32 logical CPUs, 130,148,806,656 bytes RAM. The tested backend is explicitly **software ANGLE/Vulkan SwiftShader**, not the Radeon GPU. Google Chrome `149.0.7827.155`; existing cached Playwright `1.63.0-alpha-2026-08-05`, package identity recorded in JSON. No dependency files were changed or packages installed.

Flags: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --disable-dev-shm-usage`, plus recorded Playwright defaults. Contexts are fresh, but OS/disk/server caches are not flushed; the HTTP identity read precedes browser navigation. Metrics are individual observations on this setup, not cold-disk, 60 fps or universal input-latency guarantees. Frame-counter and rAF windows start at the same first callback.

## Scope that remains unproved

Actual screen-reader testing, native desktop 200% browser zoom, full contrast/reflow qualification, engineering mass/inertia, soil/landing-gear/structural response, fine footprint terrain hazards and mission readiness remain separate. No CDP device-scale setting is called native zoom. This review covers the default configured 12 s contact interval and the stated demonstration cases, not every permitted numerical input or a qualified full-mission 6-DoF model. Geometry-based box proxies and assumed mass remain explicitly approximate.

The original artifact SHA `70cba310…` genuinely stopped the 157-piece crash replay at 7.2667 s of the requested 12 s when a fragment reached the finite patch boundary. Root retained those bytes, expanded the patch using full 3D impact velocity, removed the intrusive ring, corrected context/HUD spacing and embedded the favicon in this revision. Old red/interrupted reports are retained; they are not current-candidate failures. Several early harness failures were corrected native-slider/compact-HUD/case/cleanup/timing issues, not app defects.

## Reproduce

```bash
node --check scripts/verify-guided-landing.mjs
./node_modules/.bin/eslint --max-warnings 0 scripts/verify-guided-landing.mjs
npm run typecheck -- --incremental false
PLAYWRIGHT_CORE_MODULE=/home/luke/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs \
node scripts/verify-guided-landing.mjs \
  --artifact /tmp/solarreach-landing-release-r4.html \
  --marker /tmp/solarreach-landing-release-r4-ready.json \
  --url http://127.0.0.1:43318 \
  --output /tmp/solarreach-guided-landing-release-r4-review
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` defaults to `/usr/bin/google-chrome`. `PLAYWRIGHT_CORE_MODULE`/`--playwrightModule` selects an existing installation when this checkout's linked dependencies lack the declared package. The script waits for the marker before any browser test and fails closed on artifact/HTTP identity disagreement. Root owns the server/forward and final application delivery.
