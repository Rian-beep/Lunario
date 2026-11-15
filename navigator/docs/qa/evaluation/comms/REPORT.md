# Station communications evaluation

15 November 2026. Lane `comms`, branch `codex/eval-comms`, base `3c82b5aa02c4da52053fd3c12c180cca18fd6d4e`. Evaluated source: **`b8c166f67ec7e49198ecc16f552f6e5276640cc7`**. The subsequent documentation commit packages this evidence; it changes no numerical source. No pushes, merges, server, shared browser profile, generated applications, packages, scientific bindings or shared-vault edits.

**Bounded fixes delivered; publication and operational qualification remain open.** New regressions reproduce **9 failures / 1 pass at the exact base**, then **10/10 pass** after repair. Final focused suite: **371 passed, 0 failed, 0 skipped, 0 cancelled**. Nonincremental typecheck passes. Full lint fails with the **same one error** reproduced in an isolated base checkout. The publication-binding gate correctly fails against changed audited source. Fresh three-station comparison is **incomplete**: Goldstone and Canberra pass 50 samples; Madrid returns HTTP 503 on two bounded attempts.

## What changed

1. `fix(comms): reject off-grid and unsupported station evidence` (`67740a5`): provider Julian dates must agree with the whole-second grid within **1 ms** before hourly coverage is checked. Previously a 0.25 s shifted row was rounded onto the correct hour. CSV numeric fields now accept decimal/exponent notation rather than JavaScript hexadecimal coercion. The 1 ms allowance covers JD serialization/arithmetic, **not physical timing uncertainty**.
2. Strict envelope import now validates its request URL and reproduces computed geometry from archived source bytes immediately. Previously a tampered elevation was accepted by import and rejected only when evaluated. Object imports use UTF-8 byte length, matching file imports; a one-million-character `é` response previously bypassed the two-megabyte object limit. Existing parsing exports are re-exported unchanged from `import.ts`; `validation.ts` prevents a parser/provider import cycle. Declared-uncertainty exports and behavior remain intact.
3. Future-issued station horizon, lunar mask, radio hardware and allocations now make capacity unknown, consistently with existing geometry/weather chronology checks. They previously allowed the synthetic chain to claim `conditional-meets` and 1,800,000 modeled bits. Future *mission epochs* are still allowed when supported; old retrieval age alone has no invented expiry threshold.
4. Archived Horizons headers expose ephemeris and EOP file/version and data/prediction dates. Missing, malformed or out-of-coverage EOP makes capacity unknown. Coverage uses explicitly conservative **midnight boundaries** on the advertised dates; an interval may end at the prediction boundary but cannot extend beyond it. This may censor part of the final advertised day. Predicted EOP inside coverage remains usable conditionally and is identified. No frame transformation, coordinates, station velocity, RF or atmospheric formula changed.
5. `feat(comms): summarize station evidence and critical windows` (`b8c166f`): pure `summarizeStationEvidence` and a collapsed `StationEvidenceSummary` component expose missing/invalid/stale/partial/unknown/supplied/assumption states, exact critical-window requirements and conditional results, and concrete next actions. The summary distinguishes Earth-centre proxy from a declared station ray, lunar mask from Earth-station horizon, supplied RF rate from compatible hardware/acquisition, weather assumptions from forecasts/observations, and rate intervals from authenticated booking. Actual support remains unknown even for positive modeled capacity.

These change **supplementary communications screening meaning and import acceptance**. Parent must review model/version implications and refresh numerical receipts/bindings independently. `evaluateScenario` remains the sole overall mission authority. Positive scalar link margin, whole-disk station clearance, Earth-centre visibility and this component cannot confer an overall pass.

## Reproduction and exact checks

Run from `navigator/`; commands write only lane evidence or `/tmp`. The current Node runtime is `v20.20.2`. Detailed stdout/stderr is retained in the linked files.

| Command | Fresh outcome | Evidence |
| --- | --- | --- |
| `node_modules/.bin/tsx --test tests/comms-evaluation/regressions.test.ts` at isolated base | exit 1; **10 tests, 1 pass, 9 fail**, 0 skipped/cancelled | `before-regressions.txt` |
| Same command at delivery | exit 0; **10/10 pass**, 0 skipped/cancelled | `after-regressions.txt` |
| `node_modules/.bin/tsx --test tests/comms-evaluation/*.test.ts tests/engineering-evidence.test.ts tests/dsn.test.ts tests/station-weather.test.ts tests/audit-resources.test.ts` | exit 0; **371/371 pass**, 0 skipped/cancelled | `focused-tests.txt` |
| `npm run typecheck -- --incremental false` | exit 0; no TypeScript diagnostics | `typecheck.txt` |
| `npm run lint` | exit 1; **1 error, 0 warnings**, `components/workbench/scene/lunar-terrain.js:1:1`, `@typescript-eslint/ban-ts-comment` | `lint.txt` |
| Same `npm run lint` at exact base, separate `/tmp/lunario-eval-comms-baseline-qa/navigator` checkout | exit 1; **identical 1 error, 0 warnings** | `base-lint.txt` |
| `node_modules/.bin/eslint lib/engineering-evidence components/comms-evaluation tests/comms-evaluation` | exit 0; no diagnostics | `owned-lint.txt` |
| `python3 scripts/compile-scientific-verification.py --check` | exit 1; **Stale scientific evidence: lib/engineering-evidence/communications.ts** | `publication-binding.txt` |
| `node_modules/.bin/tsx tests/comms-evaluation/compare-sources.mts` | exit 0; **75 samples / 225 components pass** vs retained CSPICE reference | `archived-source-comparison.json`, `.txt`, `sources/*-archived.json` |
| Same source command with `--live` | exit 1; **50 samples / 150 components pass**, Madrid unavailable, **not a 75-sample pass** | `live-source-comparison.json`, `.txt`, `sources/*-live.json` |
| `node_modules/.bin/tsx tests/comms-evaluation/render-fixture.tsx` followed by `node tests/comms-evaluation/preview.browser.mjs` | exit 0; **4/4 isolated layout/disclosure cases**, 0 page errors, 0 HTTP requests | `component-fixture.json`, `component-browser.json`, `.txt`, two PNGs |

Base reproduction: `git worktree add --detach /tmp/lunario-eval-comms-baseline-qa 3c82b5a`; link the existing dependencies as `navigator/node_modules`, copy only `tests/comms-evaluation/{fixtures.ts,regressions.test.ts}`, then run the same regression command. No base production source was changed. The separate UTF-8 probe is recorded in `utf8-before.txt` (`accepted`) and `utf8-after.txt` (`Evidence object exceeds limit`); the assertion is in `summary.test.ts`.

Archived and available fresh maximum residuals are **0.0002686886904257335° azimuth**, **0.00007336623912124196° elevation**, **0.00324417429510504 km range**, within unchanged acceptance limits 0.002° / 0.002° / 0.1 km. No accepted station values changed; before→after numerical residual improvement is zero. The repairs reject malformed/unsupported evidence instead. Retained CSPICE DE440s LT+S/ITRF93 results are a different computation of JPL ephemerides, **not independent physical observation**. Kernel bytes were not regenerated. Fresh successful response bytes, request URLs, retrieval dates, source hashes and metadata are retained; a fresh HTTP request does not establish a newly generated provider ephemeris or a newer EOP release.

Two Madrid requests returned HTTP 503, so no third attempt or invented live result is supplied. The first comparison harness initially needed `.mts` for top-level await; that setup failure performed no comparison and is excluded from counts. The second harness explicitly records partial results/errors rather than printing an encoded-source stack. `slop-scan` is not installed/configured; manual review and the available ESLint checks were used.

Authored-source whitespace checks pass. A complete staged whitespace check flags blank lines/spaces emitted by TAP and npm in `before-regressions.txt`, `base-lint.txt`, `lint.txt` and `typecheck.txt`; these captured command outputs are retained verbatim rather than rewritten to make that check green.

## Parent integration contract and required fixes

Mount this optional component **inside the existing `components/engineering/evidence-workspace.tsx` communications section**, beside its existing conditional result/critical-window controls. Keep its default disclosure collapsed. No map overlay, new navigation or independent assessment binding is needed:

```tsx
import { StationEvidenceSummary } from '../comms-evaluation/evidence-summary';

<StationEvidenceSummary
  envelope={envelope}
  scenarioKey={assessment.scenarioKey}
  stay={stay}
  nowUtc={new Date().toISOString()}
/>
```

`stay` is the existing half-open mission span; `nowUtc` is source-chronology wall clock, **not the playhead**. The pure summary accepts `unknown` for strict import/error presentation. It makes no request, edits no scenario and exports no assessment. The component renders provenance as escaped text without activating arbitrary imported URLs. Source metadata exposes antenna coordinates/WGS84 height, fixed 2003.0 coordinate reference, sample coverage, retrieval age, ephemeris/EOP identity and UTC/degree/km units. Refresh is manual; no polling or persistent cache is added. Schema 1 does **not** retain an API signature version or a separate supplied-document version field; both limitations are explicit rather than guessed.

Required parent work:

- Independently rerun source comparisons, including unavailable Madrid, review the new EOP boundary/chronology meaning, decide the model identity change, and refresh reviewed receipt bindings. Existing bindings cover the three changed audited files; **add `lib/engineering-evidence/validation.ts` to the transitive numerical binding inputs**. Do not merely refresh hashes to silence the failing gate.
- Wire the component and inspect the actual inspector at release sizes/themes. The isolated file fixture used existing baseline offline styles, Chromium **149.0.7827.155**, widths 390/800 and both actual `data-ui-theme` values. Default collapse, keyboard opening, critical disclosure and horizontal reflow passed; screenshots were inspected. This does not test full-app interactions, native 200% zoom, actual touch hardware, contrast or screen-reader use, and is not user acceptance.
- Resolve the reproduced parent-owned `lunar-terrain.js` lint error. This lane did not edit or suppress it.
- Correct raw observer-file import metadata in `components/engineering/evidence-workspace.tsx`: its handler currently passes the import clock as `fetchedUtc`. Preserve a documented original retrieval timestamp when available; otherwise label source retrieval unknown and distinguish import time. Do not make an old file appear newly fetched. The preserved EOP header is still exposed, which limits this risk but does not fix the label. Retain/validate API signature metadata in a backward-compatible adapter evolution if it is needed, rather than pretending schema 1 carries it.

## Evidence still required

No mission-specific station booking, service allocation authentication, flight-radio/feed/polarization/coding compatibility, acquisition/lock/overhead, station-specific lunar ray qualification, real antenna skyline, propagated station coordinates/EOP accuracy, or station/band-specific mission weather attenuation was supplied. Generic rate intervals remain conditional declarations. A named DSN complex or 70 m antenna does not prove every frequency/feed is supported. Hourly left-held geometry can miss contact loss within an hour; full-disk spatial clearance is not a continuous temporal bound. Critical windows now expose that limit next to their modeled seconds and bits. Outside applicable weather coverage loss remains unknown; no cloud-to-dB or current-observation-to-future-forecast substitution was added.

The independent resources audit (`docs/qa/scientific-audit/resources/REPORT.md`) was read and its earlier bounded arithmetic/reference results preserved. Its successful tests did not cover the newly demonstrated parser/chronology/EOP cases and did not qualify physical service. Atmospheric functions were reviewed and left unchanged; their supplied-zenith-loss approximation and emission-noise example continue to pass existing checks.

Primary sources checked in this evaluation:

- [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), especially High Precision Earth Orientation Parameter Model: beyond the EOP prediction interval it holds the last predicted values constant. Source precision is not physical accuracy.
- [Horizons API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html), current documented API version 1.3: response signature version must be checked when interpreting formats; archived raw-result-only imports cannot recover it.
- [NAIF `spkcpo`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkcpo_c.html): observer epoch/frame evaluation and aberration conventions explain the retained CSPICE reference scope.
- [DSN 810-005 index](https://deepspace.jpl.nasa.gov/dsndocs/810-005/), [301P Coverage and Geometry](https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf), [101I 70-m interfaces](https://deepspace.jpl.nasa.gov/dsndocs/810-005/101/101I.pdf), [105E atmosphere/environment](https://deepspace.jpl.nasa.gov/dsndocs/810-005/105/105E.pdf): geometry, hardware interfaces and environmental loss are separate evidence. Existing 301O station coordinates were preserved.
- [ITU-R P.525-5](https://www.itu.int/dms_pubrec/itu-r/rec/p/R-REC-P.525-5-202411-I!!PDF-E.pdf) and [P.838-3](https://www.itu.int/rec/R-REC-P.838-3-200503-I/en): free-space attenuation and frequency/polarization-dependent rain attenuation require distinct inputs. Neither supplies a mission weather forecast or station commitment.

Parent owns shared memory; this report/findings pair is the durable handoff. No shared-vault update or indexing is claimed.
