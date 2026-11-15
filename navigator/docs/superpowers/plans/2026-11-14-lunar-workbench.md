# Lunar Workbench Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task in the current session. Luke approved the design and requested implementation; proceed without another process approval gate.

**Goal:** Deliver a map-first lunar navigator with useful audience workflows, real terrain/flight visualization, mission calculations and editable comparison metrics.

**Architecture:** Preserve the catalog/astronomy path. New pure mission/flight modules feed a map-first React workspace and a Three.js renderer. Prepare bounded NASA numerical terrain and retain self-contained offline assets.

**Tech Stack:** Existing Next.js/React/TypeScript/Tailwind/Base UI, Three.js, Node test runner with tsx.

**Spec:** `docs/superpowers/specs/2026-11-14-map-first-lunar-workbench-design.md` (approved by Luke in chat).

## Global constraints

- Lunar landing and departure first; no Earth launch/transfer.
- Preserve terrain and smooth-sphere results and existing Horizons geometry.
- No auth/database/second UI library. Preserve offline operation and keyboard controls.
- Numerical terrain only, with honest bounds/resolution and no invented measurements.
- Follow current request's glass redesign over the handoff's warm-paper suggestion.

## Review focus

- Invalid/empty numeric and date inputs must not crash, silently clamp dates, or produce plausible fabricated results.
- Missing numerical terrain and lost WebGL must remain usable and explicitly labelled.
- Power storage must expose deficits and respect capacity/charge efficiencies.
- Flight integration must handle unpowered conservation, fuel exhaustion and surface contact.
- Reload, sharing and mode changes must retain the chosen scenario without confusing flight seconds with environmental hours.

## Task 1 — Baseline and reproducible tooling

Files: package scripts/lock, standalone builder, baseline evidence, development docs.

- [ ] Install locked dependencies, run existing typecheck/lint/build and record findings.
- [ ] Restore archive history without its foreign hook/remote config; use codex feature branch.
- [ ] Add test command and Three.js/types; fix only setup issues evidenced by checks.
- [ ] Record baseline and commit explicit files.

## Task 2 — Numerical mission models

Files: `lib/mission.ts`, `lib/flight.ts`, `tests/mission.test.ts`, `tests/flight.test.ts`, `tests/catalog.test.ts`.

Interfaces: `evaluateMission(series, stepHours, assumptions, sphere?)` returns power/storage/contact metrics; `simulateFlight(input)` returns timed Cartesian flight samples plus terminal status; retain existing SampleSeries and Catalog types.

- [ ] Write failing analytic tests: tracked/fixed array incidence, battery deficits/capacity, unknown terrain, link inputs, orbital energy, fuel flow, ascent/descent contact and invalid inputs.
- [ ] Run and observe actual failures.
- [ ] Implement pure models, units and bounded inputs; rerun tests.
- [ ] Check decoded catalog against fresh Horizons observer samples without changing astronomy silently.

## Task 3 — Real terrain and resource adapters

Files: `scripts/prepare-terrain.mjs`, `lib/terrain.ts`, `lib/resources.ts`, `public/data/terrain.json`, offline builder.

Interfaces: georeferenced polar numerical height grid + metadata, `sampleTerrain(grid,lat,lon)` returning known/unknown heights; resource catalog includes actual service and reference roles.

- [ ] Verify supported Moon Trek service and PGDA raster access/metadata.
- [ ] Read bounded real numeric raster samples with explicit provenance; test coordinates, bilinear samples and missing-data handling.
- [ ] Bundle suitable numerical terrain for offline rendering, plus optional supported map layer metadata.

## Task 4 — Map-first workspace and audience tools

Files: `components/navigator.tsx`, `components/workbench/*`, `components/polar-map.tsx`, CSS/layout, UI-focused tests.

- [ ] Replace panel-heavy shell with viewport, collapsible site/inspector drawers and persistent date timeline.
- [ ] Preserve coordinates/playback and add share/reload scenario state.
- [ ] Add Public explanations, guided Teach experiments and Plan hardware/constraint controls.
- [ ] Implement saved scenarios, configurable/reorderable/sortable comparison columns, custom values and provenance exports.
- [ ] Expose data/resource layers, source metadata, dates/coverage and terrain/sphere results.

## Task 5 — Three-dimensional scene and flight

Files: `components/workbench/scene.tsx`, flight controls and telemetry.

- [ ] Construct real terrain mesh, local coordinates, sunlight, site and horizon directions, orbit/surface cameras and fallback.
- [ ] Render parameter-driven ascent/descent paths with independent seconds playback, editable hardware/initial states and terminal labels.
- [ ] Verify terrain alignment, visual scaling, no fabricated collision clearance and cleanup of renderer resources.

## Task 6 — Verification, documentation and delivery

Files: README/CHANGELOG, architecture/development notes, decisions, evidence.

- [ ] Run tests/typecheck/lint/build and triage real slop-scan findings.
- [ ] Browser-check public/teach/plan, sites/custom coordinates, dates, comparisons/exports, 3D/flight, desktop/mobile/zoom/keyboard/reduced preferences and failure states.
- [ ] Rebuild offline HTML and verify with networking disabled.
- [ ] Update docs to match actual delivered behavior, commit logical changes, inspect staged files and secret/large-file safety.
- [ ] Publish only to a verified authorized private owned destination; preserve collaborator/source provenance and never push blindly to the archive's temporary origin or the public README repository.
