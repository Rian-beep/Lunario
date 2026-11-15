# C13 final contact verification

14 November 2026, Clevo, isolated `codex/refine-c13-contact-qa`, base
`a93e252f2c9e46395c3644d822a94cf62f30f95d`. Only this new report is owned.

**Scoped assertions: 13/13 PASS, zero failed, zero unexecuted.** All three
physical scenarios completed in each transport, sequential HTTP then fully
disconnected file, in one browser. Fresh source tests, types, lint and math
checks pass. This records automated contact evidence, not combined release,
human, screen-reader, operational or mission acceptance.

**Process-status anomaly retained:** the tool session returned **143**, despite
the completed verifier writing all thirteen PASS results, final immutable check,
`overall: "pass"`, and its final `PASS` log line. Its cause is unverified. A
normal runner exit 0 is **not** claimed. No assertion was waived, no failed run
was replaced, and no duplicate physical run was made. Exact command/session
status is preserved in `process-status.json`; Root must retain this distinction
when assessing the combined delivery.

## Frozen execution and identity

Run: **2026-11-14T23:42:20.635Z–23:56:31.550Z**.

```sh
node /tmp/refine-c13-contact-frozen.mjs \
  --marker /tmp/solarreach-refinement-c13-ready.json \
  --instructions /tmp/refinement-c13-qa-instructions.txt \
  --widths 1280 \
  --sections physical,contrast,expanded-contrast \
  --output /tmp/refinement-framing-c13-contact
```

The executing file is an unchanged, chmod **444**, 62,013-byte copy of
`/tmp/refine-c12-visual-physical-v1.mjs`. The independently owned verifier was
read only. No physics, runtime, readout, proxy, threshold or frame filtering was
changed. Default scenario order remains nominal, breakup, bounce; modes remain
HTTP, file. No server, shared browser, Simulator, Metro, subagent, application,
configuration, dependency or generated-app edit, push or merge was performed.

All following SHA-256 identities matched before and after:

| Input | SHA-256 |
| --- | --- |
| Original C12 script and executing frozen C13 copy | `04603af83b18b0a5159cece00f61de0236c61782b8a5300f738252d2082c5b6d` |
| `/tmp/solarreach-refinement-c13-ready.json` | `3b066432911c03a19072030a4b9df297fe5b8e25fd6c69181d8db67915033fb8` |
| `/tmp/refinement-c13-qa-instructions.txt` | `3029c0c3676d2cf40fd6615480836d1506236f7e0422294184dbb826eaf9c446` |
| `/tmp/lunar-window-c13.html`, 81,081,299 bytes | `a031e1695a7a75b03e8316055c75467943e2abe889bca0cf15aadc5c52f0c84f` |
| `/tmp/lunar-window-c13-source.bundle` | `bd145e4a8e1bd6766ef2e5c8d9f402d57834b1b9df3d4efd02523a538d4e1570` |

`http://127.0.0.1:43326/` returned status 200 and exactly the artifact bytes at
both identity checks. The source bundle verifies and names the marker's source
commit. Actual source checks used
`/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c13-final-check`,
never this report checkout as a substitute. Its HEAD was the source commit
before and after; tracked state stayed clean. Git tree:
`53c3c58b1ed7b1951453435893b60bd7c42e4851`.
Explicit runtime, contact engine, proxy, test, NASA GLB and terrain file hashes
also match in `refine-c13-contact-source-identity-{during,after}.json`.

## Completed physical cases

Every case played the entire original approach and twelve-second continuation
at actual production **1×**, then passed backwards seek and deterministic end
replay. Each transport also passed reset to time zero. Breakup additionally
passed Lander refocus, Follow re-entry, rewind/re-entry, ordinary canvas orbit
and wheel zoom, and paused camera/target stability.

| Transport | Scenario | Completed render frames | Contact frames | Minimum rendered contact clearance (m) | Observed software FPS | End time (s) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| HTTP | Nominal | 83 | 11 | −0.0013199758046347765 | 1.245286515 | 62.48139816962106 |
| HTTP | Breakup | 61 | 25 | −0.014191041665152615 | 2.085288291 | 27.13662460941474 |
| HTTP | Bounce | 39 | 16 | +6.89301688198418 | 1.287079752 | 27.063835044082165 |
| Disconnected file | Nominal | 111 | 14 | −0.0017953942179561866 | 1.668307169 | 62.48139816962106 |
| Disconnected file | Breakup | 40 | 17 | −0.0026339420369577513 | 1.282603620 | 27.13662460941474 |
| Disconnected file | Bounce | 65 | 29 | +0.002000001157121234 | 2.235542329 | 27.063835044082165 |

Total: **six scenarios completed, zero unexecuted; 399 completed render frames,
112 contact frames**. Render-frame indices are consecutive within every
playback capture, with no gaps or discarded samples. Every completed contact
frame had actual finite clearance **≥ −0.05 m**. Positive bounce minima describe
the rendered samples, not a minimum over every intervening physics state.

Every sampled frame passed physical 1× scale, finite noncollapsed vehicle
bounds inside the actual viewport/host and unoccluded rectangle, and independent
visible-panel intersection checks. Follow retained the physical mass-weighted
COM target and unchanged intact camera offset. Every broken frame retained all
**157** original NASA fragments and exact total mass; breakup pullback remained
radial. Actual rebound was observed in each bounce case. Original NASA identity
checks passed for the LM, Earth/Sun GLBs, Moon mesh/8K atlas and six fine surface
patches. LM SHA-256:
`379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e`.

Both fresh contexts had zero page, console, HTTP or failed-request errors.
The file context was explicitly offline and made **zero HTTP attempts**.

Machine: CLEVO-X2, AMD Ryzen AI MAX+ 395, 32 logical CPUs; Node 20.20.2,
Chrome 149.0.7827.155, Playwright 1.63.0-alpha-2026-08-05. Actual renderer in both
contexts: ANGLE Vulkan SwiftShader. FPS is completed-render observations per
elapsed observation time on this concurrent QA workstation. It is **not a
hardware GPU benchmark**. OS/server/disk caches were not flushed.

## Actual raster contrast

**34/34 measurements passed**, minimum **7.001970971057991:1** against the
unchanged 4.5:1 gate. Each transport sampled the actual inspector verdict plus
the expanded card's `strong` verdict and **all three paragraphs**, initially and
for nominal, breakup and bounce. Screenshots were unmodified; actual pale glyph
cores were measured against adjacent rendered backgrounds after normal
inspector scrolling. CSS values were diagnostic only. Complete per-element
ratios, sampled pixels and screenshots are in `report.json` and `summary.json`.

## Fresh independent numerical source gate

All commands exited 0 in the marker's read-only source checkout:

| Command | Fresh result |
| --- | --- |
| `npm test` | **763/763 pass**, zero failed/cancelled/skipped/todo |
| `npm run typecheck -- --incremental false` | PASS |
| `npm run lint` | PASS |
| `npm run math:check` | **314 expressions PASS**, registry SHA-256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f` |

The existing `tests/contact-penetration.test.ts` gate checked **all 1,441 output
states per case**, independently of browser frame cadence, against every
original proxy on the actual finite numerical terrain. All caches reached
twelve seconds without truncation; the retained −0.05 m gate was unchanged.

| Numerical case | States | Minimum clearance (m) | Minimum index |
| --- | ---: | ---: | ---: |
| Exact captured C10 F8 breakup | 1,441 | −0.036762394522795616 | 2 |
| Captured nominal contact | 1,441 | −0.006529815868060507 | 40 |
| Controlled restitution bounce | 1,441 | −0.004981498341951732 | 570 |

The numerical bounce is the test's disclosed controlled incoming −3 m/s case;
it is distinct from the browser's manual 300 m descent. The gate retains all
157 parts, finite states, exact mass, fresh-world determinism, backwards replay,
and unknown/missing/out-of-bounds rejection. Output remains 120 Hz with at most
eight internal CCD substeps; no clamp, lift, proxy replacement or filtered state
was introduced by QA. This is separate numerical evidence, not a claim that the
software renderer displayed all 1,441 states.

Cached installed slop-scan 0.3.0 `scan .` and `scan . --lint` completed without
installations: 289 files, five inspected findings. Three are directory metrics;
NASA decode wrappers preserve causes and scenario validators deliberately
return rejection/null. No application edits were made to address metrics.
No geometry or ephemeris changes were made; no fresh Horizons or build run is
claimed by this lane.

## Preserved history and evidence

C10 F8 and C12 F9 remain historical RED evidence. In particular, C12 artifact
`5caf68a6d4d6ad66401545afd3a773adf8ce0213e4fd3dccc7fe703a6b5484bf`
at source `0ef2526a894f35bf9ee05773f646f817bf4b958f` is not relabelled C13 or
made green by this contact pass. C12's 13/13 contact pass also remains a separate
candidate result. No earlier report or failed-run file was edited.

| Preserved report | SHA-256 |
| --- | --- |
| `/tmp/refinement-framing-dark-c10-physical-r7/report.json` (F8 RED) | `8811589e0c21ab7825e565800397cde6c338fe401942459b5f9dd9dc226caf11` |
| `/tmp/refinement-framing-c12-native-r5/report.json` (F9 RED) | `7979dc57f45e2e9c1be7dcc7f1908f0837b4ae80f44ca3dabceb963447513e58` |
| `/tmp/refinement-framing-c12-physical-r1/report.json` (separate contact PASS) | `1f37f2e06b8d53b9a6dc1af60a6d7a1256b579b4dcfc8c47f72eb71c88bdb64b` |

Before/after history manifests are byte-identical, SHA-256
`f8e1eb972b1b7d261eb34e91b9982cc437ac4cfa475ad8e7382110785c3b71d6`.
They include the other retained C10/C12 report identities and F8 failure JSON.

Evidence directory: `/tmp/refinement-framing-c13-contact/`. It contains the
exact executing verifier, raw six-case samples, progressive replay details,
screenshots, final report, run log, process-status anomaly, source logs/times,
source identities and before/after integrity/history records. Core identities:

- `report.json`: `713389f34e6d06d8cc3adc29918177ab1f98c9af2cca6c0ce48a15c2d34fdd28`.
- `summary.json`: `979071c7ddb27ab1d953802f6b6d9960a0d4340ea0dc4258fce73765ed5bc413`.
- `process-status.json`: `6fe71b72e6e195c8a6edbd76f7d8b6e045d3f07ce6889cbfb3c1074e16ee8a47`.
- `evidence-sha256.json`, 95 evidence files: `f0b097425a4ead03b7f17ce3c9b8c52cf4c4fbaa03f9f469215b2a68d7cdeedf`.

There are no failed or unexecuted owned assertions. The unexplained process
status remains explicit. Wider responsive/native-200%, workflow, screen-reader,
human and release decisions belong to their respective owners. Coarse terrain,
box proxies, geometry-based mass and bounded threshold breakup remain model
limits, not qualified soil or structural-fracture evidence.


# C15 scoped nominal contact verification — 15 November 2026

**C13's parent-tool exit 143 remains unresolved and is not reclassified.**
The C13 report above, its historical hashes, all six C13 physical cases and
all earlier RED evidence are preserved. This section records a distinct C15
nominal-only run with a fresh normal process exit **0**.

**C15: 13/13 scoped checks PASS; two nominal cases only, HTTP then disconnected
file, one browser.** The frozen generic check name includes
`physical-follow-contact-bounce-breakup-replay`; its C15 detail contains only
`scenario: nominal`. No C15 breakup or bounce execution is claimed. This is
agent verification, not human, screen-reader, operational, mission or hardware
acceptance, nor combined release approval.

## C15 frozen execution and process status

Run: **2026-11-15T00:14:18.930Z–2026-11-15T00:20:21.257Z**.

```sh
node /tmp/refine-c15-contact-frozen.mjs \
  --marker /tmp/solarreach-refinement-c15-ready.json \
  --instructions /tmp/refinement-c15-qa-instructions.txt \
  --widths 1280 --scenarios nominal \
  --sections physical,contrast,expanded-contrast \
  --output /tmp/refinement-framing-c15-contact
```

The executing runner is an unchanged 62,013-byte, chmod **444** copy of the
read-only frozen C13 runner (same SHA-256 as C12/C13). A Python parent captured
the actual Node child return code immediately after `wait()`: **0**, normal
exit. The enclosing tool session **15202** also returned **0**. The command,
start/end times and exact status are in `process-status.json`. This fresh
normal exit applies only to C15; it does not explain or erase C13's 143.

Before/after inputs matched, and HTTP43328 returned status 200 and the exact
81,081,637-byte artifact at both identity checks:

| Input | SHA-256 |
| --- | --- |
| `/tmp/refine-c15-contact-frozen.mjs` | `04603af83b18b0a5159cece00f61de0236c61782b8a5300f738252d2082c5b6d` |
| `/tmp/solarreach-refinement-c15-ready.json` | `73725066d42333a0983cb151d94d864c2160e2b2d2d5d051fce8bc36efdeec37` |
| `/tmp/refinement-c15-qa-instructions.txt` | `73f9eb4b133b5241b574c1e405ff5fbd0cf680d09c0941c005cc3a82ce5c9da0` |
| `/tmp/lunar-window-c15.html` | `094b080b03fdcb8629f71ba294fb20c43e448d670367fe11001ecf4839e9765c` |
| `/tmp/lunar-window-c15-source.bundle` | `638801bd1698329f0612a3efc762301c8627c2d860f4fa6f77a6b8c308a21d9a` |

Source: **`f7ecd636f36955509e6e24f54c1fe85df2a25ab2`**, tree
`3745d476d3e83100d14a129b37f251ad1b1245d4`. Actual checks ran in the marker's read-only
`/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c15-final-check`,
not this older report worktree. HEAD and clean tracked state matched before
and after. The source bundle verifies, names that exact source commit, and
requires the C14 prerequisite `b2a5925848bc710c25e4d2ba42dc015df286014a`.

## Fresh C15 nominal evidence

Each nominal case ran the full original approach plus twelve-second contact
continuation at production **1×**, then reverse seek, deterministic endpoint
replay and reset through production controls. Every completed observed render
frame was retained, with consecutive indices and no discarded samples. All
contact samples had finite actual full-geometry clearance **≥ −0.05 m**.

| Transport | Scenario | Render frames | Contact frames | Minimum actual contact clearance (m) | Software FPS | End time (s) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| HTTP | Nominal | 94 | 14 | -0.000983383040409901987 | 1.416266660 | 62.48139816962106 |
| Disconnected file | Nominal | 79 | 12 | -0.000831172520088366285 | 1.175112916 | 62.48139816962106 |

Total **173 completed render frames / 26 contact frames**.
Every sampled frame passed finite, noncollapsed original vehicle bounds,
physical 1× scale, actual viewport/host/safe-rectangle and independent visible
panel intersection checks. Follow retained the physical mass-weighted COM
and unchanged intact camera offset. Reverse/replay retained deterministic
vehicle position, dynamics and camera. Reset restored flight time zero.
Original NASA LM and the other bundled physical/imagery asset identity checks
passed; the unchanged original 157-part geometry/proxy inputs were retained.
No nominal breakup was invented to exercise the broken-fragment assertions.

**Gesture scope:** the mandated frozen physical runner executes canvas
orbit/wheel gestures only inside its breakup branch; the requested nominal-only
command does not run that branch. C15 freshly verifies production playback,
seek/replay and reset controls, not a new canvas orbit/wheel/pinch pass. C13
canvas gesture evidence is carried forward below by identical runtime/asset
blobs. The exact command and one-browser limit were preserved; the scope gap
was surfaced during execution. No fresh C15 canvas-gesture claim is made.

Both fresh contexts had zero page, console, HTTP and failed-request errors.
The file context was explicitly offline with **zero HTTP attempts**. Chrome
149.0.7827.155, Playwright 1.63.0-alpha-2026-08-05, forced ANGLE Vulkan
SwiftShader on CLEVO-X2; FPS above is software-render observation cadence on
a concurrent QA workstation, not GPU or hardware performance. OS, server and
disk caches were not flushed.

Actual raster contrast: **18/18 PASS**,
minimum **7.001970971057991:1**, against the unchanged 4.5:1 gate.
Each transport measured the inspector verdict and expanded card's strong
verdict plus all three paragraphs, initially and for nominal only. Actual glyph
cores and adjacent rendered backgrounds were sampled from unmodified
screenshots after ordinary inspector scrolling; computed CSS was diagnostic.

## Fresh C15 source checks and bounded review

All four commands exited 0 on the actual immutable source:

| Command | Result |
| --- | --- |
| `npm test` | **763/763 PASS**, zero failed/cancelled/skipped/todo |
| `npm run typecheck -- --incremental false` | PASS |
| `npm run lint` | PASS |
| `npm run math:check` | **314 expressions PASS**, registry SHA-256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f` |

Logs and exact command times are in `source-checks.json` and `source-*.log`.
The full numerical suite retains the same all-1,441-state penetration gates,
unknown/missing/out-of-bounds rejection, original parts, mass and replay checks.
These source tests are separate from rendered-frame sampling.

Independent bounded C14→C15 review found no new actionable code issue in
controlled inspection, clock clamp, blur restoration, actual-time cursor or
help. Details and limits are in [c15-code-review.md](c15-code-review.md).
Root's reported C14 RED/C15 GREEN browser differential is attributed to Root;
this lane did not independently rerun that optional browser regression.
No science/physics/assessment/data changes; no fresh Horizons or builds by this
lane. Root's two green builds remain Root evidence. Wider visual, workflow,
native zoom and graph acceptance belongs to its assigned owners.

## C13 evidence carried forward with actual source proof

Compared actual C13 `a93e252f2c9e46395c3644d822a94cf62f30f95d` Git blobs,
actual C15 Git blobs and on-disk C15 files: **165/165 byte-identical**, including
all `lib/`, `pipeline/`, all 55 `public/data/` inputs, the scene directory and
`scene.tsx`. The penetration test is also unchanged. Explicit Git blob IDs,
SHA-256 values and sizes are frozen in the before/after source-identity records;
the key engine and input hashes are listed in the code review. This proves
unchanged flight/contact, terrain/proxies, NASA physical assets and science
inputs. No C15 scientific acceptance is inferred from this identity.

The four non-nominal C13 cases remain historical C13, not C15 executions:

| C13 transport / case | Render frames | Contact frames | Minimum sampled clearance (m) |
| --- | ---: | ---: | ---: |
| HTTP breakup | 61 | 25 | −0.014191041665152615 |
| HTTP bounce | 39 | 16 | +6.89301688198418 |
| Disconnected file breakup | 40 | 17 | −0.0026339420369577513 |
| Disconnected file bounce | 65 | 29 | +0.002000001157121234 |

C13's six-case total remains **399 frames / 112 contact frames**, with its
34 raster contrast measurements and all original evidence intact. Its breakup
includes all 157 original NASA fragments, mass conservation, radial pullback,
refocus/re-entry, user orbit/wheel and stable paused view; bounce includes actual
rebound. C13's broader gesture/input proof remains separate from fresh C15.
**The unresolved C13 parent-tool 143 remains prominent and unverified.**

All 99 files in the C13-plus-earlier evidence snapshot and the separate
18-report historical C10/C13/C14 identity snapshot remained byte-identical. This preserves
C10 F8, C12 F9, C13 F10 and C14 F11 RED history, including original hashes.
Before/after history manifests match exactly; no prior report was overwritten.

C15 evidence: `/tmp/refinement-framing-c15-contact/`. Core final hashes:

| Evidence | SHA-256 |
| --- | --- |
| `report.json` | `672fe6fb8d41525ac24fcd2530da33b3248e0abdd6ac68951174534fb3c1b1e2` |
| `summary.json` | `1ccb453983e5d78608e7e81c2e1d8f53c5567015a4d81c720387ff9bd9ecd52e` |
| `process-status.json` | `b6605cd32411d00836e22a3bdba7d02c57bf1a4c3381a892aeb9581b81aed5e2` |
| `source-identity-before.json` | `99a060f567f8e3b3c8cb12e4c804d02254b5b682ae3a8fa8a85c56dacf07ec0b` |
| `source-identity-after.json` | `c49f6e82e5a0e7b9758e9c6050563552618c4268ba1e05ca546fd8c18576eb40` |
| `evidence-sha256.json` | `ff836b28d88c9d0c477d3e2691ae7c862eabe812c36cb4184513e14d9ec9e3ee` |

The evidence manifest covers 51 files. The existing C13 report prefix is
unchanged. Only the two authorized repository documents are edited; no app,
config, dependency, generated output, server, shared browser, Simulator, Metro,
push, merge or subagent work was performed. Model limits remain coarse terrain,
box contacts, geometry-based mass and bounded energy-threshold breakup, not
qualified soil, structural fracture or vehicle/mission readiness.
