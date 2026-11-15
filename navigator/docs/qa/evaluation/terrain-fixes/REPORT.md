# Terrain runtime corrections — 15 November 2026

Branch `codex/eval-terrain`, worktree `/tmp/lunario-eval-terrain/navigator`. Required `git merge refs/remotes/mac/evaluation-integration` completed first: already up to date at `8cfb59abbaf7418f5b28b16ae8d73ed42e0b4b21`.

Only the four authorized production files and new terrain-specific tests, script and this report directory change. No visual-moon files, NASA globe implementation, data, scientific receipts, generated web/offline app, shared configuration or dependencies change. No server, Simulator, Metro, shared browser, subagents, push or downstream merge.

## Result

- HTTP detail uses `publicAssetURL`, including a configured hosted subdirectory. Explicit offline and native file transport return an empty unavailable URL, preserve embedded canonical terrain, and issue no missing detail-grid requests.
- Terrain/shadow resources are constructed lazily after the camera is framed for close south-polar inspection. Flights, follow/vehicle views, navigation, asset transitions, distant and unrelated views do not demand detail. All active `showFlight` views exclude visual detail and streamed substitutes. Loaded detail immediately hides when a flight becomes active. Canonical flight/contact calculations and geometry are unchanged.
- Disposal guards manifest fetch/JSON, dependency loads, streamed reads, complete body reads, native gzip output, mask loads and imagery completions. Late textures are retired; values/textures are never republished after disposal; status callbacks stop. Disposal clears mesh/cache/queue/loaded references and texture uniforms, is idempotent, and marks retained metadata unready. A failed overview releases partial resources and retains canonical terrain; failed optional layers remain explicitly unavailable with loaded-source fallback.
- Epoch lighting rotates the live site's supplied Sun direction through the mounted scene into the polar terrain frame. Studio inspection uses the disclosed fixed direction. Unchanged style/direction does not invalidate shadows; camera/LOD changes still legitimately refresh them. Detail no longer forces extra epoch fill merely because it is close.
- `getElevation` exposes recursively weighted contributors, individual sampled elevations, grid/native spacing, effective source and conservative contributor spacing. Normal mesh sampling avoids provenance allocation. The existing expandable Surface & scale section shows effective source, actual weights and elevations at the camera target, unavailable layers, lighting mode, reference datum and registration limits. It explicitly distinguishes 2 m grid posts from accuracy. No photographic imagery or landing qualification is claimed.
- A concise pending-model line appears within the scene with `pointer-events: none`; camera controls remain available. Full details stay in the existing disclosure.
- Browser verification also reproduced an initial globe-framing failure: after a near-origin frame chose the close policy, the camera moved far away and passed zero to `outsideSphere`. The call now requires a positive radius. Detail demand waits for the selected preset/reset to be applied and for asset travel to finish, preventing a transient startup download over fine coverage.

## Verification

The pre-fix incoming characterizations passed, confirming the known HTTP/file and disposed-texture defects. The first eight new regression checks were run before production changes: all eight failed on the exact symptoms. New tests now exercise async lifetime boundaries (including actual native gzip decoding behind an event gate), recursive three-source feathering, Sun idempotence/transforms, demand exclusions, imagery cleanup and failed-source fallback.

| Check | Fresh result |
| --- | --- |
| New `tests/terrain-evaluation/fixes.test.ts` | 12 passing |
| Relevant tests: new regressions, terrain, LOD, polar transform, landing-contact terrain, scene suite | 78 passing; no failures/skips |
| `npm run typecheck -- --incremental false` | pass |
| Owned-path ESLint and `npm run lint` | pass |
| Full `npm test` | 1,424 tests: 1,421 pass, 3 fail, 0 skipped/cancelled |
| Private native Chromium runtime/component/file harness | 12 checks pass; no page errors |
| `git diff --check` | pass |

Full-suite failures are explicitly retained:

1. `tests/terrain-evaluation/incoming.test.ts` expects a file URL for missing external grids. Correct offline behavior now returns no URL.
2. The same file expects disposed terrain to become loaded, reacquire a texture and emit callbacks. Correct behavior deliberately contradicts it.
3. `tests/audit-register-freshness.test.ts` reports `Stale scientific evidence: lib/engineering-evidence/communications.ts`. The identical command fails on the untouched integration revision in isolated `/tmp/lunario-terrain-base-verification/navigator`; see `base-freshness.tap`. Receipts are outside this task and were not rewritten.

The two old defect assertions are superseded by the new desired-behavior tests but remain unchanged under the explicit new-tests-only ownership boundary. Integrator should invert/remove those historical characterizations when authorized. Full suite is **not green**. A short-lived new decompression test initially used event-loop polling and failed under full-suite load; its final version awaits the actual native decoder event and passes both focused and full runs. No production tolerance or test expectation was weakened.

`slop-scan` is not installed/configured here. No arbitrary tooling was installed. Horizons verification was not rerun: ephemeris, numerical geometry and scientific source data did not change. This is runtime/display verification, not a new scientific receipt.

## Browser evidence and limits

Run `node scripts/evaluation-terrain/fixes-browser.mjs` from `navigator/`. Default artifacts go to `/tmp/lunario-fix-terrain-browser`; it launches a private Chromium 149.0.7827.155 context using SwiftShader and intercepted disk transport. No app server or shared profile is used. Real committed DEMs and the actual `mountScene`, `LunarTerrain`, `LunarScene` and embedded-terrain loader run; canonical fixture heights and host styles are explicitly synthetic. Unrelated NASA model requests intentionally return failures or are held pending to test fallback/status. This is not an authenticated Cesium test, production build, final-brand screenshot, target GPU benchmark or user acceptance.

The 12 checks cover: no allocation/request at distance; initial globe over fine coverage; active-flight orbit; explicit offline; transformed epoch Sun and changes; fixed studio/shadow stability; hiding already loaded detail on flight; cleanup/callback quiescence; missing overview; dispose during pending manifest; actual React pending/status/source disclosure; native file with injected embedded terrain and no offline prop.

At the known feather point x = −4824 m, y = −4862 m, committed data report stereo weight 7/255 (2.7451%) at 1141.8 m plus Site 04 weight 248/255 (97.2549%) at 1141.95 m, producing 1141.94588235 m. Runtime text reports both sources. The independently constructed body/pole lighting comparison differs by less than 2e−16 in unit-vector distance. These establish implementation consistency, not physical frame registration or 2 m accuracy.

See `browser.json`, `runtime-detail.png`, `component-pending.png` and `component-source.png`. The terrain frame was visually inspected: shaded measured relief is visible; pending text occupies a small lower scene strip and does not intercept input. Component typography/controls in this isolated host are not a claim about the fully styled application. The final integrated/offline artifacts remain the integrator's responsibility.

## Delivery

Commit contains explicit owned paths only. Bundle `/tmp/lunario-fix-terrain.bundle` includes branch `codex/eval-terrain` above integration base `8cfb59abbaf7418f5b28b16ae8d73ed42e0b4b21`. A machine-readable handoff with final commit, hash and bundle verification is written to `/tmp/lunario-fix-terrain-result.txt`. Nothing is pushed or merged downstream.
