# Alternatives UI handoff — 2026-11-14

Workspace: `/home/luke/Storage/solarreach-navigator-20261114-worktrees/alternatives-ui`.
Parent baseline: `1c2ae8deb802d6860b8d0db1a5fd4cb73f948d8a`.
Owned files only: `components/workbench/alternatives.tsx`, `components/workbench/alternatives.module.css`, this log.

## Delivered

`Alternatives({catalog, baseline, onOpen, onSave})` renders inline within the parent's existing comparison sheet. No modal, global CSS, package, root wiring, engine or source-data edits.

- Nearby location × UTC arrival-date matrix, baseline cell highlighted, explicit status text plus symbols, paired terrain/smooth-sphere sunlight and geometric contact. Selected cells expose metric pairs, selected thresholds, signed terrain deltas from the original baseline, source coverage and held assumptions. Planner additionally gets the precise assumptions JSON.
- Radius defaults to 150 km, accepts 0–500 km; up to 12 locations including the fixed baseline. Requests the nearest 12 from `nearbyCandidates`; includes a fallback baseline if the engine's candidate list excludes it. Candidates can be deselected. Catalog-derived and custom points remain labeled derived.
- Day offsets default to 0, 1, 3, 7, 14, 30. Signed whole-day inputs −90…90 are deduplicated, sorted, capped at 12 unique values; empty tokens and fractional/out-of-range offsets are rejected. Zero is editable, so the separate baseline reference remains available when no zero-offset column is selected.
- Optional sunlight/contact percentages, maximum darkness/blackout hours and slope degrees start blank (no screen). Minimum battery defaults to baseline usable capacity × reserve fraction; maximum unmet energy defaults to 0 Wh. Required energy criteria cannot be blank. No invented safe limits, weights or operational qualification.
- Existing engine remains the terrain screening authority. Smooth-sphere references call the existing `buildSeries`, `summarize`, `evaluateMission(..., true)` functions with unavailable terrain (sphere calculations do not use the terrain mask). No new physical equations or second terrain-screening path.
- Evaluation yields before baseline work and every three cells. Progress/cancel are inline. Input edits and cancellation remove all results, selection and exportability; a baseline/source-generation change remounts the session. Tokens stop stale asynchronous continuations after cancellation/unmount, including save feedback.
- Open scenario/Save comparison callbacks receive the complete engine state, preserving baseline stay length and hardware. Outside-catalog cells cannot be opened/saved. Saves and CSV exports provide success/failure feedback; errors are not swallowed.
- CSV uses `csvCell` for every field and includes all evaluated statuses, metric pairs and deltas with units, criteria JSON (null means unscreened), full scenario/baseline state, original baseline terrain metrics, site coordinates/provenance, horizon coverage, ephemeris/terrain citations, catalog/time coverage, search inputs and limitations. End timestamps are explicitly exclusive, reflecting each sample's following interval. CSV download feedback says requested, not guaranteed saved.
- Warm ivory table, inherited product typography, tabular numbers, native table headings, keyboard-focus styles and local horizontal scrollers. No giant cards or dark-blue surfaces. All views state educational screening and exclude radio/flight certification.

## Verification

- `npm run typecheck`: PASS against the parent-copied API stub and again after the real engine arrived at 12:51 UTC. Coverage labels and smooth-sphere coverage were aligned to the engine’s joint Sun/Earth-input definition.
- `npm run lint -- components/workbench/alternatives.tsx`: PASS, no warnings.
- CSS parsed with installed esbuild's CSS transform: PASS (see final handoff).
- `UV_THREADPOOL_SIZE=1 NODE_OPTIONS=--v8-pool-size=1 GOMAXPROCS=1 node --import tsx --test --test-concurrency=1 tests/*.test.ts`: 5 test files passed, `tests/scenario.test.ts` failed. Direct serial Node-loader execution exposed the specific failure: line 25 expects latitude 20° to be rejected, but the parent-copied parser accepts global coordinates. The identical serial scenario check PASSES on isolated baseline HEAD (`/tmp/solarreach-alternatives-base-xoVV28`). The changed shared parser/test contract is outside this worker's ownership; neither was modified.
- Temporary focused harness: `/tmp/solarreach-alternatives-ui.test.cjs`, nine tests PASS using the serial Node loader. Covers offset boundaries/deduplication, blank-vs-zero optional criteria/units, required numeric limits, complete paired-value/save/CSV flow, cancellation after three cells, input edits mid-run, no post-unmount state writes, baseline React session keys, engine errors and save failure feedback. Uses a controlled engine/hook harness; it does not validate numerical engine results or replace real React/browser QA. File is outside the repository because test files are outside the assigned ownership.
- Real engine integration: all 25 engine tests PASS using the serial Node loader against this worktree’s actual engine and shared libraries (`/tmp/solarreach-alternatives-engine-integration.test.ts`, copied from the engine worker with import paths redirected only). Includes real catalog agreement, slips, outside/unknown data, threshold boundaries and non-mutation.
- `git diff --check`: PASS on owned paths.

## Parent integration still required

The real shared `lib/alternatives.ts` arrived during final packaging and recompilation passes; neither it nor `lib/alternative-types.ts` is included in this commit/bundle. The engine’s 25 numerical/contract tests pass against this worktree. Resolve the shared global-coordinate test expectation, wire the component into the existing comparison sheet, and exercise browser flows including mobile/zoom/horizontal overflow, keyboard focus, outside/unknown/fail cells and offline export. No browser, server, simulator or native build was started by this worker. Rendered quality is pending the parent's browser QA; this is not user acceptance.

Commit delivery uses an isolated temporary Git repository parented to the stated baseline, because the shared worktree Git metadata is read-only. Only the three owned paths are staged; no shared files/stubs enter the bundle. No push.

Meaningful decisions and verification are saved in this owned handoff. The cross-project memory vault is outside the writable/owned scope; the parent should update the correct lunar project hub rather than the unrelated solar-sales SolarReach note.
