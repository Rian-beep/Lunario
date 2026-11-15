# Independent final scientific review

15 November 2026. Reviewed snapshot: `97dd985610cdceff0188cf52aabd2cd45b00bb4a`, branch `codex/final-science-review`, isolated worktree `/tmp/lunario-final-science-review/navigator`.

**The corrected scientific engines pass the reproduced, bounded comparisons. The verification register needs two P2 integrity/traceability corrections and one P3 documentation correction. No P0/P1 scientific discrepancy was found within this review's evidence. This is not mission qualification.**

Only this directory was authored. Production code, source fixtures, assets, tolerances and existing verification registers were read-only. No browser, app server, Simulator, Metro, build, generated offline app, push or merge. The starting HEAD equals the supplied base: this is a review of the integrated implementation, rather than a review of a new source diff. No workers were delegated.

## Actionable findings

### F01 — P2 — Compiler can publish verified results from stale inputs or explicitly failing receipts

**Failing verification gate**, at `scripts/compile-scientific-verification.py:14`, `:18`, `:19`, `:22`, `:29`.

The compiler reads previous comparison receipts, promotes S03/S10 unconditionally, then stamps the current model, dataset, current asset hashes and current time. It does not bind the ephemeris comparison's catalog hash to the catalog being published; it also does not enforce the terrain error limit or the missing-ray result before declaring those claims verified.

Two disposable-copy probes reproduce this without touching repository inputs:

1. Increase the first encoded Earth range from `361004.59375` to `361104.59375 km`, retaining all comparison receipts. Compiler exits 0, publishes the changed catalog's SHA256, and retains **41 verified / 21 uncertain / 0 failing**. The stored ephemeris comparison still identifies the original `e5a1528c…` catalog.
2. Restore the actual catalog, set the terrain receipt's error to `1 m` against its unchanged `0.0551 m` limit, and set the producer receipt to `fixed=false`, `unknownRayBecameFinite=true`. Compiler still exits 0 and marks both S03 and S10 verified.

Reproduce: `python3 docs/qa/final-science-review/probe-register.py`. Evidence: [register-freshness.json](register-freshness.json). A zero probe exit means the defect was reproduced; the JSON intentionally records `status: failing`.

**Action:** reject mismatched input hashes and missing/incorrect sample identities before publication; check every promoted receipt's actual finite errors/limits and unknown-policy outcome; bind source-code-sensitive receipts to the engine revision/hash that produced them. Retain the distinction between compilation and fresh execution. This needs a narrow integrity correction, not relaxed tolerances. The actual current receipts passed independent reproduction here; the probes do not establish corruption of the reviewed catalog.

### F02 — P2 — Current register retains baseline identities, residuals and obsolete reproduction outcomes

**Failing traceability**, at `docs/qa/scientific-audit/VERIFICATION.json:551`, `:571`, `:576`, `:595`, `:613`, `:616`, and `docs/qa/scientific-audit/VERIFICATION.md:24`. Identical JSON is embedded in `lib/generated/scientific-verification.json`. Compiler origin: `scripts/compile-scientific-verification.py:8` and `:16`.

E01/E02 claim the current committed catalog, but their per-claim input identity still names the old `00d28b6c…` catalog. E01's range residual is the old reversed-range same-direction value `15.520 m`; the corrected seven centre checkpoints give `15.100 m` maximum. E02 retains `0.0082226736°` rather than the corrected `0.0082169716°`. Their reproduction instructions still say the overall ephemeris audit should exit 1. S14 says 23 of 24 comparable asset hashes match and one fails; all 24 now match. Corrected E06/E07 also inherit the old per-claim input identity despite their new correction receipts.

These inconsistencies do not overturn the measured passes, but they prevent a reader from treating each current row as a self-consistent record of the corrected input. Archived baseline reports may remain unchanged; baseline facts inside a **current** row need an explicit historical designation.

**Action:** retain baseline identities/residuals under clearly named historical fields, populate current identities/errors from the corrected comparisons, update expected reproduction exits, and refresh S14's current inventory count. Regenerate both register copies together. [reference.json](reference.json), [production-check.json](production-check.json), and the current integration receipts provide the corrected measurements.

### F03 — P3 — Authoritative model documentation describes superseded identities/input conventions

**Failing documentation consistency**, at `docs/MODELS.md:3`, `docs/decisions/0005-planning-evidence-contract.md:15`, and `docs/decisions/0006-shared-planning-assessment.md:13`.

The current model introduction says `planning-4`; ADR 0006 says “currently planning-3”; ADR 0005 describes the old range path and says preparation does not explicitly request TIME_TYPE/APPARENT. Runtime correctly uses `planning-5`, and the corrected producer explicitly requests UT/AIRLESS and Earth 399 from Moon centre for quantity 20.

**Action:** add a dated planning-5 addendum and update current-tense descriptions, preserving the historical decisions and the unresolved original-source provenance. Scope the general `1e-9` requirement-comparison statement to the canonical assessment; analytical engineering screens retain their disclosed direct/open-boundary comparisons. No numerical tolerance change is requested.

## Reproduced results

| Status | Area and evidence | Result and precise scope |
|---|---|---|
| verified | Earth range input | All **17,521** hourly values reproduce the correctly directed archived observer request: Earth 399, Moon centre 500@301, quantity 20, UT/UTC, KM, AIRLESS. Every decoded float32 matches independent Python packing. Maximum encoding residual **15.62000002 m**; original 16 m encoding bound unchanged. |
| verified | Direction, site parallax, semidiameter | Independent Cartesian subtraction and ENU projection from decoded inputs, eight sites × two bodies × seven epochs = **112 rows**. Max direction separation **0.00821697161°** versus **0.020°**. The 56 Earth ranges have max residual **252.07539025 m** versus **5,000 m**. Earth semidiameter max residual **6.30964292e-7°** versus **0.0001°**. Production outputs match independent reconstruction within **1.14e-13°**. |
| verified | Event semantics | Recomputed four hourly setting brackets contain the cached direct five-minute observer brackets: equatorial Sun centre/upper limb and near-north-pole Earth centre/upper limb, June 2027. Zero-degree reference horizon only; no terrain-event or subhour guarantee. |
| verified | Registered terrain edge | Replay tests read original COG windows offline. Independent scalar interpolation and packed-grid decoding reproduce **14 supported stencils**, including the corrected final fine40 node: **0.0019691673 m** residual against unchanged **0.0551 m** encoding tolerance. Two unsupported source requests remain excluded. This is not millimetre physical surface accuracy or a full mosaic registration audit. |
| verified | Missing-ray producer | Actual AST-selected Python functions, synthetic 64×64 NaN-nodata DEM: missing north-ray support remains unknown at 0/2/10 m observer heights; all-known rays remain finite; valid coarse fallback agrees with all-known terrain. Captured TIFFs declare NaN nodata. This verifies the policy for this representation, not a complete TIFF/Numba pipeline run or missing-data prevalence in old masks. |
| verified | Power/RF and station reference arithmetic | Re-ran **288/288** resource comparisons plus independent two-interval energy accounting, two-second Wh conversion and linear-flux/aperture RF derivations at 2.3/8.4/32 GHz. Cycle: 80 Wh stored, 40 Wh later delivered, 60 Wh unmet, onset 1.4 h. Eleven primary resource responses hash-check. The 75 station rows compare archived Horizons against retained CSPICE results, not a newly run kernel computation. |
| verified | Contact root and dynamics | Both solvers reproduce the exact central-force 100 m radial drop onto flat/reference surfaces. Legacy errors: time **+5.71e-11 s**, speed **+9.63e-11 m/s**, energy **+8.16e-6 J**, versus unchanged **1e-6 s / 1e-7 m/s / 0.01 J**. Re-ran isolated baseline/current dynamics and step diagnostics; checked 12 primary response hashes. This does not qualify arbitrary terrain, feedback guidance, structural contact or touchdown. |
| verified | Model/dataset and evidence identity | `planning-5` is consistent in runtime, register and four demo assessments; current register asset hashes match files; all 24 registered asset hashes match. All four demo keys/outcomes reproduce through `evaluateScenario`; changing dataset invalidates scope, and a synthetic old planning-4 report stays unassessed. This verifies identity enforcement, not the evidence behind an external report. |

The new scalar/vector reconstruction is in [reproduce.py](reproduce.py); production comparisons and current event/identity checks are in [check-production.mts](check-production.mts). Existing source replay uses the same GeoTIFF decoder as preparation; it is a transfer check, not an independent decoding implementation. Existing resource and dynamics audit scripts were rerun, not relabelled as newly authored independent reference solvers.

## Does 41 verified / 21 uncertain / 0 failing overclaim?

The **arithmetic count of the 62 recorded claims is correct**. Their explicit implementation-only scope and “no operational qualification” notice are appropriate. The six previously failing corrections reproduce at the reviewed snapshot, without widening any tolerance. No failing scientific comparison was found in the focused current-input checks.

The headline is defensible only as a historical summary of those bounded comparisons. It is **not a self-enforcing scientific gate** (F01), and current per-row provenance needs repair (F02). It must not be presented as “all science verified,” a quantified physical accuracy statement, or evidence that the 21 unresolved applicability claims are acceptable risks. This review does not reclassify all 62 claims or add its own check counts to that register.

| Status | Remaining limits |
|---|---|
| uncertain | Independent observed lunar astrometry; propagated DE421 ME versus catalog apparent-frame/height registration; real site height versus the reference-sphere parallax model. Same JPL ephemeris through different mathematics checks implementation, not independent observation. |
| uncertain | Full original 40/240 m horizon DEMs and regeneration are unavailable here; complete physical skyline accuracy, effective resolution/error, unsampled ridges and old-mask nodata effects remain unresolved. All-current-byte hash identity does not establish upstream raw identity or physical accuracy. |
| uncertain | Hourly held forcing and four settings cannot qualify arbitrary event timing, multiple/tangent crossings, future leap seconds or EOP extrapolation. Solar range remains absent as a separate catalog series; fixed irradiance is an assumption. |
| uncertain | Actual photovoltaic/battery/environment performance, vehicle constraints and margins, station-ray lunar occlusion, dated station motion/weather/noise/coding, antenna acquisition and booked support. Earth-centre clearance and a positive assumed RF budget do not supply them. |
| uncertain | Guided flight self-convergence, rigid proxies, terrain footprint hazards, soil/plume/landing-gear dynamics and real thermal survival. An exact radial benchmark does not establish these. |

## Commands and retained evidence

Run from `navigator/`:

```bash
npx tsx --test tests/audit*.test.ts
npx tsx --test tests/assessment.test.ts tests/external-assessments.test.ts tests/decision-export.test.ts tests/planning-demo.test.ts tests/engineering-evidence.test.ts tests/mission-events.test.ts
python3 docs/qa/final-science-review/reproduce.py
npx tsx docs/qa/final-science-review/check-production.mts
npx tsx scripts/audit-resources-compare.ts
npx tsx scripts/audit-dynamics.ts docs/qa/final-science-review/dynamics-reproduction.json
python3 scripts/audit-dynamics-fetch.py --check
python3 docs/qa/final-science-review/probe-register.py
npm run typecheck -- --incremental false
```

Required focused suite: **345 passed, 0 failed/skipped/cancelled** ([TAP](focused-tests.tap)). Additional identity/contact/evidence suite: **59 passed, 0 failed/skipped/cancelled** ([TAP](identity-contact-tests.tap)). Nonincremental typecheck exits 0. Python 3.14.4, NumPy 2.5.0 and Node 20.20.2 were already installed; no installation or uv environment was needed. This run does not verify the pinned Python audit environment or production TIFF/Numba dependencies. The full npm suite and lint were not run for this report-only review.

Numerical source responses were **replayed from the cached primary evidence**; no new numeric Horizons queries, station forecast, DEM download or CSPICE run is claimed. Original instructions, audit contracts, four lane reports, before/after integration receipts, model docs and ADRs 0005/0006 were inspected. Primary definitions were also read at [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), [JPL DE440 parameters](https://ssd.jpl.nasa.gov/astro_par.html), and [NASA PGDA](https://pgda.gsfc.nasa.gov/products/90). Resource details come from the cached JPL 810-005 301P/105E and separately identified ITU-R P.525-5 material; source identity is retained in the original lane manifests. No earlier verification count is treated as permanent evidence.
