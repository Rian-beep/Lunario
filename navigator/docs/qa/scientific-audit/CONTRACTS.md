# Parallel scientific acceptance audit

Locked 15 November 2026. Science status is independent of UI acceptance. No operational certification is implied.

## Evidence contract
Each lane delivers `docs/qa/scientific-audit/<lane>/REPORT.md` plus `results.json`. Each result has `id`, `claim`, `status` (`verified`, `uncertain`, `failing`), `scope`, `sourceUrls`, `referenceVersion`, `inputIdentity`, `method`, `tolerance`, `observedError`, `reproduce`, and `limitations`. Include exact dates/epochs, units and coordinate frames. A source citation or a test that repeats implementation is not independent numerical validation. Same JPL ephemeris through another calculation validates implementation, not independent observation. Never count skipped, inaccessible, synthetic-only or missing-qualified-evidence as verified physical truth.

Use primary NASA/JPL/NAIF/USGS references; other authoritative standards only where appropriate (SI/ITU) and identify them. Save bounded non-secret reference responses and checksums so checks reproduce offline. Do not change tolerance to hide a discrepancy. Network failure is uncertain with its error, not pass. Demonstrate discrepancies before fixes, retain before/after evidence, run focused tests/types/lint before bundling. No credentials. No Simulator/Metro, app server or shared browser profiles.

## Isolated ownership
- `sources`: numerical terrain loaders/horizon/suitability, ice loaders/pipeline and their tests; raw-data integrity/read-only inventory. All existing public data files are read-only unless parent approves a reproducible regeneration. Does not edit astro, mission, flight, assessment or components.
- `ephemeris`: `lib/astro.ts`, `lib/catalog.ts` only numerical decoding changes if needed, `lib/engineering-evidence/horizons.ts`, `pipeline/build_dataset.py`, `scripts/verify-horizons.ts`, related new audit tests. No terrain, mission, flight, assessment or UI edits.
- `resources`: `lib/mission.ts`, `lib/dsn.ts`, `lib/station-weather-context.ts`, `lib/providers/comms.ts`, `lib/engineering-evidence/{communications,atmosphere,uncertainty}.ts`, related tests. Read shared engineering-screens only; propose shared-file corrections in report.
- `dynamics`: `lib/flight.ts`, `lib/landing-flight.ts`, `lib/touchdown-physics.ts`, `lib/touchdown-fragments.ts`, `lib/engineering-screens.ts`, related tests. Does not edit astro/mission/assessment/UI.
- `ui`: chart image components/helper, science/sky/audience chart rendering and UI verifier scripts/tests only; no scientific calculations, constants, data files or status reports from other lanes.

Each lane owns its named report directory and new tests prefixed `audit-<lane>` to avoid clashes. Shared model/version identities, assessment, metadata, global CSS, package files, final matrices, source-to-UI wiring, generated web/offline files and final builds belong to the Mac integrator. Report any necessary changes outside scope; do not edit them. UI work may proceed concurrently but cannot upgrade scientific status. Existing tests stay intact unless a demonstrable test error is documented.
