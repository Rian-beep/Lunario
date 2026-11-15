# Current verified software-rendering fix — 15 November 2026

All scoped implementation work is integrated: the five isolated evaluation lanes, terrain/lifecycle corrections, responsive site selection, confidence and station evidence integration, source replay/framing, asynchronous NASA color decode, dark-panel readability and camera interruption/readiness repairs. The current scientific register has **42 verified bounded claims, 22 uncertain, zero failing recorded comparisons**. Canonical planning-5 and supplementary station-comms-2 are separate authorities; neither is operational certification.

Available source-position replays: Chandrayaan-3 reference descent, Apollo 15 command-module orbit, and NASA/PDS reconstructed Odysseus, Blue Ghost 1 and Athena descents. No attitude, burns or terrain contact is inferred from these extracts. Qualified full launch/ascent/transfer paths are not supplied for every mission.

## Remaining work and teammate priorities

1. **Hosting — teammate owned.** Publish the checked repository root and split web bundle. Keep the single-file offline download separate. No Vercel configuration or deployment was performed in this task.
2. **Actual users and devices.** Conduct the public/educator/planner study in the retained task sheets; test real touch hardware, assistive technology and slower networks. Automated agent journeys and touch emulation are not a human study. Native and software-rendered web/offline flight checks now pass, including the older-browser fallback with a four-times CPU slowdown. The prior contact-preparation timeout is fixed; software rasterization still paints slowly and emulation is not acceptance on every physical low-end device.
3. **Authenticated terrain streaming.** Verify the actual configured Cesium payload at close range and adjacent tiles on target devices. Geometry readiness alone does not establish high-resolution photographic texture or source registration. Bundled measured inspection terrain and offline fallback are implemented.
4. **Qualified terrain and uncertainty.** Obtain applicable frame/datum registration, effective resolution, error characterization and footprint hazards. The finer visual terrain intentionally does not replace numerical contact terrain. Declared finite sensitivity is not a calibrated probability or continuous physical interval.
5. **Station support and weather.** Obtain dated station-specific lunar rays/masks, calibrated compatible RF hardware and acquisition assumptions, applicable atmospheric evidence and authenticated allocations/bookings. Refresh the incomplete live JPL comparison: one parent attempt retrieved 50 epochs and received a Canberra HTTP 503; archived 75-epoch checks pass. Earth-centre visibility alone cannot establish a selected station service.
6. **Vehicle and operations evidence.** Qualify GNC/trajectory/covariance, actual vehicle performance, structural/soil/plume behavior, thermal survival, traverse/walkback and abort plans. The editable flight and breakup are teaching/screening models, not certification.
7. **Additional historical data.** Add qualified source trajectories and route rationale when mission agencies publish them; retain exact source, vehicle, phase, frame, timescale, coverage and uncertainty. Do not fill missing telemetry with an invented historical route.
8. **Maintenance.** Keep data/model identities and reviewed input/engine/reference bindings current. Rerun numerical comparisons and fail-closed publication checks before approving changed evidence. Preserve original retrieval timestamps and API metadata when refreshing/importing observer data.

Current software-rendering test/artifact evidence is in `qa/software-contact/REPORT.md`; the broader earlier evaluation remains in `qa/evaluation/release/REPORT.md`. Previous release chronology below is archived context; older counts, model IDs and outstanding implementation labels do not describe the current release.

---

# Scientific audit, mission paths and NASA visual upgrade

The parallel Clevo science, framework, trajectory, visual and independent-review lanes are integrated. Planning-5 corrects range direction, site parallax, terrain cutout registration, producer unknown support and legacy contact-event interpolation. The current register records41 verified bounded claims,21 uncertain and0 currently failing recorded numerical comparisons. This is not operational qualification. Three final-review integrity/documentation findings were corrected; baseline evidence remains archived. See qa/final-science-review/RESOLUTION.md.

Location exposes mission history in all audiences and Mission paths & reasons. Two bounded source paths replay independently of planning time; no confirmed as-flown lander/launch/ascent dataset is claimed for all missions. Other sites have editable educational simulation. NASA2025 colour and calibrated1× visual relief reach8K on supported web devices,4K offline; global imagery still does not resolve touchdown-footprint hazards. Cesium's authenticated close-up texture acceptance remains unresolved; a connected mesh is not a quality pass.

Highest-leverage teammate tasks: deploy the tested repository-root build on the final host; test real target devices and network latency; observe first-time public users; obtain and qualify site-specific fine DEM/hazard, vehicle/GNC/contact, thermal and station-support evidence. Hosting remains teammate-owned. The full outstanding physical/operations and acceptance list below remains applicable.

---

## Earth context, terrain and chart follow-up

Implemented: six dated spacecraft identities and predictions, source/epoch/age, independent orbit time, explicit cached refresh and offline import; pole/site navigation labels; measured close-view tessellation; stable polar texture projection; circular help and proportionate plots. These do not close the qualified evidence tasks below. Fine terrain is limited to measured bundled coverage. GP predictions and DSN look angles do not establish relay capability, current operation, weather losses or booked station support.

# Workspace room and Planner Var

The wide context banner is now an optional inspector disclosure; desktop inspectors reserve canvas space and fill the available height. Compare is docked separately, Earth station controls are grouped, and Planner Var brings relevant native formulae into the inspector. See [workspace evidence](qa/workspace-room/VERIFICATION.md). Hosting stays teammate-owned. Existing operational-evidence and human/device acceptance TODOs below are preserved.

---

# Public exploration and theme delivery

The document-owned original loader now runs on each load/reload with a three-second minimum (the original reduced-motion version is retained). Public site stories and DSN/weather explainers use existing sourced catalog records and explicitly distinguish geometry from signal/link margin. The persistent light/dark switch changes interface surfaces only. See `docs/qa/public-context-theme/VERIFICATION.md` for this release’s measured checks and artifact identity.

No hosting settings are changed. Qualified station visibility/scheduling, actual radio/atmospheric link budgets, hardware/terrain flight qualification and observed human learning remain open as detailed below.

---

# Public flight first-use correction

15 November 2026: fresh Public sessions now reach Play without scrolling past technical reset/status reports. Each of 22 numeric flight controls has adjacent effect/limit help; changed settings compare calculated contact values and public predictions explain all failed touchdown checks. Heavy WebGL setup yields until after a paint opportunity and cancels stale mounts. Production/offline playback and physical-scale Follow are verified; see [current first-use evidence](qa/public-flight-usability/VERIFICATION.md). Prior failed cold/software-renderer receipts remain in that record. Hosting remains teammate-owned.

Highest-leverage teammate work: observe interested non-technical participants finding Lander, playing a reference, changing one setting and explaining the outcome without prompting. Record misclicks, time to first playback, prediction/explanation accuracy, and whether they choose another experiment. Automated checks do not establish enjoyment or learning. Qualified mission evidence and final-host/device/accessibility acceptance below remain open.

---

# Current Lunario correction

15 November 2026: the user supplied the actual identity repository, `Rian-beep/Lunario`, and reasserted the cream/peach/orange/ink/mint visual reference. Three scoped Clevo Sol lanes delivered the original brand/loader, reference styling and tested flight experiments. Root integrated startup/onboarding, the local Follow camera, camera-ready playback and replay. Source checks and new web/offline flight journeys pass; final native/viewport evidence and Git delivery are recorded in [the current QA ledger](qa/lunario/VERIFICATION.md). Hosting remains with the teammate.

This supersedes the earlier charcoal Lunar Window visual direction. The numerical/qualified-evidence TODOs below still apply. Cold target-user studies must establish whether the new experiment loop is engaging and teaches effectively; automated success does not establish that.

---

# Implementation checkpoint and team handoff

Updated 15 November 2026. Lunar Window software release gates pass; private PR3 contains the integrated delivery. Hosting belongs to the teammate. This workstream does not deploy. See [the release evidence ledger](qa/refinement/FINAL-VERIFICATION.md).

## Integrated behavior

- Dark Lunar Window identity and truthful precomputed loader, warm orange framed surfaces, preserved icons and header control placement. Full viewport maps with internal inspector scrolling; compact/dismissible location, telemetry and timeline controls.
- Whole-Moon and south-polar maps, historical/Artemis sites, numerical terrain and original NASA Moon/lander/Earth/Sun assets. Shared original 8K atlas is embedded once and leased between globe/local terrain; six real NAC centre patches provide approximately 2.09 m/output pixel. Other coordinates retain their actual coarser source limits.
- Moon/Earth/Lander focus, pole/cardinal navigation, custom-point markers, animated camera transfers, fixed physical 1× lander and mass-centre Follow through flight/contact. Measured projected bounds account for actual viewport and panels. Goldstone, Madrid and Canberra are DSN ground complexes, not orbiting satellites.
- Editable assisted terminal descent/manual flight, conditional path outcomes, bounded Rapier bounce/tipping/illustrative breakup. Successive collision resolution now permits up to eight internal CCD substeps while preserving 120 Hz output, all 157 original proxies, coefficients, mass and the signed 5 cm clearance gate. The actual failing geometry was reproduced before correction.
- Header **Replan mission** captures a fixed reference and separate candidate: change only date/site, apply +1/+7 day delays, retain full stay/hardware/requirements, compare elapsed or overlapping UTC histories and inspect exact violations. Browsing a candidate does not change the active mission. Unknown evidence is not ranked favorably.
- Public causes and next actions; Educator Teaching studio with predictions, native equations, derivative units, actual finite responses and saved notebooks; Planner requirements and Engineering evidence workspace.
- Educators explicitly capture/recapture immutable scenarios, choose goals, edit prompts/hints and export separate printable student worksheets, teacher answer keys and portable teacher JSON. Student-safe givens include actual source context, native symbol legends and distinct known-zero/unavailable generation evidence; student HTML has no hidden answers or full scenario payload.
- Dated supplemental station geometry, masks, radio/weather/rate/allocation and critical-window evidence, strict imports/exports, explicit provider fetch/cancel and finite declared-bound cases. Missing stages prevent complete adequacy claims. These envelopes do not silently alter canonical `planning-4` assessment.

## Implementation and release gates

Workers run on Clevo with `gpt-6.1-sol`, isolated worktrees and exclusive files, with no more than four active agents including Root. Hosting remains with the teammate. Tested product source is `f7ecd636f36955509e6e24f54c1fe85df2a25ab2` (C15).

| Workstream | Current evidence and remaining work |
| --- | --- |
| Root source/build |763tests, types, lint, math314 and isolated Next/standalone builds pass. Both original NASA assets and numerical planning-4 authority remain unchanged |
| Native viewport/graph corrections | The short-window HUD now docks outside the canvas; axis text clears keyboard focus rings; final battery energy can be inspected without advancing the environmental clock beyond its supported stay. Independent Mac8/8viewport gate passes, including12native200HTTP/fileHUD/location states and all6scienceplot focus/battery-end checks |
| Core browser checks | Final C15 actual Next and disconnected-file50/50:18planning,12antenna-contact,20playback. Actual6h/s versus24h/s clock/cursor ratios, import/export, controlled cases, unknowns and historical records checked |
| Workflow verification | C15HTTP41/41 and disconnected-file41/41:82/82pass,0failed/unexecuted, normal exit0, zero unexpected browser errors. Separate teaching exports, captured givens and supplemental evidence/cancellation/validation paths checked |
| Visual/navigation matrix | Final width 800: 49/49; widths 1280/1728: 99/99; native 100%/200%: 104/104 pass, zero failed/unexecuted, all browser-child exits 0; enclosing tool exits 143 are preserved with unverified cause in the final report. Four maps, graphs/ticks, workspaces, keyboard, source retention and actual raster checks pass. Historical harness defects and corrected F9/F10/F11 findings remain recorded |
| Contact/source review | C13all6nominal/breakup/bounce cases overHTTP/file completed13checks,399renderframes/112contactframes, no clearance failures,34raster measurements(min7.00:1). Parenttool exit143 after the final PASS is preserved as an unexplained anomaly. C15 independent source review found0blockers; nominal HTTP/file contact passed13checks,173frames/26contactframes and18contrast measurements with normal exit0. Other C13case evidence stays explicitly identified with unchanged physical-module/asset hashes |
| Hardware continuity/performance | Final actual Radeon 8060S/Vulkan HTTP/file: 14/14 checks pass. Isolated edits retain the visible framed vehicle, scene and assets. Measured render response about 59–62 ms; machine-specific frame gaps and asynchronous contact preparation are documented in the final ledger |

C15 immutable HTML: SHA256 `094b080b03fdcb8629f71ba294fb20c43e448d670367fe11001ecf4839e9765c`, source `f7ecd63`. The committed `public/solarreach-navigator.html` is the exact tested final file, 81,081,637 bytes; generated delivery commit `783f4f3`. Local preview4317 runs C15; canonical browser inputs retained their exact SHA256 across promotion. The exact tested download is served by the local preview; final Git state is available in private PR3.

Tailscale access is restored. Root reclaimed992,230,550bytes of obsolete owned generated builds after stopping their servers; current build and compatibility chunks remain. No source/data/history was deleted. Final slop scan: seven inspected notices, comprising five existing notices and two readability notices on the QA attempt→check alias. No application regression or metric-only refactor was made.

Release integration requires scoped diff review, independent relevant checks, exact source/artifact identity, rendered evidence, a survey of all agent worktrees and final source/diff/private-origin checks. Human acceptance and qualified mission evidence remain separate.

## Full remaining work

### Completed software verification

- [x] Resolve raw UTC/apparent-header, contradictory request-source and changed-requirement cohort regressions. The original19 adversarial test bodies remain unchanged;36 review tests remain integrated and the final source suite passes 763 tests.
- [x] Verify candidate date/site edits, held reference/hardware/requirements, shared cursor and UTC windows, all resource/contact plots, failure navigation, bounded alternatives/cancel, open/save/export/import.
- [x] Verify Public causes/actions, Educator prediction/result/native math/notebook and Planner evidence inputs/import/export/invalid/stale/partial/zero cases on web and offline.
- [x] Verify 1280/1728/800 layouts, actual rendered lander bounds around open panels/HUD, Follow through nominal/bounce/crash, legacy/manual/configured solver help and native notation.
- [x] Replay poles/orbit/zoom, asset focus, custom marker, texture retention/no baseline reload, playback timing and panel dismiss/restore on the final artifact.
- [x] Check native 200% zoom, keyboard focus/dialog dismissal, measured text contrast, uncaught errors and fully disconnected zero-HTTP behavior.
- [x] Record final exact source/artifact identities, combined validation, scoped review, all-worktree survey and private Git delivery through PR3. Hosting stays with the teammate.

### Qualified science and operational evidence (requires actual evidence)

- [ ] Recover original catalog response/time/EOP settings and quantify propagated frame/terrain/event uncertainty. Fresh source conventions and independent station references do not authenticate the old catalog.
- [ ] Supply mission-specific fine landing-footprint terrain/rocks/soil/gear evidence, measured vehicle/controller/navigation properties and complete arrival/ascent/abort trajectories. Coarse terrain/contact previews cannot certify touchdown safety.
- [ ] Supply station-specific lunar masks and local horizons, actual antenna/noise/acquisition/dynamics/service compatibility, mission-date RF/weather assumptions or forecasts, allocations and required rate/critical-contact coverage. Visibility is not a DSN reservation.
- [ ] Supply traceable thermal survival, power/hardware degradation, plume keep-out, traverse/return and other required subsystem reports with revision, units, time, location and vehicle scope. Analytical screens remain conditional until supported.
- [ ] Obtain qualified lander structural/material/landing-gear/soil models before describing illustrative fragments as real fracture mechanics.
- [ ] Obtain defensible bounds before treating finite stability samples as a continuous enclosure or probability of success.

### Human acceptance and maintained operation

- [ ] Run cold Public, Educator and Planner task studies with actual target users. Record exact scenarios, observed completion/errors, explanations and confidence; capture distinguishes human, agent and self-report. No participants or pass rates have been fabricated.
- [ ] Perform actual screen-reader and real touch/trackpad/device accessibility testing. Automated keyboard/contrast/reflow is narrower evidence.
- [ ] Verify hosted optional-provider browser/CORS behavior and failure/cancel/stale states from the teammate's final origin. Do not count fixtures or mocked transport as live provider success.
- [ ] Measure memory/GPU/context lifecycle and frame/interaction latency on target devices after hosting. Existing named-machine runs are not a universal performance guarantee.
- [ ] Investigate the preserved outer-tool exit-143 anomalies separately from the completed exit-0 browser children; retain raw process receipts and original candidate identities.
- [ ] Recheck the existing Draco decoder deprecation before a future Three.js upgrade; the pinned current renderer works and emits no decoder error.
- [ ] For future calibrated SDO integration, validate FITS scaling/WCS/channel/acquisition/rotation metadata and retain missingness; a synoptic composite is not a live observation.
- [ ] Follow `docs/PROVIDERS.md` and dataset regeneration/hash/version recipes for new sources. Preserve observation/forecast/composite/allocation distinctions and old decision reproducibility.

## Highest-leverage teammate contributions

1. **Provide one concrete reference mission.** Traceable vehicle, power, radio, gear/soil, thermal and contact requirements make scenario feasibility meaningful. Supply versioned evidence under `docs/team/reference-mission/`, avoiding active UI/renderer files.
2. **Validate original frame/terrain provenance and real communication support.** Own `docs/team/communication-validation/` and raw source fixtures. The new independent station-geometry check narrows this work; it does not supply bookings, antenna properties or original catalog metadata.
3. **Run cold audience studies.** Have non-authors explain why a case fails, what to change, why a ridge/date matters and which evidence is missing. Export cases and recorded task evidence under `docs/team/usability/`.
4. **Own hosting and origin-specific checks.** Deploy the final tested Git commit; check prepared/offline data paths, compression/cache headers and optional-provider CORS. The client-only app requires no committed secrets.
