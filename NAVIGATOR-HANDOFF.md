# Current audited release — 15 November 2026

Planning-5, source-to-output Data & math framework, per-location mission histories and cited Mission paths & reasons are integrated. Two bounded source paths replay independently of planning time; no confirmed as-flown lander/launch/ascent series for all missions is claimed. NASA2025 colour and calibrated1× LOLA visual relief reach8K on supported high-memory web devices and4K offline. Scientific comparisons and final-review findings are documented with their limits; this is not operational qualification.

Current validation:1361 tests, nonincremental types/lint, Next production build, web/offline builds, and actual browser web/file workflows. Final artifact identities and exact test scope are in navigator/docs/qa/audit-replay-release/VERIFICATION.md. Hosting remains teammate-owned. Use repository-root index.html (`?demo=1` for Rian's selected demo); final TODOs and qualification/acceptance gaps are in navigator/docs/IN-FLIGHT.md.

The earlier chronology below preserves historical counts and hashes; use the current release receipt above for deployment.

---

# Lunario navigator delivery

15 November 2026. The `navigator/` directory began as a byte-identical import of tested source `4a47f8e4091ad4e71508e932a293b91e56e49a8f`; private Git history was not imported. It now includes the original per-load animation, persistent light/dark themes and Public mission/DSN/weather context. The current file manifest records every delivery file independently. Lunario's original brand assets retain their provenance at `aeb673fff6de377e5dba0982c0c55c8b0d874ee8`. Original static-shell artwork and loader implementation are preserved; entry configuration now replays the original animation on each load with a three-second minimum.

## Run and validate

Root `index.html` now opens `web/index.html`, the generated split-module application. Serve the repository root for the static demonstration; use `?demo=1` for Rian’s default demo and original loader. `navigator/` remains a Next.js app: Node 20+, `npm ci --legacy-peer-deps`, `npm run dev`.

Validation: `npm test` (970 passed), typecheck and lint; production Next build; `npm run standalone`; `npm run build:web`. Actual browser flight checks passed 16 web/disconnected-file groups. Current map workflow results and remaining acceptance limitations are recorded in `navigator/docs/qa/map-integration-final.md`; earlier worker failures remain documented rather than erased. The release manifest identifies generated offline bytes.

## What is included

2D polar/whole-Moon maps, original NASA 3D assets and numerical terrain, landing-site catalogue, site/date replanning, Public/Educator/Planner explanations, teaching exports, native mathematical notation, flight presets and editable experiments, fixed-scale Follow through launch/landing and illustrative contact/breakup, plus a fully embedded offline build. All numeric flight controls have adjacent explanations; Public outcomes explain failed checks and missing terrain.

## Remaining work and ownership

[Full TODOs and teammate handoff](navigator/docs/IN-FLIGHT.md) distinguish implemented software from evidence still required. Priorities are unprompted novice/educator/planner studies; final-host/provider/CSP/cache and actual-device/screen-reader acceptance; and qualified terrain/frame/vehicle/control/structural/station/thermal evidence. Educational flight/contact models and attractive maps do not certify an operational landing. Hosting belongs to the teammate. No authentication, credentials, private repository history, local dependencies or build caches are included.

The byte-preserved import retains one existing trailing space in `navigator/scripts/verify-extended-flows.mjs`; no source or numerical behavior was changed to reformat the release.

## Current themes and Public-context update

Use the header Dark/Light control; light retains the reference mint/cream appearance and dark uses near-black/grey and orange. Reload preference is separate from mission inputs and NASA renderer state. Public lunar selection opens sourced mission context; Earth-complex selection opens role, geometry and weather explanations. Station availability, signal strength and far-future weather are explicitly not inferred from a visible model.

[Current QA and artifact receipt](navigator/docs/qa/public-context-theme/VERIFICATION.md) supersedes the historical baseline counts/hash above for this update. Final HTML is 81,164,024 bytes with SHA256 `a7270fc95067acfacb422a368eb8f24c72a3d54c2ba0418b45e881cbbeea5342`. Hosting remains teammate-owned.

## Latest: more space for the scene

The right inspector now fills available desktop height and reserves real canvas space instead of covering Earth/Moon. Compare is side-docked, Earth station controls are grouped, mission guidance is an optional inspector disclosure, and Planner Var supplies relevant native formulae without a modal. Panel edges and navigation surfaces are quieter while both palettes and original branding are preserved.

[Latest workspace QA](navigator/docs/qa/workspace-room/VERIFICATION.md): final source797/797, actual web/offline journeys and8/8 native zoom tests pass. Offline HTML81,169,598bytes, SHA256 `f75705f8e651552be500aaf4a9e6331f717970b9cb81489d7d293bb1defa4cfd`. This supersedes the previous release identity above. Hosting and qualified-evidence TODOs remain unchanged.

## Latest: orbital context and stable lunar navigation

Earth focus now includes six dated spacecraft identities and predicted orbits, including Starcloud-1, with a separate UTC clock, mission descriptions, source/age/frame limits, bounded JSON import and explicit cached refresh. This educational layer does not infer lunar relay service, station bookings or RF weather losses.

Moon view restores labelled poles and landing-site orientation, direct N/S/E/W navigation, cooperative measured close-view refinement and stable polar texture lookup. Information controls and chart SVGs retain their proportions. Public Flight preview enters the lander focus; Follow no longer preserves an unfinished distant approach. The team's current logo/About header, dark default and loader changes are retained.

[Current QA and exact artifact identity](navigator/docs/qa/orbital-terrain-navigation/VERIFICATION.md) supersede earlier receipts. [Full remaining TODOs](navigator/docs/IN-FLIGHT.md) retain the qualified evidence, human/device acceptance and hosting tasks.
