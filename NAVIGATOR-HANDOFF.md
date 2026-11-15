# Lunario navigator delivery

15 November 2026. The `navigator/` directory began as a byte-identical import of tested source `4a47f8e4091ad4e71508e932a293b91e56e49a8f`; private Git history was not imported. It now includes the original per-load animation, persistent light/dark themes and Public mission/DSN/weather context. The current file manifest records every delivery file independently. Lunario's original brand assets retain their provenance at `aeb673fff6de377e5dba0982c0c55c8b0d874ee8`. Original static-shell artwork and loader implementation are preserved; entry configuration now replays the original animation on each load with a three-second minimum.

## Run and validate

From `navigator/`, use Node 20+ (developed with Node 22), `npm ci`, then `npm run dev`. This is a separate Next.js project, not a static dashboard that GitHub Pages can execute. Keep the host's project root set to `navigator` if hosting this application. No deployment settings are changed here.

Validation commands: `npm test`, `npm run typecheck -- --incremental false`, `npm run lint`, `npm run build`, and `npm run standalone`. The source release passed 790 tests, typechecking, ESLint and both builds. Actual web/disconnected-file checks passed 16 Public flight journey groups, all 22 numeric controls and complete Follow playback. The final isolated native viewport suite passed 8/8, including all 12 true-200% HTTP/file HUD/location states. These checks were run on the source release; this delivery is verified as an identical snapshot. From the relocated `navigator/` project, production build and typechecking also pass, 17 focused flight/scheduling tests pass, and regenerated standalone HTML has exactly the same SHA256 as the tested release.

See [the exact QA receipt](navigator/docs/qa/public-flight-usability/VERIFICATION.md) for scope, diagnostic failures retained alongside the final pass, artifact identities and limits. The offline file is 81,145,681 bytes, SHA256 `30994eb901aec5d6e593d2b01364fd96f2bd6e07bfdfb41208a0b2d919a01fc9`.

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
