# Independent scientific review — refinement

**Current disposition, 14 November 2026: S1–S3 resolved and verified in the transferred implementation lane.** Review 36/36, focused 116/116, full 719/719; types, lint and fresh 75-sample live reference check PASS. The original RED report below is preserved as historical evidence; the resolution section at the end supersedes its open-fix status. This is a source-level scientific regression handoff, not final-artifact, human or operational acceptance.

14 November 2026. Verifier worktree `refine-science-review`, branch `codex/refine-science-review`. Reviewed implementation source **a45f5e56c8596cfc74a685d4fc649846c437d571**, whose only change after checkpoint270ad99 is the verifier ownership contract. Report-only lane: only this report and `tests/refinement-scientific-review.test.ts` authored. No implementation, dependency, production fixture, catalog or generated HTML changes.

**Result: RED — three concrete defects remain.** Root owns corrections. Findings were published immediately to `/tmp/refine-science-review-findings.txt`; initial red history remains there. This is neither release readiness nor human/operational acceptance.

## Reproduced defects

| ID | Severity | Location | Reproduction and proof | Required correction |
| --- | --- | --- | --- | --- |
| S1 | P1 | `lib/engineering-evidence/horizons.ts:36–53` | Change only the committed Goldstone response's `Date_________JDUT` to `Date_________JDTDB`, or either apparent AZ/EL column label to geometric. Each altered source is accepted and relabelled UTC / airless apparent. All three separate adversarial tests fail with “Missing expected exception.” Hourly numeric spacing alone cannot establish the raw time scale or column meaning. | Validate the actual time-scale and apparent AZ/EL header semantics before assigning UTC/frame identity. Preserve rejection of mismatched station, units, epochs and target. |
| S2 | P2 | `lib/engineering-evidence/communications.ts:79–81` | Keep Goldstone station/raw bytes/samples, replace `geometry.requestUrl` with the production-generated Madrid URL. Evaluation still returns `conditional-meets` and1,800,000 bits. The archived bytes are reparsed, but the contradictory imported request identity is ignored. Regression fails with “Missing expected exception.” This is provenance inconsistency, not a claim that imported text can be authenticated. | Validate the declared request source/settings against station, epochs and source convention before using/exporting the envelope. |
| S3 | P1 | `lib/replanning/scan.ts:56–66` | Evaluate two identical real scenarios except `mission.reserveSoc =0` versus `.95`. Both receive cohort `planning-4-f0b6a8d1-7196481f-521`; the stricter case is dominated solely because its reserve requirement changed. The cohort only hashes `state.requirements`, omitting the effective reserve requirement in mission inputs. Regression fails on cohort inequality. | Bind ranking cohorts to effective constraint meaning/limits, including embedded requirements, so relaxing a requirement cannot appear to improve an otherwise comparable mission. Check other embedded cutoff/requirement meanings. |

These are adversarial imported inputs and real local model evaluations, not observed provider errors. No uncertainty magnitude, live station allocation or operational success is inferred.

## Primary references and fresh checks

- [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), Time and observer quantities: UT after1962 means UTC; the raw time convention and apparent column meaning matter. Freshly opened and checked, not inferred from a requested URL.
- [JPL810-005/301O](https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301O.pdf), Table5, printed page16: independently transcribed DSS-14/63/43 DMS coordinates and altitude; the regression checks all three request coordinates including metres→kilometres.
- [JPL810-005/105E](https://deepspace.jpl.nasa.gov/dsndocs/810-005/105/105E.pdf), §2.1.5, printed pages14–15: checked published32GHz/20° atmospheric example and the separate-attenuation/vacuum-gain convention. These are explanatory source arithmetic, not present or future weather.
- [NAIF lunar frame kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf): inspected `MOON_ME_DE440_ME421` fixed relative to `MOON_PA_DE440`. The fresh frame gate also fetched Horizons manual conventions. This does not authenticate original catalog response headers or close propagated terrain/frame/event errors.

Fresh command `node_modules/.bin/tsx scripts/verify-engineering-evidence.mts --live --frame` **PASS**,75 actual re-queried station/epoch samples, no fixture writes. Maximum absolute residuals against the committed independent CSPICE reference:

| Quantity | Measured maximum residual |
| --- | --- |
| Azimuth |0.0002686886904257335° |
| Elevation |0.00007336623912124196° |
| Range |0.00324417429510504km |

Log: `/tmp/refine-science-live-reference.log`. These are comparison residuals, not physical accuracy or uncertainty bounds. The live request success is the Node verifier result, not a browser provider success.

Fresh `/tmp/solarreach-engineering-venv/bin/python public/data/engineering-evidence/reproduce-reference.py --check` **PASS**,75 CSPICE samples, maximum regenerated angular residual0°. An additional non-writing `runpy` check compared all regenerated station/UTC identities, ranges and all four kernel hashes against the committed reference: exact identity/hash match and maximum range residual0km. Logs: `/tmp/refine-science-spice-reference.log` and `/tmp/refine-science-spice-independent.log`. The venv already existed; no packages were installed. CSPICE uses the committed independent script, not application formulas.

Measured SHA-256 identities of unmodified reference files:

| File in `public/data/engineering-evidence/` | SHA-256 |
| --- | --- |
| `goldstone-horizons.json` | `dc1cfe438067448ba89b9515ba3678cf5b421caef6735a6cabf6cc0f9b65a200` |
| `madrid-horizons.json` | `32c57ad26bfac6d34d15a372de02381a6cd34a8db348fe48f31ea6beb858c53c` |
| `canberra-horizons.json` | `36300598255984a575a989f0a970f952b9cff1c877b5e93312094a7493cd99bb` |
| `spice-reference.json` | `8ce06e103b8c07e9bcf4e046a0a1a9aaba3dcd44b41243de11e8c18cb98169aa` |
| `jpl-105-example.json` | `365664e44531c58b18905c777d85b552d692a337e3b6b32142b6e137784da6be` |

## Regression coverage and gates

Owned suite:19 tests. Final focused run: **14 pass,5 fail,0 skipped/cancelled**. Five failed tests represent the three defects: three raw header variants, one request-identity variant, one requirement-cohort case. Command: `node_modules/.bin/tsx --test tests/refinement-scientific-review.test.ts`; log `/tmp/refine-science-focused-final.log`. The earlier17-test version grouped the three raw headers as one test:14 passed/3 failed. Separating those headers exposed all three independently; it did not change production data or weaken assertions.

The14 passing tests verify:

- All three station coordinates/request altitude units; exact archived response byte preservation across export/import; rejection of altered computed geometry.
- SI free-space loss/received power/Eb/N₀ arithmetic independently expressed in metres, Hz, watts and Boltzmann units; rate/frequency/noise logarithmic scaling; rate-limited bits and explicit `operationalApproval:false`.
- Full lunar lower-limb equality rejection, skyline wrap at north and near-zenith footprint. Existing engineering tests additionally cover an adjacent narrow ridge, negative cutoffs, missing/zero/partial allocation, band/frequency mismatch, missing evidence and source coverage endpoints.
- Critical-window intersection with dated rate changes and zero allocation, with600 modeled contact seconds falling short of601 despite sufficient aggregate bits. Removing the zero-rate coverage creates an unknown rather than a success. Observed weather crossing its issue instant cannot forecast the remaining half-hour; only900,000 known bits are retained in the explicitly split fixture.
- Earth-centre proxy requires explicit user-assumption provenance; changed scenario binding blocks delivered capacity.
- Finite lower/nominal/upper cases retain exact evaluator identities, requirements and operations, and explicitly deny continuous/probabilistic bounds.
- An explicitly synthetic overhead-Sun fixture independently checks `∂P/∂G =7×.2×.7×cos(37°)×.25 m²` with zero present irradiance, fixed orientation, losses and75% deployment delay in its first hour. Terrain unknown stays unknown while smooth-sphere output remains separate. This fixture is test-only, not a measured lunar result.
- Custom lunar coordinates, hardware and date-shift inputs remain intact; a named alternative clears the custom coordinate. Non-hourly elapsed alignment retains the exact four-hour UTC separation. Missing terrain, broader readiness requirements and unsupported dates stay unranked.

Full `npm test` was run once after the17-test authored version: **700 total,697 pass,3 fail,0 skipped/cancelled**, all failures the new adversarial defects. Log `/tmp/refine-science-full-first.log`. The final two additional separately named header tests were exercised in the final focused run; no repeated full run while known blockers remained. No failure is dismissed as pre-existing. Existing production behavior is unchanged in this lane.

`npm run typecheck -- --incremental false` **PASS**; `npm run lint` **PASS**; `git diff --check` **PASS**. Logs `/tmp/refine-science-types.log`, `/tmp/refine-science-lint.log`. Existing slop-scan triage was read; no `slop-scan` executable is available, so no fresh scan is claimed.

## Remaining verification and qualification

`/tmp/refinement-qa-instructions.txt` was read before runs and final handoff. No final artifact marker was present during this review. **No browser or web/offline artifact checks were performed**, no HTTP/file artifact hash was substituted, and stale R7 was not tested as the refinement. Browser console/page errors and offline zero-HTTP evidence belong to the final-artifact browser lanes; this report makes no claim about them.

Root must fix S1–S3 and rerun this unchanged adversarial suite, full tests/types/lint and fresh affected reference checks on the updated identity before green handoff. The final web/offline workflow evidence remains separately required before merge.

Original catalog response/time/EOP provenance, propagated terrain/frame/event uncertainty, fine terrain and landing hazards, station-specific lunar masks, antenna dynamics/acquisition, actual RF/noise/weather/allocation evidence and qualified mission assessment remain outside the demonstrated results. Hourly left-held geometry is not a subhour event guarantee; whole-disk/range conservatism is spatial only. Declared finite samples are not continuous enclosures. Human audience, actual screen-reader and operational acceptance are unperformed.


## S1–S3 resolution — exclusive ownership transfer, 14 November 2026

After the RED commit `4dde95f25eaad664f852a9010be931e7ea0c9b3d`, Root transferred exclusive ownership under Luke's authorized parallel task of `lib/engineering-evidence/horizons.ts`, `lib/engineering-evidence/communications.ts` and `lib/replanning/scan.ts` to this same worker/worktree/branch. Only these three implementation files, the owned scientific-review test and this report change. No child agents, pushes/merges, dependency/build/server changes, fixture writes, catalog changes or generated artifact changes. Source base remains `a45f5e56c8596cfc74a685d4fc649846c437d571`; implementation fixes are a separate commit after the preserved RED review commit.

Fresh baseline reproduction before implementation: 19 tests, 14 passed / 5 failed / 0 skipped. Log `/tmp/refine-science-before.tap`. The original 19 test bodies remain byte-for-byte identical, verified against the RED commit; their combined source SHA-256 is `19ddee419c886dad3c6894ba31b3cdc9a4318562c925d73f91c73f4433258043`. Imports were extended and 17 tests appended. No prior assertions were removed or relaxed.

| ID | Implemented resolution | Additional regression evidence |
| --- | --- | --- |
| S1 | Require one complete observer table and validate its actual immediately preceding CSV columns, in order: JDUT, the two presence flags, airless-apparent azimuth/elevation, range and range rate. Validate preamble UT endpoints, JD/degree formats, airless setting, Earth frame, target and station. Preserve kilometre/epoch checks; reject empty numeric cells, malformed coordinates and ambiguous table boundaries. Pre-1962 UT cannot be labelled UTC. No geometry formula changes. | Original three independent changed-label tests now pass. Additional cases cover TT, refracted/reordered columns, incompatible time/angle metadata, valid decoy headers in the footer, duplicate markers, empty numeric cells, malformed geodetic numbers and the UT1/UTC date boundary. The fresh three-station live parser/reference check passes. |
| S2 | Validate the declared request URL before communications evaluation, independently of raw-response parsing: exact HTTPS JPL endpoint, no credentials/fragment; complete supported settings with no duplicate/extra keys; station coordinates; start/stop epochs; target/observer/coordinate system; hourly steps; quantities; UTC/JD/degree/airless/km and precision/output controls. URL parameter order, encoding, optional enclosing quotes and equivalent `.000` UTC spelling remain acceptable. | Existing Goldstone-bytes/Madrid-request case now throws. Each of all 20 emitted request settings is independently changed, removed and duplicated through the real export/import roundtrip, then rejected by evaluation. Additional endpoint/control/override cases reject; equivalent encoding/order/time spelling still delivers the original 1,800,000 modeled bits. Structural import/export remains a lossless archive operation, not source authentication or a capacity assessment; evaluation is the source-consistency gate. |
| S3 | Cohorts include required evaluator constraint IDs, relations, units, effective limits and evidence IDs. Reserve objective identity includes both reserve fraction and effective Wh even when reserve is optional. Antenna elevation cutoff fixes the meaning of blackout/contact; a required radio screen includes its embedded required Eb/N₀. Required analytical screens bind their complete supplied input records because their generic evidence constraints expose no scalar limit. This conservative engineering grouping also prevents comparing changed measurement assumptions as the same evidence case. | Original reserve-SOC case now separates cohorts without cross-dominance. New real-evaluator tests vary battery capacity/reserve Wh, disabled reserve requirement, antenna cutoff, radio demodulation threshold and a representative embedded limit in each of all seven required engineering screens. Both analytical cases remain conditional and rankable before their cohort inequality is checked. Required relation/unit/limit mutations also separate cohorts. Existing same-requirement load tradeoff, ties, date/site scans and unknown-evidence tests remain green. |

The exact numerical `planning-4` evaluator, `lib/assessment.ts`, `lib/mission.ts`, `lib/planning-types.ts`, `lib/astro.ts`, `pipeline/build_dataset.py` and `public/data/catalog.json` are unchanged from the source base, verified by Git blob identity. No model-version increment: these changes reject contradictory supplementary provenance and constrain supplementary Pareto comparisons; they do not change canonical assessment values, constraints or scenario identities. The current [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), observer quantity 4 and time-scale documentation, was freshly read for these semantics.

### Final commands and measured results

All commands ran in this worktree on branch `codex/refine-science-review`. `/tmp/refinement-qa-instructions.txt` was reread before checks and commit. Final exact counts:

| Command | Result | Log |
| --- | --- | --- |
| `node_modules/.bin/tsx --test tests/refinement-scientific-review.test.ts` | 36/36 PASS, including all original 19 unchanged tests; 0 failed/skipped/cancelled | `/tmp/refine-science-fixes-review.log` |
| `node_modules/.bin/tsx --test tests/engineering-evidence.test.ts tests/engineering-context.test.ts tests/engineering-screens.test.ts tests/replanning-workspace.test.ts tests/refinement-scientific-review.test.ts` | 116/116 PASS; 0 failed/skipped/cancelled | `/tmp/refine-science-fixes-focused.log` |
| `npm test` | 719/719 PASS; 0 failed/skipped/cancelled | `/tmp/refine-science-fixes-full.log` |
| `npm run typecheck -- --incremental false` | PASS | `/tmp/refine-science-fixes-types.log` |
| `npm run lint` | PASS | `/tmp/refine-science-fixes-lint.log` |
| `node_modules/.bin/tsx scripts/verify-engineering-evidence.mts --live --frame` | PASS: 75 freshly re-queried station/epoch samples; current JPL/NAIF convention gate passes | `/tmp/refine-science-fixes-live-reference.log` |
| `git diff --check` and staged equivalent | PASS | final handoff report |

The live maximum residuals are AZ **0.0002686886904257335°**, EL **0.00007336623912124196°**, range **0.00324417429510504 km**, against the committed independent CSPICE producer and recorded four kernel hashes. No reference fixture was written; the original reference SHA-256 identities above remain unchanged. These are source comparisons, not physical uncertainty bounds. The earlier fresh CSPICE regeneration is preserved above; this fix reran the affected live checker, not a new independent kernel-production pipeline.

During added-test development, one new antenna fixture used an unsupported negative cutoff; it was corrected to the supported 0°/10° pair. Typecheck also identified an invalid test assertion overload; corrected to the typed Error predicate. Final commands above ran after these corrections. Neither issue changed the original 19 tests or canonical model.

Existing slop-scan triage was read; executable unavailable, so no fresh scan claimed. Browser/final immutable artifact checks remain Root's separate lanes. No final artifact marker, stale R7 checks, app server, Simulator, Metro, build or human/operational acceptance was substituted for these source checks. Original source-time/EOP and propagated terrain/frame/event uncertainty gates remain open exactly as recorded in the initial review.

Handoff artifacts: `/tmp/refine-science-fixed.bundle` contains both the RED review and separate implementation-fix commit since the specified base. `/tmp/refine-science-fixes-result.txt` records final commit/source identities, exact commands/results, bundle identity and integration limits.
