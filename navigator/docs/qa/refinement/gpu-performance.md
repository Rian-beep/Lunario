# C15 hardware performance observations

Measured 2026-11-15T00:45:29.519Z–2026-11-15T00:46:57.041Z. **12/12 scoped checks pass**, two fresh private Chrome processes, sequential local HTTP then fully disconnected file. Benchmark process exit 0. These are bounded hardware observations, separate from the visual/software acceptance runner. No product changes or optimization comparison.

## Reproduce

```bash
node scripts/verify-hardware-performance.mjs --mode both \
  --output /tmp/refinement-hardware-c15/reproduction-UNIQUE
```

Requires the immutable marker, instructions, artifact, source bundle and read-only source identified below; existing HTTP43328 must already be running. The script starts no server. `--mode http|file|both` and marker/instructions/sourceBundle/output path overrides are supported. Chrome and Playwright module paths can be supplied through `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and `PLAYWRIGHT_CORE_MODULE`. Use a new output directory to preserve earlier evidence.

Both private contexts use normal motion and only ordinary visible controls/input. There is no app bridge, synthetic engine state, canonical storage edit, camera/renderer patch, forced click, CSS/DOM edit or dependency/driver installation. Observers store their own samples only. Wet mass, selected site and Moon focus are restored through controls; closing the private contexts discards their storage.

## Candidate and actual context

- Source: `f7ecd636f36955509e6e24f54c1fe85df2a25ab2` at `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c15-final-check`; all **525 tracked source file hashes** and clean Git state match before/after.
- HTML: `/tmp/lunar-window-c15.html`, 81,081,637 bytes; file and HTTP SHA-256 `094b080b03fdcb8629f71ba294fb20c43e448d670367fe11001ecf4839e9765c` before/after.
- Executing script SHA-256: `92f687687c53060a4ff3359718694fb74c71c4c9d868b0d79d3ff55f49d245d1`; frozen copy `final/verifier.mjs` matches the committed script.
- `/tmp/solarreach-refinement-c15-ready.json` SHA-256 `73725066d42333a0983cb151d94d864c2160e2b2d2d5d051fce8bc36efdeec37`.
- `/tmp/refinement-c15-qa-instructions.txt` SHA-256 `73f9eb4b133b5241b574c1e405ff5fbd0cf680d09c0941c005cc3a82ce5c9da0`.
- `/tmp/lunar-window-c15-source.bundle` SHA-256 `638801bd1698329f0612a3efc762301c8627c2d860f4fa6f77a6b8c308a21d9a`.

Host `CLEVO-X2`: AMD RYZEN AI MAX+ 395 w/ Radeon 8060S, 32 logical CPUs, 130,148,806,656 bytes RAM, Linux 7.0.0-38-generic. Chrome **149.0.7827.155**. Concurrent workstation load; initial 1/5/15 minute load averages [30.52, 31.74, 30.23]. Viewport 1600×1000, DPR 1; initial app canvas drawing buffer 1600×600 (header/drawers occupy the remaining viewport). No CPU/network throttling.

Actual **existing app canvas** `getContext("webgl2")` reports the same context in both cases:

```text
Google Inc. (AMD)
ANGLE (AMD, Vulkan 1.4.335 (Radeon 8060S Graphics (RADV STRIX_HALO) (0x00001586)), radv)
WebGL 2.0 (OpenGL ES 3.0 Chromium)
```

Launch arguments: `--no-sandbox --enable-gpu --use-gl=angle --use-angle=vulkan`. The assertion uses the actual renderer string, rejects software renderers, and checks that the context is not lost. Flags or the separate preliminary GPU probe alone are not acceptance evidence.

Normal source atlas mode and `vehicleScale=1` are retained. Initial equipment status and Moon model are ready; production Moon readiness follows its awaited shared atlas load. Browser-decoded embedded bytes match the actual pinned source files:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| Original NASA mesh | 9,587,461 | `b5b8e312a88be26013fb8fd167586ade5ea695a6389e3a7a7d0fdab72158cb8e` |
| Original NASA atlas | 4,631,745 | `cc32b024491668b8a2d4e1a6c911ce9a130e9eb8e6704f65027697877f6aa77f` |
| Original NASA lander | 716,840 | `379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e` |

The Moon retains 1,015,808 original triangles and the 8192×4096 source JPEG. This benchmark does not repeat mesh/contact qualification.

## Startup and edit latency

Fresh browser/profile per transport, **warm OS/disk cache**, local 81 MB self-contained artifact. Timings start at navigation or the named UI activation, excluding Chrome process launch. These are not cold internet timings.

| Observation (ms) | HTTP | Disconnected file |
| --- | ---: | ---: |
| Navigation → load | 1089.1 | 1084.7 |
| Navigation → workbench visible | 2501.0 | 2448.6 |
| 3D activation → original assets ready | 2258.3 | 2062.5 |
| Navigation → original assets ready | 4813.0 | 4568.9 |
| Trusted wet-mass input → visible propellant update | 36.3 | 40.8 |
| Same input → new revision and completed render | 44.7 | 48.1 |

Normal Flight preview input changes wet mass **4700 → 4800 kg**. Both cases show propellant **2500 → 2600 kg**, `flightRevision` **3 → 4**, and completed-render telemetry mass **4800 kg**. Input event `isTrusted=true`; browser event and observer timestamps are retained. UI reflection means the changed visible computed readout; render reflection means a completed production render carrying the new flight revision/mass, not proof that the pending contact assembly has become visible. Original 4700 kg is restored through the same input.

## Completed render cadence

A MutationObserver timestamps changes to production `dataset.renderFrame`, which increments after `renderer.render` returns. This measures completed CPU-side render submissions, **not GPU fences, compositor presentation or display scanout**. FPS = consecutive counter advances / elapsed first-to-last completed render. Percentiles use nearest rank over adjacent completed-render timestamps; JSON retains every delta and camera/phase sample. No raw RAF-count substitution. All named windows have zero missed counter steps.

| Transport / window | Frames | Span ms | Completed renders/s | p50 ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| http / idle | 132 | 2182.9 | 60.01 | 16.5 | 19.2 | 21.8 |
| http / focus-Moon | 626 | 10432.7 | 59.91 | 16.6 | 17.8 | 49.2 |
| http / focus-Earth | 626 | 10415.8 | 60.00 | 16.6 | 17.8 | 32.3 |
| http / focus-Lander | 609 | 10419.7 | 58.35 | 16.6 | 19.0 | 196.7 |
| http / site-selection | 51 | 884.7 | 56.52 | 17.1 | 20.1 | 70.6 |
| http / wet-mass-edit | 34 | 572.8 | 57.61 | 16.9 | 23.2 | 55.7 |
| file / idle | 132 | 2184.5 | 59.97 | 16.7 | 19.5 | 23.0 |
| file / focus-Moon | 626 | 10430.8 | 59.92 | 16.6 | 17.9 | 54.5 |
| file / focus-Earth | 627 | 10432.3 | 60.01 | 16.6 | 17.8 | 33.5 |
| file / focus-Lander | 611 | 10415.8 | 58.56 | 16.6 | 18.5 | 212.3 |
| file / site-selection | 44 | 780.4 | 55.10 | 17.0 | 19.9 | 70.1 |
| file / wet-mass-edit | 34 | 566.3 | 58.27 | 16.7 | 21.8 | 56.5 |

Each focus window includes the normal roughly ten-second camera flight plus 350 ms after `assetFlight=idle`; the idle sample is 2.2 s. The site window includes normal terrain preparation and 350 ms settled asset flight; the edit window ends 500 ms after reflected input. Browser-side window boundaries, first-render delay and trailing time are retained separately so a short initial delay is not hidden by the percentile calculation. Screenshots occur outside measured windows.

The largest observed gap is **212.3 ms during Lander focus**, despite approximately 60 renders/s in other windows. Site-selection gaps reach **70.6 ms**. These measured interruptions must accompany the averages; this does not establish universally smooth navigation or a pass against an invented latency/FPS threshold. Contact precomputation overlaps Lander focus; causation for individual gaps is not established.

## Persistence and continuity

Normal Sites drawer selects **Connecting Ridge → Malapert Massif**, then restores the original site. Destination surface preparation is 432.0 ms HTTP / 319.4 ms file. Scene identity remains `56f316ba-4928-4421-859e-8d69a5b007ac` throughout HTTP and `1dac56a0-f239-4041-a227-646e63f74c4f` throughout file. All three actual camera modes take effect and finish asset flight; camera-position/target samples demonstrate movement.

Each transport records 11 browser request events: one document, six unique blob fetches and four script starts of one decoder blob. The four initial script starts match the pinned DRACOLoader four-worker pool; they are not repeated model/atlas/equipment transfers. HTTP has exactly one HTTP(S) request (the HTML); disconnected file has **zero HTTP(S) requests** with `context.setOffline(true)` set before navigation. There are no duplicate observed asset requests, scene replacements, page errors, console errors, failed requests or context-loss events. One Draco configuration deprecation warning is retained per transport. Embedded data/image operations may emit no resource/request event: this proves the observed request boundary, not every hidden decode or GPU allocation.

**Continuity observation H1:** at the end of the short site and wet-mass windows, both transports have `cameraMode=vehicle`, `assetFlight=idle`, `surfaceStatus=ready`, but `contactReplay=preparing`, `vehicleVisible=false`, and `vehicleFraming=inactive`. At the edit snapshot camera/vehicle distance is about 3681 km HTTP / 3271 km file; the screenshot shows the Moon while Lander remains selected. The earlier settled Lander focus snapshot is visibly framed at about 0.0266 km. Pending contact replay is not evidence of terrain/texture reload. The runner restores the fixture without waiting for this new replay to finish, so **duration, recovery and persistent camera failure are unverified**. This is a real short-window visibility/continuity observation for the scene/visual owner, not a new universal performance gate or a qualified defect diagnosis. Repro/evidence are in `/tmp/refine-gpu-performance-findings.txt`; no product fix or optimization was attempted.

## Verification and evidence

- Owned script: `node --check` and zero-warning ESLint pass. `git diff --check` passes.
- Exact read-only C15 source: **763/763 tests**, zero failed/skipped; `npm run typecheck -- --incremental false`, repository lint and `npm run math:check` all exit 0. Math check covers **314 expressions**, manifest SHA-256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f`.
- No numerical/ephemeris changes; no new Horizons verification claim. slop-scan is unavailable on PATH; no tooling installation.
- Full source check logs: `/tmp/refinement-hardware-c15/source-checks/`; actual source MathML manifest is recorded verbatim in `math.log`.
- Evidence root `/tmp/refinement-hardware-c15/final/`: `report.json`, per-transport JSON, ten PNGs, frozen verifier and before/after input/source hashes.
- Final report SHA-256 `ace2c0a1d1618ff4da991629a863e03caf483aba8ca0eeb66134238e2d1c85df`. Source engine hashes are included in the 525-file manifest, including runtime, material, atlas sharing, equipment and NASA loader.
- Earlier preflights are preserved separately. Harness failures concerned inspector body eviction, the initially absent surface-preparation marker, exact label matching around Info buttons, and misclassifying decoder-worker starts. They are not relabeled product failures or successful benchmark runs.

Existing software-rendered **0.6–2 FPS** figures describe the SwiftShader acceptance backend throughput, not this website on Radeon hardware. These runs do not form a controlled before/after comparison. Human testing, other devices/networks, full scene/viewport acceptance, screen-reader testing and mission/physics qualification remain unperformed by this lane. No universal FPS/latency cutoff, release approval or user acceptance is inferred.

## Settled transition and isolated edit correction — 15 November 2026

The preceding report is preserved verbatim as the **historical initial benchmark**, including H1 and its original evidence. Its short site/edit windows do **not** establish an edit continuity defect: production site navigation uses `sample !== null || awaitingHandoff` independently of `assetFlight`, and intentionally hides the lander during that navigation. A growing camera distance during its zoom-out is expected. Its edit numbers describe an input made during site flight, not an isolated edit from a settled vehicle baseline.

The corrected benchmark retains the same immutable C15 source/artifact, normal controls, original NASA assets, nominal scale, private contexts, local HTTP and fully disconnected file. No product code changed. It observes each completed production render: scene ID, camera mode/position/target/distance, `assetFlight`, vehicle visibility/framing, contact replay, Moon/equipment readiness and the actual surface status/site/revision/preparation telemetry. Initial `surfaceStatus`/`surfaceSite` are genuinely absent and recorded as `null`; no initial ready marker is fabricated. The marker exists after destination preparation starts.

For site selection it requires the destination's actual `Selected lunar site reached.` announcement, destination surface ready, Lander camera mode, original Moon/equipment ready, contact replay ready (idle is permitted only without a contact), vehicle visible/framed, no asset flight and at least 500 ms of stable completed renders/camera distance. Full transition and recovery have one 120 s budget. The final pre-edit baseline also checks the normal Lander button is selected, after opening/scrolling the ordinary flight controls. The isolated edit asserts visibility/framing and surface/asset/scene continuity for **every** observed completed render from the trusted input through contact readiness and a further 2.2 s. Preparing contact replay during that edit is recorded rather than treated as a visibility failure. Edit/recovery also has a 120 s bound. Failures retain the complete trace and screenshot.

Site/contact milestones are keyed to the **destination site and flight revision**, excluding old-site frames before the click takes effect. Phase durations use the browser clock that also timestamps frames. Per-frame equipment readiness reads only the small existing status paragraphs; scanning the whole standalone document would include its embedded payload and distort cadence. These are still CPU-side completed-render observations, not presentation/GPU-fence measurements or a controlled optimization comparison.

Final corrected run: **2026-11-15T01:02:44.054Z–2026-11-15T01:05:04.710Z, 14/14 checks PASS, process exit 0**. Both actual app canvases again report Radeon 8060S through ANGLE/Vulkan; the file context was offline before navigation and made zero HTTP(S) requests. The same 525 tracked source hashes, clean source Git state, artifact/HTTP, marker, instructions, source bundle and executing verifier identities match before/after. This is scoped agent verification, not user or release acceptance.

| Corrected observation | HTTP | Disconnected file |
| --- | ---: | ---: |
| Destination surface ready after site activation (ms) | 645.9 | 699.9 |
| Site arrival announcement (ms) | 10083.3 | 10094.7 |
| Destination contact replay ready (ms) | 3030.2 | 3057.3 |
| Full site transition + stable vehicle recovery (ms) | 20663.6 | 20680.2 |
| Trusted edit → visible propellant (ms) | 47.5 | 45.6 |
| Trusted edit → completed new-revision render (ms) | 61.9 | 59.4 |
| Trusted edit → new contact replay ready (ms) | 2629.2 | 2841.1 |
| Full edit/recovery observation window (ms) | 5424.3 | 5628.8 |
| Post-input completed renders, all visible/framed | 322 | 335 |

Both settled pre-edit baselines have normal **Lander selected**, `cameraMode=vehicle`, `vehicleVisible=true`, `vehicleFraming=framed`, `contactReplay=ready`, `moonModel=ready`, equipment ready, destination `surfaceStatus=ready`, and `assetFlight=idle`. Wet mass 4700 → 4800 kg gives propellant 2500 → 2600 kg and flight revision 3 → 4. Throughout the isolated edit, visibility/framing remain true/framed, camera distance remains approximately **0.02657066 km**, and contact replay changes preparing → ready. No failing edit frame was omitted.

**H1 resolution:** site flight intentionally hides the lander while zooming out/rotating/approaching: 589 HTTP / 594 file completed renders are hidden during that site phase; distance peaks at about 4464.68 km. `assetFlight=idle` during this interval does not mean navigation finished. After the roughly 10 s site approach, the normal vehicle focus flight/recovery finishes and the baseline settles at about 20.7 s. The isolated edit then preserves vehicle continuity. **No edit continuity product defect was reproduced by this settled test.** The historical H1 snapshots remain real observations of a confounded site-flight window, not evidence of a persistent camera or wetmass-edit failure.

| Transport / full window | Frames | Completed renders/s | p50 ms | p95 ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| http / idle | 132 | 60.02 | 16.6 | 17.6 | 19.7 |
| http / focus-Moon | 626 | 60.01 | 16.7 | 17.8 | 38.9 |
| http / focus-Earth | 627 | 60.00 | 16.6 | 17.5 | 42.1 |
| http / focus-Lander | 639 | 58.18 | 16.7 | 21.7 | 236.3 |
| http / site-selection | 1227 | 59.38 | 16.7 | 21.7 | 89.7 |
| http / wet-mass-edit | 323 | 59.66 | 16.7 | 18.3 | 65.8 |
| file / idle | 132 | 60.04 | 16.7 | 17.5 | 22.7 |
| file / focus-Moon | 623 | 59.72 | 16.7 | 17.9 | 80.6 |
| file / focus-Earth | 577 | 55.21 | 16.7 | 32.8 | 55.5 |
| file / focus-Lander | 638 | 58.07 | 16.7 | 18.8 | 259.5 |
| file / site-selection | 1214 | 58.70 | 16.7 | 22.3 | 96.6 |
| file / wet-mass-edit | 336 | 59.64 | 16.9 | 18.7 | 70.1 |

All named metric windows have zero missed render-counter steps. The isolated-edit cadence window includes the pre-input activation frame; the stricter continuity assertion starts at the trusted input. Largest observed gap **259.5 ms during file Lander focus**; site-selection maxima are **89.7/96.6 ms**, isolated edit maxima **65.8/70.1 ms**. These gaps accompany the averages. Concurrent workstation load remains a limitation (initial 1/5/15 minute averages 6.11/14.47/23.26); the fresh source checks below ran after this final browser run, not inside its measured windows.

No page/console/request/context-loss errors, scene replacements or duplicate observed asset transfers occurred. Scene IDs are `76a0e84a-a65d-4aab-888b-674424901601` HTTP and `d7dfeaf0-e1f6-4ae2-b3f9-35f8c5d451ed` file. Each transport retains the existing Draco deprecation warning and the four initial decoder-worker starts. Readiness, request and CPU-render evidence does not qualify internal allocations, GPU presentation, physics, screen-reader behavior or other devices.

Evidence: `/tmp/refinement-hardware-c15/settled/` contains final `report.json`, full per-transport traces, frozen `verifier.mjs`, source/identity manifests and 12 screenshots. The settled site, pre-edit baseline and edit PNGs for both transports were visually inspected and show the framed original Lander. Report SHA-256: `5d065643ec758aebd9daa01ae19d5a81dc5f65a895b32cce5acd3eb2dde95b64`; executing/committed script SHA-256: `15f0040f9864af41ed4c46fde02b687116d65c6fd544a37b19021fea58d21733`.

Preserved harness history under that directory: `attempt-1/` is a complete continuity pass with expensive whole-document equipment observations and an old-site contact-ready milestone; its cadence/timing summaries are superseded. `attempt-2-aborted/` records the deliberate interruption to remove observer overhead. Playwright handled SIGTERM and advanced that runner; `attempt-3-interrupted/` retains the resulting incomplete/mixed attempt and termination explanation. Only the final root report above is the corrected acceptance run. No product failure evidence was deleted or relabeled. The original `/tmp/refinement-hardware-c15/final/report.json` SHA remains `ace2c0a1d1618ff4da991629a863e03caf483aba8ca0eeb66134238e2d1c85df`, and the preceding historical document bytes are unchanged.

Fresh final verification after the corrected browser run: **763/763 tests**, zero failures/skips; nonincremental source types, repository lint and MathML check (314 expressions, unchanged manifest SHA) all exit 0. All 525 tracked source files and clean source Git state rechecked after these commands. Owned script syntax/zero-warning ESLint and diff checks pass. Logs: `settled/source-checks/` and `/tmp/refinement-hardware-c15/settled-{syntax,eslint,diff}.log`. No numerical/ephemeris change or new Horizons claim; slop-scan remains unavailable.
