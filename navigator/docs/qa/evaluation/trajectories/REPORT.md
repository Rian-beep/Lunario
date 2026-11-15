# Mission trajectory evaluation

15 November 2026. Evaluated base **3c82b5aa02c4da52053fd3c12c180cca18fd6d4e**; implementation **33d05874d02c745a93f8320f1c20ad148dadb352**, following parser fix **1eed657**. Isolated Clevo worktree/branch `codex/eval-trajectories`. This is bounded agent evaluation, not human acceptance, independent navigation calibration or operational qualification.

## Delivered outcome

Three real **postflight reconstructed lander descents** are now bundled, selected by their existing landing-site IDs. Previously only the Chandrayaan-3 reference descent and Apollo 15 CSM orbit were available. Those two datasets remain unchanged. No new dataset is classified `flown`, no orbiter is relabeled as a lander, and no predicted states, attitude or thrust commands fill missing coverage.

| Added site | Primary PDS SPK / native UTC coverage | Extract | Pedigree and limit |
| --- | --- | --- | --- |
| Odysseus | [IM-1 EDL](https://naif.jpl.nasa.gov/pub/naif/pds/pds4/clps/clps_spice/spice_kernels/spk/clps_to2im_im1_edl_rec_240222_v01.bsp), 2024-02-22 22:53:47–23:23:44 | 361 samples, 1796 s | IM reconstructed downlinked navigation/acceleration and ground tracking, anchored to contact. Provider estimates 100 m position uncertainty (3-sigma); not independently calibrated here. |
| Blue Ghost 1 | [BGM-1 EDL](https://naif.jpl.nasa.gov/pub/naif/pds/pds4/clps/clps_spice/spice_kernels/spk/clps_to19d_bgm1_edl_rec_250302_v01.bsp), 2025-03-02 08:16:41.892–08:34:54.492 | 220 samples, 1091 s | Smoothed/downsampled onboard navigation-filter states, repackaged by CLPS as degree-3 Type-13 Hermite. Source/repackaging differences do not establish physical accuracy. |
| Athena | [IM-2 EDL](https://naif.jpl.nasa.gov/pub/naif/pds/pds4/clps/clps_spice/spice_kernels/spk/clps_prime1_im2_edl_rec_250306_v01.bsp), 2025-03-06 17:15:31.110–17:28:42.785535 | 159 samples, 790 s | IM/KinetX best estimated trajectory combines tracking, inertial, DPOS and near-landing observations. Source explicitly lacks first-contact-to-final-orientation states. Transit/LLO errors are not EDL error bounds. |

All 740 samples retain Moon center 301, km/km/s, a whole-second TDB epoch and an explicitly converted UTC display epoch. Native source intervals are trimmed inward by less than a second at each edge to preserve schema 1. Nominal sampling is 5 s with a shorter final interval. No canonical schema or source/frame/time API changes were needed.

The new preparer verifies SHA256 for each binary, leap-second kernel, text PCK and PDS product label. All three binary MD5s also match their official PDS labels. Segment descriptors are checked for the requested spacecraft, native center 301 and J2000 frame 1 before extraction. Six-component `sxform` includes the rotating-frame velocity terms. Direct SPICE body-fixed evaluations and inverse transforms check all samples. No planetary SPK translation or attitude kernel is required for these direct Moon-centered source segments.

[clps-conversion.json](clps-conversion.json) records exact hashes, versions, source/extract intervals, SPK types, fixtures and comparisons. CSPICE N0067 / spiceypy 8.4.0 / Python 3.12.13 were used. The maximum inverse-transform component residual is 9.094947017729282e-13; direct-state component residual is zero. These are implementation comparisons using the same source, not independent observations.

| Source | Checked midpoints | Maximum position discrepancy | Maximum velocity discrepancy |
| --- | ---: | ---: | ---: |
| IM-1 | 360 | 0.00997985079058392 km | 9.838183610512287e-06 km/s |
| BGM-1 | 219 | 0.013705340021541557 km | 0.0012716907312232848 km/s |
| IM-2 | 158 | 0.008489371222033543 km | 0.0018580729145661467 km/s |

These 737 midpoint comparisons characterize display interpolation at those finite times. They are neither continuous error bounds nor physical trajectory uncertainties. Ten-decimal output rounding is encoding, not a claim of matching physical accuracy.

## Source search and remaining coverage

[TRAJECTORY-COVERAGE.md](../../../TRAJECTORY-COVERAGE.md) lists **every searched landing site individually**: Apollo 11, 12, 14, 15, 16, 17; Chandrayaan-3; SLIM; Odysseus; Blue Ghost 1; Athena. It also explains LRO as orbital context. Unsearched Surveyor, Luna, Chang’e, Beresheet, Chandrayaan-2 and HAKUTO-R sites remain `not-reviewed`.

The fresh [25-attempt source ledger](source-attempts.json) contains 20 HTTP-200 results, three 404 paths, one ISRO 403 and one operator redirect-loop 302, with response hashes and site IDs. The failed CLPS `data/spk` guess was resolved through the bundle index to `spice_kernels/spk`; the two failed LRO URL guesses are not proof of missing LRO ephemerides. Web research found the ISRO release and IM-2 narrative despite those direct-client failures; imported reconstruction claims rely on downloaded PDS kernel comments and labels. Raw kernels, comments, labels and web responses remain under `/tmp/lunario-eval-trajectory-sources`, `/tmp/lunario-eval-trajectory-review` and the original `/tmp/lunario-trajectory-sources` cache.

The Apollo index still supplies CSM/subsatellite kernels rather than LM paths. PDS photographic-support ephemerides do not fill the LM gap. Fresh NTRS records do not yield Volume II's NAT/BET listing or a new global sampled 3D final-descent attachment. JAXA's SLIM page still says Dataset List “in preparation”; its metadata-search response is a client-rendered shell, not proof that no data exist elsewhere. PRADAN payload archive pages do not establish final-descent fit pedigree, so Chandrayaan-3 stays reference. No numeric Earth-launch or lunar-ascent extract was qualified in this bounded search. No plot, film, still image or static landing coordinate was converted into invented telemetry.

The original cited Apollo and ISRO path rationale is preserved. Added rationale distinguishes IM-1 reconstruction inputs, Blue Ghost braking/vision/hazard selection, and Athena's contact gap. These sources explain phases and reconstruction choices; they do not let positions identify individual engine commands.

## Reproduced fixes

**T01, fixed:** Horizons import accepted contradictory frame headers, `KM-SPOOF` units, and JavaScript hexadecimal/binary position literals. The old parser used substring checks and `Number()` without restricting CSV decimal syntax. [parser-before-after.json](parser-before-after.json) compares actual base and current modules against the same original hash-bound 109-row Horizons response: all four malformed inputs were accepted before and rejected after; the unmodified source still parses 109 rows. Regression first failed with “Missing expected exception.” The parser-only commit was independently exercised on the base's original two-dataset catalog: 11/11 tests pass.

**T02, fixed:** the bounded catalogue lacked available PDS lander reconstructions. It now exposes the three products above with source identities, limits, uncertainty distinctions and cited rationale. New regression checks cover product digests, PDS label checks, source-frame fixtures, inward-trimmed coverage, all exact sample lookups and forbidden extrapolation.

**T03, fixed:** an unavailable current-site trajectory ID silently left the selector without a selected option or recovery explanation. The selector now shows a status message and available actions, and accurately labels reconstructed descent versus reference descent and CSM orbit. Nominal cadence, exact-only versus linear interpolation, historical-clock independence and missing-state limits are explicit. The base selector fails the new invalid-selection browser assertion; current selector passes all seven checks in [browser.json](browser.json).

## Parent fixes and interface handoff

Parent-owned production files were read only. New data uses existing static imports and existing `MissionTrajectorySelector` props; no new workspace prop, clock API, renderer, package or build lane is required.

1. **T04, open — reduced-motion camera.** In `components/mission-trajectories/replay.tsx`, `p = reduced ? 1 : ...`, followed by `if (p < 1)`, skips the selected-path destination entirely under reduced motion. A private Chromium/SwiftShader probe of the actual parent module, instrumented only to observe the renderer instance, records the initial **6200 km** camera radius. Apply the destination and target immediately when reduced motion is enabled; keep interactive camera controls usable afterwards. Do not add animation to work around reduced motion.
2. **T05, open — gap drawing.** The library correctly returns `null` inside an excessive gap, but replay constructs one `THREE.Line` from every sample. Remove just t=10 from the actual reference dataset: at t=10 the marker is hidden and distance unavailable, yet the 108-vertex line connects t=0 directly to t=20 across a forbidden 20 s gap. Split path geometry at `maxGapSeconds` and communicate missing coverage in text. For `interpolation:'none'`, do not draw a continuous reconstructed path between isolated observations. All shipped datasets are continuous; this is the supported importer/replay contract's missing-data defect, reproduced with a deliberately modified source fixture.
3. Keep the selector's simulation callback mapped to the existing paused, explicitly educational terminal-descent controls. The current parent code closes Mission paths, resets flight time/speed and posts an educational notice; the isolated selector verifies callback intent, not integrated flight behavior. Unknown/no-data sites retain that action.
4. Retain the independent historical clock. Source epochs (1971/2023/2024/2025) fall outside the planning catalog's 2026–2028 interval. No accidental planning-clock mutation was reproduced in these isolated checks or the reviewed workspace callback. Parent acceptance must exercise selection, play/pause, scrub, restart, switching sites and returning to planning in the integrated app. Clarify the replay's static epoch label as “Starts” or show current historical time; do not imply it changes with the main planning playhead.
5. The parser accepts body-fixed and inertial datasets, while the existing replay assumes/labels IAU_MOON. All five shipped products are IAU_MOON. Before exposing external imports to that renderer, reject unsupported frames visibly or implement a qualified display conversion. Keep invalid-file parse/digest failures recoverable through the selector rather than substituting simulated data under a published label.
6. Independently review the new primary sources/conversions, then update parent-owned asset inventories/bindings and rebuild/test hosted/offline artifacts. No evidence manifest, scientific receipt binding, model identity, shared runtime/UI, package or generated web/offline file was modified. The existing publication check passes, but its bindings do not contain mission-trajectory modules or these new assets; it is not a scientific approval of the additions.

[Read-only replay probes](parent-replay-probes.json) bind the parent replay SHA256, browser, software renderer and observed states. The NASA globe asset did not load in the isolated about:blank fixture; the path/render-loop probes still ran. This is not a full NASA-globe, terrain, camera or production-network acceptance result. The probe intentionally asserts the current two defects; after parent fixes, revise its expectations rather than treating a failing defect-reproduction assertion as a new regression.

## Verification

Linux Clevo, Node **v20.20.2**, TypeScript **5.9.3**, private Chromium **149.0.7827.155**. The selector used no network; the replay probe used WebGL 2.0 / ANGLE Vulkan SwiftShader. No app server, Simulator, Metro, shared browser profile or human participants were used.

| Command | Exit / result |
| --- | --- |
| `npx tsx --test tests/mission-trajectories.test.ts` | 0; **12 tests, 12 pass, 0 fail/cancelled/skipped/todo** |
| `npm test` | 0; **1365 tests, 1365 pass, 0 fail/cancelled/skipped/todo**, 1362 top-level TAP entries |
| `uv run --python 3.12 --with spiceypy==8.4.0 scripts/prepare-mission-trajectories-clps.py --check` | 0; 3 descents / 740 samples / 737 midpoint comparisons reproduced byte-for-byte |
| `node scripts/prepare-mission-trajectories-parser-review.mjs` | 0; 4 before/after rejection cases; 109 original source rows preserved |
| `node scripts/prepare-mission-trajectories-browser.mjs --baseline` | 1 as expected; base lacks unavailable-selection recovery |
| `node scripts/prepare-mission-trajectories-browser.mjs` | 0; **7 checks**, no page errors or network requests |
| `node scripts/prepare-mission-trajectories-replay-review.mjs` | 0; reproduces **2 parent defects**, no page errors |
| `npm run typecheck -- --incremental false` | 0; no diagnostics |
| `npm run lint` | **1; 1 error, 0 warnings** in parent-owned `components/workbench/scene/lunar-terrain.js:1:1`, `@typescript-eslint/ban-ts-comment` (`@ts-nocheck`) |
| Same `npm run lint` in isolated exact base `3c82b5a` | **1; same file/rule, 1 error, 0 warnings**; demonstrated before transient parser-only verification edits |
| ESLint over all changed TypeScript/JavaScript paths | 0; no diagnostics |
| `python3 -m py_compile` on both new Python scripts | 0 |
| `python3 scripts/compile-scientific-verification.py --check` | 0; `publicationCheck: pass`, counts **41 verified / 21 uncertain / 0 failing** for its existing scope |
| `git diff --check` | 0 |

[verification.json](verification.json) retains exact command outputs and counts; full raw command logs remain `/tmp/lunario-eval-trajectories-*.txt`. No Horizons science gate was claimed or required: `lib/astro.ts`, the main ephemeris and pipeline were untouched. New trajectory numerics were compared to their own current primary kernels as recorded above.

The rendered [desktop](selector-desktop.png) and [390 px mobile](selector-mobile.png) selector proofs were visually inspected. The harness also checks 200% **CSS zoom**, not native browser zoom. No screen-reader, touch-device, global contrast, human learning, real GPU, integrated replay/offline or historical-lighting acceptance is inferred.

## Credits, reuse and durable handoff

Credit Intuitive Machines/KinetX and Firefly Aerospace for navigation data; Derek Maggard/CLPS for archive preparation; NASA PDS and JPL/NAIF for distribution/frame/time tools; ISRO/JPLNAV and Alex Konopliv/JPL for the retained older products. Cite the individual kernels and [NAIF credit guidance](https://naif.jpl.nasa.gov/naif/credit.html).

The three PDS labels and binary comments were checked: they contain no explicit restrictive notice or standalone SPDX/CC license. [NASA's data-license policy](https://science.data.nasa.gov/about/license) gives a CC0 default for NASA-led data absent a restrictive notice, and explicitly treats other sources separately. This is **not** evidence that all commercial vendor material is CC0. Only bounded numeric facts and derived arrays are bundled, with source hashes/citations; raw kernels, copyrighted vendor prose, imagery and logos are not republished. [SPICE usage rules](https://naif.jpl.nasa.gov/naif/rules.html) were reviewed; no Toolkit mirror is distributed. No blanket non-US or commercial license, endorsement or operational permission is claimed. Any future raw-kernel/prose redistribution needs its own rights review.

Durable investigation state, user-authorized limits, source outcomes and remaining parent work are saved in this owned report, coverage document and machine-readable findings. Shared vault edits and memory indexing were deliberately left to the parent under the explicit worker restriction. No pushes or merges.
