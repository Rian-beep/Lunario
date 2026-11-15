# Scientific chain verification (T18)

The verifier distinguishes analytic/software consistency from independent physical validation. Passing analytic fixtures does **not** validate terrain occlusion, frame transformations, engineering assumptions or landing readiness. The overall report remains `scientificValidation: "INCOMPLETE"` until an independent matched-source terrain comparison exists. No guessed rotation, fabricated residual or physical tolerance is used.

## Run and interpret

```sh
node --import tsx --test tests/planning-invariants.test.ts
node --import tsx scripts/verify-planning.mts --output /tmp/solarreach-science
npm run typecheck
node_modules/.bin/eslint scripts/verify-planning.mts tests/planning-invariants.test.ts
```

The CLI writes `science.json` in the requested directory and prints a compact summary. Exit 1 means a numerical/invariant check failed; exit 2 means the analytic checks passed but the scientific truth gate is still incomplete. It intentionally never exits 0 while that gate remains incomplete. A malformed CLI invocation also exits 1. The report includes UTC run time, model version, git commit where available, actual source/asset SHA-256 values, manifest source IDs/product versions/hashes, units/frame, raw fixture results, expected reference descriptions, per-check durations, actual error messages and skipped/incomplete gates. Missing source files have explicit null hashes and an error. Raw typed arrays are JSON arrays; nonfinite unknowns are null.

The test imports the same executable verifier and checks every declared invariant result, plus the incomplete-gate/reporting contract. The verifier calls the actual production modules and does not implement a competing simulation. Independent reference arithmetic is restricted to bounded analytic fixtures.

## Analytic references and chain coverage

- Four dark 1 h intervals with load 100 W, initial/full capacity 300 Wh, reserve 20%, unit efficiencies: boundaries `[300,200,100,0,0]`, unmet 100 Wh, model reserve crossing 2.4 h, duration below reserve 1.6 h, first unserved demand 3 h. Event UTC bounds retain the hourly source bracket; interpolated offsets are model estimates.
- Two 1 h intervals with 200 W generation, empty 100 Wh capacity and charge cap 50 W: end storage 100 Wh, curtailed 300 Wh, per-interval end storage `[50,100]`.
- Deployment at 0.5 h in a 2 h, 200 W source gives 300 Wh generation. Baseline 20 W plus 10 W over `[0.5,1.5)` and 30 W over `[1,2)` consumes 80 Wh. At unit efficiencies, initial 100 Wh becomes 320 Wh. Load overlaps and deployment splits cannot be averaged away.
- Initial 30 Wh below a 60 Wh reserve is a violation at model offset 0, with 4 h below reserve; zero-capacity/zero-load darkness remains finite with zero unmet energy. An unknown solar interval poisons later storage; a known reserve failure before the gap remains reportable as **first known**, with the gap disclosed.
- Independent free-space reference: 1 GHz, 1 km, 1 W, zero dBi antenna gains/loss, 290 K, 1000 bit/s and required Eb/N0 0 dB. Wavelength 0.299792458 m gives path loss 92.44778322188337 dB; Boltzmann noise density −203.97518719422808 dBW/Hz gives Eb/N0 81.52740397234471 dB. This is a Friis arithmetic check, not station availability or a qualified radio link.
- Celestial limiting geometry: equatorial zenith, east/west geometric horizon, finite exact-pole behavior, Earth subpoint overhead, uniform disk equality/partial/full visibility, high/low local horizons, cyclic azimuth interpolation and unknown ray sectors.
- Catalog endpoints use n epochs for n−1 intervals. The last epoch cannot start a stay, even if a manifest wrongly advertises broader coverage. Array and antenna heights resolve independently; antenna contact uses its own horizon channel.
- Missing/invalid ephemeris and missing masks cannot become known resource passes. NaN metrics remain not assessed. A custom coordinate cannot inherit the selected catalog site's coarse slope. Actual prepared frame evidence cannot be promoted to unconditional completeness.
- Absent external engineering reports remain not assessed. A reported pass is conditional; reports bind to the scenario/evidence scope and become stale after a relevant edit. The interval/event engine must use a model version distinguishable from the pre-T05 `planning-1` contract.
- Every whole-mission search result reopens to the exact authority assessment. Unsupported endpoint starts are counted outside, never shortened. Finite 2×2 sensitivity cases are deterministic, ordered, immutable experiments; no probability distribution is inferred.

Numeric tolerances in analytic checks are floating-point arithmetic tolerances only. They are not terrain/source accuracy or confidence bounds. Interpolating a 359°→1° display transition across north does not create independent higher-frequency evidence. Actual catalog mask samples are recorded separately from synthetic equatorial fixtures and are checked only for structural sanity.

## Unresolved physical validation gate

ADR 0005 records PGDA product 90 as MOON_ME of DE421, while the catalog uses MOON_ME / Horizons MEAN_ME with DE441. Exact orientation equivalence and propagated errors are unresolved. The full source DEMs are not included in this repository. No second-source/independent-ray horizon dataset with matched frame, coordinates, observer height, angular sampling and source resolution has been established here. A photograph's historical shadow is not selected-date horizon truth. Consequently independent terrain occlusion validation remains **INCOMPLETE**, with no residuals or tolerances invented.

The existing `docs/qa/horizons-decoded-validation.json` is retained as historical context: 4 sites × 2 bodies × 7 observer samples = 56 comparisons, using the recorded 0.02° quantization-aware comparison threshold. Its original UTC timestamp and raw residual rows are included in the report. It is not a fresh query, source accuracy claim or terrain validation. No ephemeris or geometry algorithm was changed by this verifier, so no fresh Horizons request was triggered. If those algorithms change, run `npm run verify:horizons`; provider failure prevents a new validation claim. Hourly celestial checks cannot qualify ground-station scheduling.

## Cold review findings and integration boundaries

Read-only review of the parent assessment/context found three concrete issues, returned to the parent for corrections: custom coordinates inherited catalog-site slope; missing ephemeris provenance retained finite celestial calculations; the context admitted the final catalog epoch when the manifest allowed a wider date range. The verifier contains regression fixtures for all three. The parent supplied corrected source snapshots and the T05 interval/event implementation for remote verification. This workstream changes only the verifier, invariant tests and this document.

Aggregate/radio/slope failures are not necessarily localized events. A whole-stay UTC bracket with a null model offset is a valid uncertainty bound, but its start must not be sorted as a precise first failure against timed events. The UI must distinguish timed first-known violations from failed aggregate requirements whose event time is not localized. The cooperative 8 ms search/sweep budget yields between complete synchronous assessments; it cannot preempt an individual long assessment and is not a hard frame-time guarantee.

The actual NASA Apollo Lunar Module GLB and local Draco decoder were reviewed independently of the physical model: the standalone builder embeds both exact local paths, the runtime retains the disposal handle, fetches abort on teardown, late geometry is disposed, and late callbacks are suppressed by the runtime's disposed flag. All seven existing equipment tests decode every committed compressed mesh and check normalization, success/error and late disposal. This is static/lifecycle verification only. No browser/GPU, direct-file load, visual orientation or physical engineering-dimension validation is claimed; NASA display geometry retains nominal height normalization and generic flight physics.

## Recorded verification outcome

On Clevo, 14 November 2026, the assigned pre-T05 `df42a98` checkpoint genuinely failed seven of the initial 18 checks: exact darkness reserve duration, charge-rate timeline, endpoint enforcement, independent antenna channel, missing ephemeris, custom slope inheritance and bounded event offsets. Raw baseline output is `/tmp/solarreach-science-baseline/science.json` on Clevo. The fixtures were preserved, not weakened to match old accounting.

Final validation used the parent's committed T05 `2e9334e` and T06 correctness `90129a1` production snapshots copied into the isolated remote verification tree, including the adapted nullable mission fixture; these dependency files are **not** part of this workstream's commit. The final independent suite passes 25/25 tests (24 numerical/chain checks plus the reporting-boundary contract). All seven equipment tests also pass. Project typecheck and targeted ESLint passed against those snapshots. The CLI reports `analyticStatus: "PASS"`, 24 passing checks, zero numerical failures, one incomplete terrain gate, one skipped fresh-Horizons query, and exits **2** as designed. Raw final output is `/tmp/solarreach-science-final/science.json` on Clevo. Its source hashes identify actual validated bytes; its git base commit and `sourceTreeDirty` flag explicitly disclose the overlaid dependency state.

The interval/event model is now `planning-2`, distinguishable from historical `planning-1` output. A warning-text assertion was adjusted to check the actual uncertainty disclosure rather than require a particular phrase: a gap *after* an already localized failure prevents a full-stay assessment but cannot hide an earlier failure. Numeric storage, event-offset and gap-poisoning assertions remained unchanged. No fresh network science query, browser, server, production build, Simulator, Metro or dependency install was performed. Authorship was local; execution/verification was remote.
