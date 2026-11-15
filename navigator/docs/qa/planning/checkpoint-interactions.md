# Checkpoint interaction evidence — Clevo

Scope: report-only browser verification by Sol in `codex/final-qa`. Owned files are this record and `scripts/verify-checkpoint-interactions.mjs`. No app source, existing verifier, generated artifact, server, shared browser profile, merge or push was changed. The integrator supplied the build and reverse-SSH HTTP endpoint.

**Finding: Map region is pointer-blocked at 800 CSS px.** The desktop pole, audience, units and inspector-width checks pass; this narrower interaction still needs an integrator fix. A numeric no-overflow result alone does not prove controls can be operated.

## Reproducible interaction failure

**F1 — responsive control overlap, 800 × 1000 CSS px.** Open the offline file in a fresh context at this viewport, dismiss the Public introduction, keep 2D map selected, then click the Map region selector. Its center hits `.drawer-toggles` instead of the selector. A normal Playwright pointer click times out with “`.drawer-toggles` intercepts pointer events.” The fresh Public repro measured the selector at x=622, y=291.328125, width=105, height=40; `document.elementFromPoint` confirmed the intercepting container. No forced click or DOM mutation was used. The region is visibly present, but its pointer target is covered by the Sites/Inspector controls.

Evidence: `/tmp/solarreach-checkpoint-narrow-controls/report.json` and `800-map-controls.png`, checked `2026-11-14T16:31:58.711Z`, fresh offline context, **0 HTTP(S) attempts**. The final verifier also contains `narrow-map-region-pointer-access`, which saves its hit-test and actual click error separately and fails on this condition. No claim that this issue was introduced by a particular commit, or reproduced on a base revision, is made. App layout changes are outside this lane's ownership.

Fresh Public HTTP reproductions also failed the same real pointer click: source `/` at `2026-11-14T16:35:18.693Z` and HTTP standalone at `2026-11-14T16:35:40.481Z`, both HTTP 200. Their measured selector rectangles differ by one pixel in width/x, but both center hit-tests return the `drawer-toggles` div. Evidence: `http-source.json`, `http-source-800.png`, `http-bundle.json`, `http-bundle-800.png` in that same directory. The final automated offline regression also reproduces it after the Planner/resize flow, with trace and video.

## Reproduction

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome \
PLAYWRIGHT_MODULE=/home/luke/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs \
node scripts/verify-checkpoint-interactions.mjs \
  --base-url http://127.0.0.1:43317 \
  --file /tmp/solarreach-final-qa.html \
  --ready /tmp/solarreach-final-qa-ready \
  --output /tmp/solarreach-checkpoint-final-v2
```

`PLAYWRIGHT_MODULE` selects the existing Clevo installation because the shared project dependencies did not include `playwright-core`. No dependency installation or shared dependency edit was performed. Omit that environment variable where the manifest's dependency is installed normally. The script requires the ready marker, hashes the file, and rejects a marker/artifact change during the run. It records individual failures and continues to collect other checks. A refreshed marker requires a new run.

Three independent, fresh headless contexts exercise:

1. HTTP source application at `/`.
2. HTTP `/solarreach-navigator.html`: a real HTTP GET body must hash identically to the supplied file, then direct native Chrome navigation must report the same ETag and content type.
3. `file:///tmp/solarreach-final-qa.html` with browser offline before navigation, service workers blocked and all HTTP(S) routes aborted. Request events count attempts, including blocked attempts; zero is reported only if none occurred.

The source application's root HTML is a Next.js shell and has a separate identity. Equality of source HTML and standalone HTML is neither expected nor claimed. Runtime dataset/model identity is recorded for each. Bundle parity is an actual byte comparison between the HTTP GET response and offline file, followed by validator parity for direct native browser navigation. Chrome evicted this 76 MB navigation response from its inspector cache even with a larger dedicated capture session, so the verifier does not claim to hash Chrome's captured navigation body. Browser responses are not routed or replaced.

`--targets` can select individual legs for an explicit rerun. The default runs all three. Two early attempts were deliberately interrupted while removing slow per-move camera captures; further HTTP capture attempts failed in the harness's inspector cache. Those interrupted/failed invocations are not clean test-suite passes. Completed per-leg evidence and any targeted reruns are identified below; earlier failures remain in their machine-local reports. Setup failure now skips dependent checks instead of generating misleading click failures behind an undismissed introduction.

The pole test uses trusted browser pointer input at constant x, with two long vertical left drags, 16 pointer moves per drag and geographic samples at the settled endpoints. It never invokes North/South pole buttons or writes camera positions. The host `data-view-latitude` and `data-view-longitude` come from the runtime's `cameraBodyGeography(sceneToBody(camera.position))`. The threshold is entry into both polar regions beyond ±85°, not exact ±90° or arbitrary traversal through the singularity. Pointer coordinates, trust flags, camera positions, radius bounds, screenshots, traces and video are retained. The scenario must remain unchanged.

## Cold DEMO walkthrough

This is a nonauthor **agent** walkthrough, not a human novice study. Before opening implementation or helper-script details, Sol read `AGENTS.md`, `docs/DEMO.md`, the package manifest and project status; then navigated the actual HTTP application using rendered labels. Initial cold session used a fresh headless context at 1600 × 1000, without injected scenario state. UI snapshots exposed rendered labels; no implementation-derived selectors were needed for this walkthrough. The first implementation/helper inspection occurred after the cold recording closed.

Evidence: `/tmp/solarreach-checkpoint-cold/trace.zip`, `video/page@bdd007bf999ac883da76a1927fd658c3.webm`, numbered PNGs, `decision.json`, and `final-aria.txt`. These are machine-local evidence paths, not published submission links. The recording contains reading/automation pauses; it is not an edited presentation or a timing benchmark.

| DEMO step | Actual action and observation | Limit / missing knowledge |
|---|---|---|
| 1–3, controlled delay/site | Planner → Explore a real delay contingency populated three saved rows. Baseline conditional, delayed assessed failure, alternative conditional. Set Reference scenario to delayed arrival; alternative explicitly became “Site-only comparison.” Opened delayed and alternative rows. | Default reference is original arrival, so the alternative initially says “Mixed-input comparison.” Selecting the delayed reference is necessary to show the controlled site-only difference. The table's fixture labels do not themselves identify the actual sites despite its location heading. Opening the alternative established de Gerlache–Shackleton ridge. The guide helped interpret these fixture labels. |
| Delayed explanation | Planner displayed −2,000 Wh reserve margin, first reserve-crossing bracket 14 July 2027 18:00–19:00 UTC and model offset 31.1839305843136 h. The resource panel showed 52.10 kWh unmet demand. Public displayed “This stay needs a change,” explained unmet demand, suggested one-variable comparisons and warned that more array only helps with usable sunlight. | A sunlit selected instant did not contradict failure across the stay. This was understandable from the distinct Public headings “At this moment” and “This stay needs a change.” |
| Alternative explanation | Public showed 3,947.45 Wh reserve margin and 168 h geometric outage, with “Promising under the stated assumptions” and an explicit no-landing-approval statement. | Preference is for modeled energy under unchanged dates/hardware; it does not resolve communication requirements, terrain/frame uncertainty or landing readiness. |
| 4, horizon | Opened Horizon analysis. Actual plot exposed terrain/smooth 0° reference, separate Sun/Earth tracks, degree/UTC units, per-track hourly sample identities and 1° named-mask spacing. | No named ridge attribution or claim of continuous measured horizon was made. |
| 5, calendar | Find whole-mission arrival windows → Evaluate mission starts at the alternative site, 13 July–12 August daily: 31 full stays, 4 conditional and 27 assessed failures, 0 assessed passes/incomplete/outside coverage. | Does not establish optimal dates outside these tested starts. |
| 6, sensitivity | Battery capacity 5000/10000/20000 Wh: reserve margins −52.6/3947.4/11947.4 Wh; assessed failure/conditional/conditional; outage 168.0 h throughout. UI explicitly said counts are not probabilities. | First click at summary center hit the nested About Sensitivity control; focusing the summary and Enter opened the experiment. This was a pointer-target discovery issue, not a failed numerical run. No minimum-capacity claim. |
| 7, Educator | Opened teaching workspace, read W, W/m², m², Wh, hour/J conversion and degree/radian explanations; recorded a prediction that more storage helps reserve without shortening Earth outage. | The top “Record prediction and baseline” is a local check, distinct from the collapsed saved Experiment notebook. Its text says to use the notebook/save scenarios for persistence. The full saved notebook capture/change/explain and subsystem-height lesson were not completed in this cold pass. |
| 8, historical unknown | Reopened original baseline, chose Apollo 11 via Sites, then Planner. Prepared-only result displayed Incomplete, 2 required unknowns / 0 known failures, Unknown reserve and terrain outage; smooth energy remained visible. | The guide's appended Prepared horizons only instruction matters; coarse fallback would ask a different question. No 1969 reconstruction or landing certification. |
| 9, package | Export decision JSON → Import decision package using the downloaded file. Status: “Recomputed using current evidence/model; historical results are not trusted.” | File retained for review. No altered-source/model import was attempted in this cold run; no claim to have checked every exported field. |

Cold understanding: moving arrival changes the low Sun's timing relative to the local horizon. The delayed Connecting Ridge stay exhausts usable storage and violates reserve; switching only the site on those dates restores modeled energy under the configured equipment and demand. A long Earth outage, unconfigured radio/outage limits and unresolved source/terrain evidence still prevent operational approval. The actual Public text supports that distinction. Agent understanding is not user acceptance or a substitute for an independent human cold review.

## Verification boundary

The automated checks cover map-region selector visibility in 2D/3D/split; physical camera navigation by vertical pointer drag; Public failure guidance and Planner bracket/detail; equation notation and variable units; keyboard/pointer inspector width changes and right-edge overflow at 1600/1280/900/800 CSS px. The new narrow-control check additionally tests actual pointer access. Intentional horizontally scrollable table regions are reported separately from escaping controls/text and outer-panel overflow.

Actual human screen-reader operation and announcements remain incomplete. This script does not claim a contrast audit, native 200% browser zoom, all interaction states, mobile device behavior, independent physical terrain/frame validation, Horizons verification, all-app completeness or creative/user acceptance. No numerical/scientific implementation was changed, so Horizons was not rerun in this lane. Existing evidence must not be promoted to a fresh gate result.

## Retained checkpoint and results

Consolidated evidence: `/tmp/solarreach-checkpoint-evidence.json`, checked `2026-11-14T16:36:21.258Z`. It validates matching checkpoint records across retained legs, the current local artifact hash/marker, the single expected regression failure, zero runtime/HTTP-resource/console errors, and zero offline HTTP attempts. It does not discard the failed/interrupted invocation reports.

| Identity | Actual value |
|---|---|
| Ready marker | `Sat Nov 14 16:07:36 UTC 2026`; mtime `1794672456561.0115` ms; unchanged through final verification |
| File and HTTP GET decoded body | 76,396,012 bytes; SHA-256 `a77d6fa166d5eb59e8ce7d1604c2b9b84dd894dc902b0f209af7b82297f9f13b` |
| HTTP validator | `W/"48db5ec-1a1dae44d9b"`, same on hash GET and native Chrome navigation; browser received gzip |
| Rendered identity, all legs | `solarreach-catalog-00d28b6c04511cae-global-6f07f0b8edf12748`, `planning-4` |
| Browser | Google Chrome `149.0.7827.155`, `/usr/bin/google-chrome`, headless, fresh contexts, reduced motion |
| Host | `CLEVO-X2`, Linux `7.0.0-38-generic`, Node `20.20.2` |
| CPU / memory | AMD RYZEN AI MAX+ 395 w/ Radeon 8060S; 32 logical CPUs; OS memory 130,148,806,656 bytes |
| Actual WebGL renderer | ANGLE Vulkan 1.3.0, SwiftShader Device (Subzero), SwiftShader driver; these are software-rendered interaction tests, not Radeon performance measurements |

The marker supplies no build commit. Artifact identity is the hash above; the local QA checkout is not asserted to be the parent build's source revision.

| Retained leg | Checked UTC interval | Result | Browser HTTP attempts |
|---|---|---|---|
| HTTP source | 16:23:21.756–16:25:18.620 | 7 scoped checks passed | 46 |
| HTTP identical standalone | 16:30:24.809–16:32:54.277 | 7 scoped checks passed; HTTP hash equals local artifact | 1, plus the separately recorded hash GET |
| Offline file, final regression | 16:33:18.629–16:35:11.994 | 7 passed; 1 actual failure, F1 | **0** |

All intervals are on 14 November 2026. The source and HTTP standalone completed their seven-check legs before F1's automated regression was added; their 800 px failures are separately confirmed by the fresh Public pointer repro above. This is **21 passing automated checks and one failing automated check across retained legs**, plus the three direct F1 reproductions. It is not a claim that one all-target invocation passed. The offline regression exits 1 intentionally because the app still has F1.

Retained leg directories, each with `report.json`, `trace.zip`, PNG/ARIA evidence and `video/`:

- `/tmp/solarreach-checkpoint-final-v2/http-source/`
- `/tmp/solarreach-checkpoint-http-bundle-proof/http-identical-bundle/`
- `/tmp/solarreach-checkpoint-offline-regression/offline-file/`

The source leg's parent invocation was stopped during the subsequent failed HTTP capture attempt; only its already completed seven-check source leg is counted. Its checkpoint matches both later completed invocations. The earlier `/tmp/solarreach-checkpoint-bundle-final-v2/offline-file/` seven-check pass also remains available but is superseded in these totals by the eight-check offline regression.

All retained legs used 32 trusted constant-x pointer moves. Camera geography ranged from −89.534372665° to approximately +89.534267336°; radius stayed approximately 5434.151 km, above the runtime globe collision bound, and scenario identity stayed unchanged. These are camera readouts, not site measurements or terrain validation. North/south screenshots were visually inspected.

Each leg sampled 14 variable definitions from 104 available choices, covering area, efficiency, flux, elevation, battery capacity/energy, UTC/flight time, radio frequency and mass. Every sampled variable exposed units, meaning, physical measurement, intuition, limits and a readable equation. Educator displayed the Wh/hour/J and degree/radian distinctions. This is not an independent audit of all 104 definitions or their physical models.

Inspector keyboard resize measured 360 → 1040 px; pointer drag reduced it to 900 px. At viewport widths 1600/1280/900/800, the inspector remained within the viewport, its own scroll width equaled client width, and no measured visible control/text box escaped it. Narrow inspector widths were 828 px at viewport 900 and 728 px at viewport 800. Tables retained their explicit scroll containers. Visual inspection of the 800 px screenshot exposed F1 despite these numeric overflow passes; pointer hit-testing then confirmed it.

Fresh delivery checks: `npm run typecheck -- --incremental false`, `npm run lint`, `node --check scripts/verify-checkpoint-interactions.mjs`, and `git diff --check` passed. `slop-scan` was not installed in this environment; no new tool was installed and no fresh scan pass is claimed. No build, server, merge, push or scientific verification was performed in this report-only lane. Durable findings and cold-review limits are saved in this owned record; shared vault files were not modified under the two-file ownership constraint.
