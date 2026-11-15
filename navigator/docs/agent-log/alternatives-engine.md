# Alternatives engine handoff — 14 November 2026

Workspace: `/home/luke/Storage/solarreach-navigator-20261114-worktrees/alternatives-engine`, branch `codex/alternatives-engine`.
Commit parent: `1c2ae8deb802d6860b8d0db1a5fd4cb73f948d8a`.
Owned files only: `lib/alternatives.ts`, `tests/alternatives.test.ts`, this log. The parent supplied the shared `lib/alternative-types.ts` contract and newer astro/catalog/mission/scenario modules; those files are neither edited nor committed by this worker.

## Delivered behavior

- Exact shared-contract exports: `nearbyCandidates(catalog, baseline, radiusKm, max = 12)`, `criteriaForBaseline(baseline)`, and `evaluateAlternative(catalog, baseline, candidate, offsetDays, criteria, baselineMetrics?)`.
- Lunar haversine selection using the existing 1,737.4 km reference sphere. Current selected/custom point is always first, duplicate IDs and coincident coordinates are removed, catalog alternatives are nearest first inside the requested radius, and the total is capped at twelve. Custom coordinates preserve the selected site ID needed by scenario state.
- Integer calendar-day slips shift indices by `24 / stepHours`, retaining the inclusive stay length. Nonaligned shifts throw instead of rounding to another time. A full stay crossing either catalog boundary returns `outside` before any series or baseline computation; its unavailable metrics and deltas are null (coverage is zero).
- Synchronous per-cell evaluation reuses `buildSeries`, `summarize`, terrain selection and `evaluateMission`. The result clones the complete scenario, including power/storage assumptions, vehicle/flight inputs, observer height and optional radio inputs. Candidate coordinates must agree with the scenario location. Baseline deltas can use the caller's cached baseline metrics; missing/nonfinite values have null deltas.
- Default criteria are only the existing `batteryWh * reserveSoc` and zero unmet energy; every optional requirement is null. Fractions are validated within [0, 1], slope within [0, 90] degrees, and durations/energies within [0, Number.MAX_SAFE_INTEGER]. These are supported numeric ranges, not universal mission limits. Search radii must be finite/nonnegative; result limits must be positive integers.
- Empty site horizons, empty masks, missing custom grid cells and custom coordinates outside 90–80°S use a local unavailable-terrain guard. No call to the older unsafe `terrainForSite` is made for an empty horizon list. No globe heights or imagery are substituted for terrain.
- Full-window sunlight/contact percentages require complete relevant coverage. A missing sample cannot produce an inflated known-only fraction. Integrated power/storage and uninterrupted darkness/blackout measures remain null where their required source data is missing. Joint Sun/Earth known coverage is reported separately. Custom slope remains unknown instead of borrowing the selected site's slope.
- Each requested criterion records a violation or an unknown independently. A known failure takes precedence over unknown status while preserving both lists. Missing power data cannot produce `meets`, even with zero energy thresholds. Unknown optional criteria do not become invented requirements.

## Scientific scope

This is a generic sunlight, Earth visibility and power/storage screening calculation against user requirements. `meets` means the supplied criteria pass; it does not certify a mission, safe landing, flight feasibility, radio link or station availability. Visibility uses the existing precomputed 1° LOLA horizon masks from 40 m / 240 m source DEMs and catalog sampling. Custom terrain retains the existing nearest-cell/height approximation. Solar visibility is any visible disk; Earth contact is Earth centre clearing terrain and the mission antenna mask. Battery/load/array equations and all Sun/Earth geometry are unchanged. There is no weighted feasibility score and no added universal slope, blackout or darkness threshold.

## Verification

All commands used `UV_THREADPOOL_SIZE=1 NODE_OPTIONS=--v8-pool-size=1 GOMAXPROCS=1`.

- `npm run typecheck`: passed.
- `npm run lint -- lib/alternatives.ts tests/alternatives.test.ts`: passed.
- `node --import tsx tests/alternatives.test.ts`: **25/25 Node subtests passed**. Synthetic analytic fixtures cover delayed illumination/energy/storage, alternative-site masks, same vehicle assumptions, radio/state sharing, inclusive bounds, date conversion, out-of-range early exit, lunar distances/deduplication/custom points/caps, invalid criteria and source values, missing terrain, partial coverage, simultaneous failures/unknowns, cached deltas and input immutability. A real decoded committed-catalog fixture agrees with the existing summary and mission functions.
- All existing `tests/*.test.ts` executed serially, one direct `node --import tsx <file>` process at a time: **54/55 passed**. The sole failure is `tests/scenario.test.ts` → “invalid custom coordinates or vehicle assumptions are rejected”, because it still expects latitude 20° to be rejected. The supplied `lib/scenario.ts` now permits global [-90, 90] coordinates.
- Isolated baseline comparison: the original HEAD passes all 4 scenario tests. Copying only the parent's supplied astro/catalog/mission/scenario modules and contract into the isolated checkout, with no alternatives implementation or tests present, reproduces the same 1/4 scenario-test failure. This is a confirmed integration-baseline mismatch for the parent to update, not a change to make outside worker ownership.
- Node v20.20.2's `--test` plus this installed tsx loader reported only a file-level pass without individual subtests. Direct Node-loader execution was therefore used to verify actual test registration/counts, rather than treating that summary as evidence of the 25 tests.

No browser, server, native build, package change, network science query, push or shared git metadata mutation was performed. Horizons revalidation is not triggered: no ephemeris parsing or geometry formula was changed. Parent retains browser/integration verification.

## Delivery and durable handoff

The commit is created in `/tmp/solarreach-alternatives-engine-1pgg4gg5`, an isolated clone with the original HEAD as parent. Its bundle is `/tmp/solarreach-alternatives-engine-1pgg4gg5/alternatives-engine.bundle`. Only the three owned paths are staged; supplied shared modules remain uncommitted. The parent must integrate the shared contract/modules alongside the engine.

This log records the decisions, completed milestone, evidence and remaining integration-test update. Canonical vault writes are outside this task's explicit three-file ownership and sandbox write roots; no vault update or index sync is claimed. Startup instruction-parity check passed. Semantic memory tooling was unavailable under the approval policy, so vault search/read was used; the old SolarReach memory hub describes a different May solar-sales product and was not treated as lunar-project guidance. Parent can incorporate this handoff into the correct lunar project memory.
