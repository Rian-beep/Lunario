# Lunario navigator delivery

15 November 2026. The `navigator/` directory is the complete, tested release snapshot from commit `4a47f8e4091ad4e71508e932a293b91e56e49a8f`; private Git history is not imported. Every application file matches that release byte for byte. Lunario's original brand assets retain their provenance at `aeb673fff6de377e5dba0982c0c55c8b0d874ee8`. Existing static shell files are preserved.

## Run and validate

From `navigator/`, use Node 20+ (developed with Node 22), `npm ci`, then `npm run dev`. This is a separate Next.js project, not a static dashboard that GitHub Pages can execute. Keep the host's project root set to `navigator` if hosting this application. No deployment settings are changed here.

Validation commands: `npm test`, `npm run typecheck -- --incremental false`, `npm run lint`, `npm run build`, and `npm run standalone`. The source release passed 790 tests, typechecking, ESLint and both builds. Actual web/disconnected-file checks passed 16 Public flight journey groups, all 22 numeric controls and complete Follow playback. The final isolated native viewport suite passed 8/8, including all 12 true-200% HTTP/file HUD/location states. These checks were run on the source release; this delivery is verified as an identical snapshot. From the relocated `navigator/` project, production build and typechecking also pass, 17 focused flight/scheduling tests pass, and regenerated standalone HTML has exactly the same SHA256 as the tested release.

See [the exact QA receipt](navigator/docs/qa/public-flight-usability/VERIFICATION.md) for scope, diagnostic failures retained alongside the final pass, artifact identities and limits. The offline file is 81,145,681 bytes, SHA256 `30994eb901aec5d6e593d2b01364fd96f2bd6e07bfdfb41208a0b2d919a01fc9`.

## What is included

2D polar/whole-Moon maps, original NASA 3D assets and numerical terrain, landing-site catalogue, site/date replanning, Public/Educator/Planner explanations, teaching exports, native mathematical notation, flight presets and editable experiments, fixed-scale Follow through launch/landing and illustrative contact/breakup, plus a fully embedded offline build. All numeric flight controls have adjacent explanations; Public outcomes explain failed checks and missing terrain.

## Remaining work and ownership

[Full TODOs and teammate handoff](navigator/docs/IN-FLIGHT.md) distinguish implemented software from evidence still required. Priorities are unprompted novice/educator/planner studies; final-host/provider/CSP/cache and actual-device/screen-reader acceptance; and qualified terrain/frame/vehicle/control/structural/station/thermal evidence. Educational flight/contact models and attractive maps do not certify an operational landing. Hosting belongs to the teammate. No authentication, credentials, private repository history, local dependencies or build caches are included.

The byte-preserved import retains one existing trailing space in `navigator/scripts/verify-extended-flows.mjs`; no source or numerical behavior was changed to reformat the release.
