# T05 interval energy and events — worker handoff

Date: 14 November 2026. Worker: Sol energy-events on Clevo.
Branch: `codex/energy-events`; base: `808cb87` (`mac/planning-contracts`).
Scope: `lib/mission.ts`, `lib/mission-events.ts`, their two test files, and this note only.

## Contract for integration

```ts
evaluateMission(arraySeries, stepHours, assumptions, sphere, {
  contactSeries: antennaSeries,
  operations,
});
```

The existing four arguments remain valid; omitted options preserve unlimited bus power, immediate deployment, baseline load and contact from the original series. `Operations` is imported directly as a type from `planning-types`; this worker does not depend on or modify scenario persistence. The parent must wire scenario operations and independent subsystem series into consumers.

- Each solar forcing sample is evaluated with the existing disk-fraction/incidence generation formula once. Antenna contact uses its own aligned Earth elevation/horizon series and the antenna mask. Sphere mode uses zero terrain horizons for both subsystems.
- Half-open load segments add to baseline load, including overlaps. Forcing intervals split at deployment and load boundaries. Generation is zero before deployment; load and geometric contact continue. `sun` and overlap retain geometric visibility semantics rather than deployed-array status.
- Charge/discharge limits are bus watts. Generation serves load first, then surplus/deficit reaches the capped battery bus; storage efficiencies apply after the caps. Curtailed energy excludes charge losses. Discharge losses are storage withdrawals, not unmet bus load.
- `timeline.length` remains exactly `arraySeries.sunEl.length`. Each row retains `powerW`, end `batteryWh`, `contact` and `sun`, and adds `startOffsetHours`, `endOffsetHours`, `startBatteryWh`, `loadW`, and interval `unmetWh`. Power and load are duration-weighted interval averages when operations split the interval.
- `subsegments` is a separate, ordered flat array for charts/export. Each carries a mission-relative forcing `intervalIndex`, start/end offsets, start/end battery, constant power/load, geometric states, generated/load/unmet/curtailed energy, bus `chargeInputWh` and bus `deliveredWh`. Battery capacity/depletion can occur inside a subsegment; endpoints are clipped and event timing uses the unsaturated storage rate.
- Reserve means strictly below `capacity * reserveSoc`; equality passes. `reserveHours` integrates the actual below-reserve duration, including partial intervals and charging recovery. Initially below reserve emits offset zero. Unserved-load onset accounts for immediate bus-cap failures as well as later battery exhaustion. Exhaustion exactly at mission end produces zero unmet load and no unserved event.

## Events and incomplete evidence

`MissionResult.events` is optional in the type for consumers but is populated by this evaluator. It contains the first known reserve violation, first unserved load, and first unknown solar/contact interval, in model-time order. Numeric `MissionModelEvent` offsets are relative to mission start; `intervalIndex` is relative to this series, not the catalogue. The earliest/latest bounds cover the whole forcing interval. `modelOffsetHours` records the exact piecewise-constant model onset, and is null for unknown evidence.

`toMissionEvent(event, missionStartUtc, evidenceIds?)` converts those bounds into the shared UTC `MissionEvent` contract, preserving the numeric model offset and copying evidence IDs. It validates dates, offset ordering, finite values and date-range overflow. The model offset must not be presented as a new sub-hour observation.

An unknown solar sample poisons that interval's end battery and all subsequent storage/unmet/curtailment results, even when later forcing is known. The first unknown interval can still retain its known start battery. Full generated/storage/unmet/reserve/curtailment summaries become null; `partialCurtailedWh` reports only the evaluated prefix. Known failure events before a gap remain available, so assessment must retain those failures even when the complete totals are unknown. Contact gaps leave solar/storage evaluation intact but make complete contact/outage/overlap summaries null. No blackout is bridged through unknown contact data.

Required solar arrays and aligned antenna source lengths/start indices are checked. Operations reject missing fields, negative/nonfinite limits or delays, invalid or duplicate IDs, invalid bounds and negative/nonfinite additional loads. Accumulations that exceed the finite model range throw rather than returning NaN/Infinity.

## Validation and delivery

Test-first failures were observed for interval starts/exact reserve timing, the charge-cap intermediate state, deployment/load splitting, independent contact, unknown curtailment/events, source/operations validation, numeric-to-UTC conversion, overflow and negative curtailment from floating-point rounding. Regression fixtures cover both efficiencies, discharge caps, zero capacity/caps, equality, initially below reserve, exact exhaustion, known-prefix failures and per-subsegment bus/storage conservation.

- Targeted tests: 29 passed using `node --import tsx -e "require('./tests/mission.test.ts'); require('./tests/mission-events.test.ts')"`.
- Full regression suite: 157 passed, zero skipped, using direct Node/tsx imports of every `tests/*.test.ts` and `components/workbench/scene/*.test.ts` file. Log: `/tmp/energy-events-tests.log`.
- `npm run typecheck -- --incremental false`: passed, exit 0; no outstanding consumer errors.
- Scoped `npm run lint -- lib/mission.ts lib/mission-events.ts tests/mission.test.ts tests/mission-events.test.ts`: passed, exit 0.
- Full `npm run lint`: passed, exit 0. `git diff --check`: passed.
- `npm test` was attempted, including a targeted attempt. The `tsx` CLI fails before tests with `listen EPERM` on `/tmp/tsx-1000/14.pipe`. The direct Node/tsx imports exercise the same repository test files without the CLI IPC listener. No package/configuration change was made for this sandbox restriction.
- The existing owned curtailment assertion now narrows null before numeric comparison. No consumer file outside ownership was edited. The current typecheck has no outstanding nullable-curtailment consumer error; downstream consumers must still handle the deliberately nullable result.
- `linkBudget` and celestial geometry/pipeline files are unchanged. Horizons was not rerun because ephemeris/geometry did not change. No server, browser, build, install, offline generation or simulation was started.

The specified dark fixture produces battery boundaries `[300, 200, 100, 0, 0]` Wh, 100 Wh unmet load, reserve crossing at 2.4 h, 1.6 h below reserve, and first unserved load at 3 h. The specified 200 W / 2 h charge fixture with a 50 W bus cap produces `[0, 50, 100]` Wh and 300 Wh curtailed energy.

Delivery is an unstaged patch at `/tmp/energy-events.patch`, including new files, plus `/tmp/energy-events-status.txt`. Shared git metadata is outside this worker's writable roots; no commit or index bypass is attempted. Parent integrates and owns the preview/build/offline gates. This note is the durable worker milestone; the shared vault is outside both file ownership and writable roots and was not edited.
