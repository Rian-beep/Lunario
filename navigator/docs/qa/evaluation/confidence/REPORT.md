# Selected-scenario evidence and confidence evaluation

15 November 2026. Baseline: `3c82b5aa02c4da52053fd3c12c180cca18fd6d4e`. Implementation and tested source: **`f6c3726f86ffd4364d8f30e0a5afe419c508e4b0`**, branch `codex/eval-confidence`, isolated Clevo worktree `/tmp/lunario-eval-confidence/navigator`.

Delivered a scenario-specific evidence summary, compact audience-aware component, reproducible export and regression checks. **Parent wiring remains required. No existing application UI was changed.** No calibrated physical error inputs were found in the supported scenario/evidence schemas, so the summary returns `calibratedPhysicalUncertainty: 'not-supplied'` and `physicalOutcomeInterval: null`. It does not introduce confidence scores, probability distributions, continuous uncertainty intervals or mission authority.

## Evidence and observed gaps

Read the locked evaluation contract, AGENTS, `docs/MODELS.md`, ADRs 0005/0006, the current scientific verification register, source/terrain report, independent final scientific review and its resolution, existing evidence/finite-case workspace, canonical assessment/context and terrain metadata. The independent review's publication/provenance findings were subsequently resolved; its remaining physical applicability limits remain relevant. The current **41 verified bounded claims / 21 uncertain / 0 failing recorded comparisons** describe scoped implementation/input checks, not a confidence estimate for the selected stay.

Current primary references consulted on 15 November:

- [NASA PGDA product 90](https://pgda.gsfc.nasa.gov/products/90): terrain heights, spacing, effective-resolution/error products and DE421 MOON_ME are distinct metadata/evidence. No error/count/effective-resolution raster was downloaded or ingested in this lane.
- [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html): source observing/frame conventions require explicit scope; a reference-table comparison does not independently observe the lunar skyline.
- [BIPM JCGM 100:2008](https://www.bipm.org/documents/20126/2071204/JCGM_100_2008_E.pdf): uncertainty needs an applicable measurement/input model. The existing endpoint cases do not supply one.

The old workspace already correctly warns that declared endpoint cases are neither probability nor continuous enclosure. No false claim of calibrated physical uncertainty was reproduced there. The gaps addressed are useful consolidation for the actual selection and a self-contained account of held inputs in the new evidence export.

`before-after.json` reproduces the export gap using the actual committed catalog at Connecting Ridge, −89.53432°, 209.94767°E, 2026-01-01 00:00–04:00 UTC exclusive, array 2 m, antenna 10 m. Loads/bounds and the added schedule are explicitly synthetic test assumptions. The existing `StabilityResult` export has requirements, operations and case deltas but **no full nominal scenario, explicit dataset ID or explicit model version**. A key cannot reconstruct irradiance, orientation, capacity, other unvaried values or the catalog. Its module SHA256 is unchanged from the isolated nominated base: `0764868470817cd197c4cd2811818ea00952e824a81d7c90af054a9ef1a3634b`.

The new export retains all accepted nominal scenario fields, exact operations/requirements, location and independent heights, selected source declarations/notes, model/dataset identity, canonical metrics/outcome and validated finite cases. The synthetic example replays to the identical canonical key, `planning-5-74f60ca8-8bcd0312-1179`. Compact JSON is 17,376 bytes, of which 1,042 bytes are nominal scenario inputs. No catalog, secret, raw provider table or generated application is embedded. Original finite exports remain unchanged.

## Implementation and boundaries

`lib/evidence-confidence/index.ts::evaluateEvidenceConfidence` parses the actual scenario and calls **`evaluateScenario`**, then reuses `resolveAnalysisContext` for the resolved horizon placement/coverage. It returns the canonical outcome unchanged. It never substitutes image detail, a generic trajectory, an RF screen, a finite result or a report for mission authority.

The summary identifies:

- Provider/reference comparisons versus physical validation; storage precision versus effective resolution/error.
- Named, unavailable, coarse-at-point and borrowed horizons separately for each instrument. Borrowing includes the actual cell/distance; no safe distance is invented.
- Independent array, antenna and display heights; half-open stay; hourly forcing, modeled event offsets and boundary-censored runs.
- Nominal power, storage, radio, scheduling and orientation assumptions; full inputs are retained in the export.
- Supplied footprint measurements and mission limits as **author-reported and unverified**, with source/author and canonical stale/missing scope. A measurement label does not imply calibration. Other supplied analytical screens and relevant external reports retain canonical conditional/failure/missing states.
- Required failing, missing or conditional rows, plus an actionable evidence request for every evidence category. Known failures retain precedence over missing external evidence.

Optional `declaredBounds`/`stability` props are not trusted as current numerical authority. The helper checks baseline identity, bound domains/nominal containment, held requirements/operations, complete case set and each case against canonical recomputation. It derives extrema/stability flags from recomputed values. Stale/invalid numerical cases are hidden with an explanation; all-unknown battery cases keep null extrema. At most 27 declared cases are supported through the existing three-field schema. This is finite sensitivity, not interval propagation. Provenance, including an `observation` label, remains author-stated.

No new calibrated error propagation was justified. Physical terrain/registration/height errors, actual PV and storage behavior, station masks/booking/weather/noise, continuous visibility and operational qualification remain unquantified or require external evidence. Matching manifest hashes identify declarations/bytes; this module does not rehash assets or authenticate sources.

## Exact parent interface and wiring

Owned component: `components/evidence-confidence/summary.tsx::EvidenceConfidence`.

```tsx
import { evaluateEvidenceConfidence } from '@/lib/evidence-confidence';
import { EvidenceConfidence } from '@/components/evidence-confidence/summary';

const confidence = useMemo(() => evaluateEvidenceConfidence({
  catalog, state, manifest,
  declaredBounds: bounds, // optional UncertaintyEnvelope | null
  stability,             // optional StabilityResult | null
}), [catalog, state, manifest, bounds, stability]);

<EvidenceConfidence
  summary={confidence}
  audience={audience} // 'public' | 'educator' | 'planner'
  onClose={closeEvidence} // optional: host dismisses existing card/workspace
/>
```

Required inputs are the **live full canonical `ScenarioState`**, loaded `Catalog` (with already-loaded `globalTerrain` when used), and current `EvidenceManifest`. Use existing scenario state, not a display-observer-only reconstruction. Audience and playhead do not change scenario evidence; do not recompute this on every animation frame. Update whenever scenario/catalog/manifest/bounds/result changes. Memoization assumes immutable input updates. Optional finite evidence is synchronously re-evaluated (≤27 scenarios); run this after a completed finite-case request, not inside the animation loop. No latency guarantee was measured.

Place this component inside existing **Data & math / Planner evidence workspace**, with host dismissal, not a top-level map overlay. It inherits existing mission theme tokens and serif/data hierarchy, uses existing Button and native keyboard-operated details, wraps on narrow screens and adds no animation. It stops scrub/play key bubbling while interacting within the card. Parent must inspect integrated keyboard behavior, scroll/focus and dismiss/reopen placement.

`EvidenceConfidenceProps` additionally accepts `onExport?: (json: string) => void`. Default: local Blob download as `solarreach-evidence-confidence.json`, no network. A host handler can attach the generated JSON to its existing decision-export workflow. The pure `exportEvidenceConfidence(summary, exportedUtc)` validates a real ISO UTC timestamp. This is a **new evidence snapshot schema**, not an existing decision-package import schema. To reuse it, validate `heldScenario` with the canonical parser and recompute with the identified catalog/model; do not trust archived outcomes. Existing decision exports/imports and finite-case downloads were deliberately not edited.

Parent fixes/actions:

1. Wire live summary props and export inside the existing workspace, then run its integrated browser/keyboard/offline checks. No generated web/offline bundle was built here.
2. Decide whether to offer this snapshot beside finite-case export or attach the full nominal context to the existing export. The old finite export remains delta-only.
3. Resolve the separately reproduced read-only `lunar-terrain.js` lint error in its owning lane.
4. Keep publication bindings/model changes with parent if integrated numerical owners change audited code. Do not treat this communication module as validating their changes.

## Fresh checks and exact results

All commands ran from `navigator/` unless noted. Terminal logs omit trailing empty lines; diagnostics are unchanged. Node 20.20.2, Linux, headless Chrome 149.0.7827.155, temporary isolated browser context and file fixture. No app server/shared browser/Simulator/Metro was started. No dependencies were installed. `slop-scan` was not installed/configured; explicit owned lint and manual inspection found no swallowed errors or added authority path.

| Command | Exit / result | Receipt |
| --- | --- | --- |
| `node_modules/.bin/tsx --test tests/evidence-confidence/*.test.ts` | 0; **19 pass, 0 fail, 0 skipped/cancelled** | `focused-tests.tap` |
| `node_modules/.bin/tsx --test tests/evidence-confidence/*.test.ts tests/assessment.test.ts tests/engineering-evidence.test.ts tests/decision-export.test.ts tests/audit-register-freshness.test.ts` | 0; **70 pass, 0 fail, 0 skipped/cancelled**; includes the 19 above, not 89 distinct tests | `regression-tests.tap` |
| `npm run typecheck -- --incremental false` | 0; no diagnostics | `typecheck.txt` |
| `npm run lint` | **1; 1 error, 0 warnings** | `lint.txt` |
| `node_modules/.bin/eslint lib/evidence-confidence components/evidence-confidence tests/evidence-confidence` | 0; no output, no diagnostics | `owned-lint.txt` |
| `python3 scripts/compile-scientific-verification.py --check` | 0; publication check pass; **41 verified / 21 uncertain / 0 failing** | `publication-check.txt` |
| `node_modules/.bin/tsx tests/evidence-confidence/reproduce.mts` | 0; base/current existing module identities equal; full new snapshot replays to same key | `before-after.json` |
| `SOURCE_COMMIT=f6c3726f86ffd4364d8f30e0a5afe419c508e4b0 node_modules/.bin/tsx tests/evidence-confidence/browser.mts` | 0; **11 scoped agent checks**, 0 page errors, 0 HTTP requests | `browser.json` |
| `npm run lint` in isolated base `/tmp/lunario-confidence-base-lint/navigator` at `3c82b5a` | **1; same 1 error, 0 warnings** | `base-lint.txt` |

The full lint diagnostic is `components/workbench/scene/lunar-terrain.js:1:1`, `@typescript-eslint/ban-ts-comment`: `Do not use "@ts-nocheck" because it alters compilation errors`. Same configuration/dependencies were used in a detached base checkout, with a node_modules symlink. The error is therefore reproduced on the nominated base, not merely called unrelated. This lane does **not** claim full lint passes and does not edit that parent-owned file.

The 19 tests cover real catalog identity/values, separate heights, borrowed/missing/global terrain, endpoint coverage, missing ephemeris, failure precedence, reported/stale evidence, finite input domains, stale/forged/incomplete cases, independent constant-dark battery arithmetic, unknown extrema, full export/replay/null/zero/Unicode inputs and timestamp errors. The independent dark fixture is a mathematical check, not a measured lunar power result. No Sun/Earth formula, source sample, horizon calculation or canonical assessment changed; a fresh Horizons query was not required or claimed. The existing global publication gate passes because its audited modules/bindings remain unchanged; it is not a new physical qualification of this module.

Browser checks exercised selected outcome/terrain-sphere comparison, Enter/Space disclosure, export and close callbacks, actual default offline Blob download, all audiences, live changed selection and unknown metrics, all cards expanded at 320/360/720 CSS px, touch toggle and offline file operation. Screenshots were generated under the path in `browser.json`; planner/public rendered states were visually inspected. The fixture uses the existing theme and owned component CSS; it is **not** the integrated application or generated standalone artifact. Page scale factor 2 was explicitly recorded as **emulation only**, not native browser 200% reflow. Native zoom, human learning/task completion, screen readers and target devices remain untested. No participants, operational qualification or measured latency were fabricated.

Only owned source/tests/reports were changed. Parent-notes path was checked at implementation/test/commit boundaries and was absent. Shared vault, packages, shared UI/runtime, scientific bindings/model IDs, manifests, generated apps and assets remain untouched. Parent owns memory; this report/findings/result file are the durable handoff for that update.
