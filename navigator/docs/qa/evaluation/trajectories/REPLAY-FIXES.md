# Published trajectory replay fixes

15 November 2026. Worktree `/tmp/lunario-eval-trajectories/navigator`, branch `codex/eval-trajectories`. First fast-forwarded `f5f64c6` to the explicitly requested `refs/remotes/mac/evaluation-integration` at `8cfb59abbaf7418f5b28b16ae8d73ed42e0b4b21`. Implementation and regression commit: `302f6cd`.

## Result

- Camera arrival now applies the destination and target once, including when the first frame reaches/passes 3 seconds. Reduced motion reaches that pose on the first render. Arrival then releases camera controls; follow remains an explicit action. Damping is disabled during automatic arrival so pending orbit deltas cannot accumulate into the destination.
- Linear paths split whenever an adjacent sample interval exceeds `maxGapSeconds`. Intervals equal to the limit remain supported. Isolated observations remain points. With interpolation `none`, every observation is a point and no lines are constructed. Each allocated geometry/material is disposed on replacement/unmount.
- The existing state sampler still hides the beacon where position is unavailable. Missing coverage and exact-only sampling now have explicit text. The original arrays, source transforms and interpolation rules are unchanged.
- J2000 and ICRF datasets remain structurally parseable but the replay rejects them visibly before mounting a renderer or playback controls. The message names the unsupported frame and offers another path or educational simulation. No inertial-to-body-fixed conversion is implied.
- The supplied UTC epoch is explicitly labeled **Starts**. The source epoch and time scale are shown alongside it; the slider/readout use elapsed source-scale seconds. No UTC timestamps are synthesized by adding TDB seconds to a UTC date.
- Workspace resolution is restricted to trajectories belonging to the selected site. Historical replay and the educational-flight callback remain separate. Source uncertainty/missing-state limits remain available in the selector and are also disclosed in replay, including Athena's first-contact-to-final-orientation gap.

`lib/mission-replay.ts` contains only display-path construction, camera easing, frame support and labels. It does not assess missions, alter numerical data, transform source frames, or drive planning/flight time.

## Verification

Node v20.20.2; private Chromium 149.0.7827.155 using ANGLE/SwiftShader. All commands ran against this worktree. No dependencies installed.

| Check | Fresh result |
| --- | --- |
| `npx tsx --test tests/mission-replay/replay.test.ts tests/mission-trajectories.test.ts` | 21/21 pass; 0 failed/cancelled/skipped/todo |
| `npm run typecheck -- --incremental false` | exit 0, no diagnostics |
| `npx eslint components/mission-trajectories/replay.tsx components/mission-trajectories/workspace.tsx lib/mission-replay.ts tests/mission-replay/replay.test.ts tests/mission-replay/browser.mjs` | exit 0, no diagnostics |
| `REPLAY_BROWSER_OUTPUT=/tmp/lunario-mission-replay-final node tests/mission-replay/browser.mjs` | exit 0; 9 grouped checks; no page errors or HTTP requests |
| `git diff --check` | exit 0 |

The original camera bug was reproduced before edits by `node tests/mission-replay/browser.mjs`: actual camera `[2726.197426857686,-5292.859256855541,-1730.1700716730543]`, expected selected-path destination `[1158.0699126964837,-2053.3025973361605,-734.9643441494891]`; assertion failed. The same camera regression passes after the fix. The earlier gap reproduction remains in the original [evaluation report](REPORT.md); its historical evidence was preserved.

Browser checks mount the actual replay and workspace modules with observation-only hooks into the real Three renderer/controls. They verify first-render reduced-motion arrival and later manual zoom; normal arrival within `1e-8 km` numerical tolerance; actual Line/Points geometry; missing-position beacon visibility; inertial-frame rejection without a scene; site changes and close callback; and 390 CSS px page overflow. The harness tracks renderer revisions and waits for pause updates to render, avoiding stale-frame test races.

For **each of Odysseus, Blue Ghost 1 and Athena**, browser checks exercise selection into paused replay, complete sample geometry, play/pause stability, follow/release, scrubbing the exact final source position, static UTC start versus elapsed TDB labeling, visible source uncertainty, restart, replay from the end, and the separate educational simulation callback. Unit coverage also tests all-isolated input, multiple gaps, the exact max-gap boundary, copying without source mutation, UTC/TDB labels and all three CLPS source endpoints/limits.

Local logs: `/tmp/lunario-fix-trajectories-{tests,typecheck,lint,browser}.log`. Original red reproduction: `/tmp/lunario-mission-replay-before.log`. Browser report and inspected mobile screenshot: `/tmp/lunario-mission-replay-final/{report.json,replay-mobile.png}`. These temporary test outputs are not bundled as production artifacts.

## Scope and remaining acceptance

The browser fixture intentionally has no NASA globe asset transport: the production loader reports its unavailable state while the real path scene/controls continue. Full hosted/offline app wiring, successful NASA-globe loading, planning-clock integration, target hardware, native zoom, screen-reader use and human acceptance are not established here. No shared profile/server was used or controlled.

The original camera destination/framing formula is retained. The inspected unthemed 390 px component fixture has no horizontal page overflow, but the Athena path's endpoints extend beyond the canvas vertically at initial framing. Users can zoom out; this is a separate framing limitation, not proof that the new arrival skipped its destination. Full-path containment was not asserted or silently substituted for camera-arrival verification.

No original trajectory JSON, primary-source provenance, scientific receipt, model identity, assessment/ephemeris/terrain code, shared styles, package/configuration, generated hosted/offline artifact or existing evaluation evidence was edited. No Horizons/scientific publication gate or full-repository test/lint pass is claimed. No Simulator, Metro, app server, shared browser, push or further integration merge was started. Parent integrator retains publication/build and complete-app acceptance.

Delivery bundle: `/tmp/lunario-fix-trajectories.bundle`, containing only the new replay fix/report commits after prerequisite `8cfb59a`. It can be imported and reviewed without merging or pushing by default.
