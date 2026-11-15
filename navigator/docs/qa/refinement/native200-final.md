# C12 native 200% viewport correction

Worker: `codex/refine-native200-final`, base `0ef2526a894f35bf9ee05773f646f817bf4b958f`. Ownership is limited to `app/globals.css`, `tests/refinement-viewport.test.ts`, and this report. Root owns integration, the combined build, and independent visual acceptance.

## Failure and bounded correction

Success requires the actual 1× vehicle to remain framed inside clear canvas at native browser 200%, with no instrument overlap, while ordinary pointer actions traverse compact/full telemetry and minimized/expanded/minimized-return location cards. Both HTTP and disconnected `file:` must work. Non-overlapping card rectangles alone are insufficient.

The new regression first ran against immutable `/tmp/lunar-window-c12.html` (81,080,480 bytes; SHA-256 `5caf68a6d4d6ad66401545afd3a773adf8ce0213e4fd3dccc7fe703a6b5484bf`). It failed on HTTP/compact/expanded: `vehicleFraming=occluded`, `unoccludedCanvas=""`. The actual host was 320×203.7265625 CSS px at y=173.7734375; the expanded location card used 90px and floating telemetry 85.7265625px. This reproduces the independent C12 failure, rather than substituting a 960px-wide viewport. Evidence: `/tmp/refine-native200-red.log` and `/tmp/refine-native200-red.json`.

Only at width ≤1080px and height ≤700px:

- The existing header scrolls within 25dvh, retaining every control.
- Visible flight telemetry occupies a dedicated grid row below the canvas and above map actions. Its internal scroll is bounded to 72px; full telemetry reserves separate space for its action buttons.
- The inspector spans the canvas, HUD, and map-action rows. The existing stacked inspector arrangement also has explicit rows at the smaller breakpoint.
- The location card keeps its normal minimize/expand actions and bounded internal scroll.

The map/scene host remains the actual canvas viewport. No science, assets, physical scales, camera/framing code, framing thresholds, control icons, independent QA scripts, or Root candidate was changed. Existing desktop and 800×1000 styles remain outside the changed media query. No shared browser/server, Simulator, Metro, push, or merge was used.

## Regression and verification

The opt-in browser regression launches its own Chrome profiles, using the real default browser zoom preference and `viewport:null`. Each profile has a fixed physical 1600px-wide window. It asserts CSS viewport 800×496, DPR=2, outerWidth=1600, visualViewport.scale=1: no viewport-size/page-scale approximation of zoom. The test serves only its immutable input HTML on a private loopback ephemeral port, then opens the same file in a fresh disconnected context. All profiles and the server close afterward.

Each of the 12 state observations requires a fresh completed render and asserts `vehicleFraming=framed`, nominal scale 1, nonempty clear canvas, visible projected geometry within that clear region and the actual global viewport, no vehicle/panel or panel/panel overlap, separate HUD metric/action space, inspector row coverage, no document overflow/scroll, and retention of the same actual canvas/scene. Normal Play/Pause clicks also exercise full telemetry's internal scroll. Console/page errors and disconnected HTTP attempts must be zero. Five numerical viewport regressions now include 800×496. The existing 800×1000 inspector scrolling and fractional 1920px global-map checks remain.

A stronger intermediate check caught a genuine full-HUD action/metric overlap: an existing inspector selector overrode the reserved right padding. `/tmp/refine-native200-focused-final.log` preserves that RED result. The final selector explicitly wins that cascade; this failure is not waived.

Run against a separately built scratch artifact:

```bash
SOLARREACH_STANDALONE_OUTPUT=/tmp/refine-native200-scratch-final2.html node scripts/build-standalone.mjs
SOLARREACH_VIEWPORT_ARTIFACT=/tmp/refine-native200-scratch-final2.html \
SOLARREACH_VIEWPORT_PLAYWRIGHT=/home/luke/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs \
SOLARREACH_VIEWPORT_EVIDENCE=/tmp/refine-native200-final2-evidence \
npx tsx --test tests/refinement-viewport.test.ts
```

Browser/platform: Google Chrome 149.0.7827.155, Playwright Core 1.63.0-alpha-2026-08-05, Linux 7.0.0-38-generic x86_64 GNU/Linux, Node 20.20.2. Headless Chrome uses `--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1600,1080`. PNGs use CDP `Page.captureScreenshot` from the actual surface, without capture beyond the viewport. This is software-rendered browser evidence, not hardware performance, screen-reader, operational, or user acceptance.

Final evidence/results are recorded below after the final scratch run. Root must rebuild the combined source and rerun the independent immutable HTTP/file visual verifier; this worker does not waive C12's independent failure or claim that final combined acceptance has occurred.

## Final worker result

Final immutable scratch: `/tmp/refine-native200-scratch-final2.html`, 81081299 bytes, SHA-256 `9ff0216eb6c801a1ee760bfd0f387f2c76e94afecbb8147f5079862bb6303a45`. The ten embedded science/data/asset globals are byte-identical to C12, including original NASA Moon mesh/8K atlas, six fine surface patches, Apollo vehicle, Earth and Sun; exact serialized-group hashes are in `/tmp/refine-native200-assets.json`.

Final focused gate: **7/7 pass**, zero failed/skipped, including **12/12 actual native-200% state observations** over HTTP and disconnected file. Full `npm test`: **763/763 pass**, zero failed/skipped. Nonincremental typecheck, full lint, `npm run math:check` (314 expressions), and whitespace checks pass. Cached slop-scan inspected five findings, all outside owned files: three directory-size notices and catch handling in NASA decoding/scenario validation; the former rethrows with causes and the latter rejects invalid imported values. No tooling was installed.

Final host: x=0, y=124.125, width=320, height=181.375 CSS px. HUD y=305.5–377.5; map actions y=377.5–433.5; inspector x=320–800, y=124.125–433.5. The expanded location card ends at y=222.125 and leaves clear vehicle space. HTTP projected bounds below are host-relative CSS pixels; disconnected-file results are independently recorded in the JSON.

| HUD | Location | Vehicle x, y | Clear canvas x, y |
| --- | --- | --- | --- |
| compact | minimized | 12.000–66.274, 111.683–155.310 | 12.000–68.000, 103.594–169.000 |
| compact | expanded | 12.000–64.911, 115.923–157.549 | 12.000–68.000, 110.000–169.000 |
| compact | minimized-return | 12.000–64.911, 112.720–154.346 | 12.000–68.000, 103.594–169.000 |
| full | minimized | 12.000–64.911, 112.720–154.346 | 12.000–68.000, 103.594–169.000 |
| full | expanded | 12.000–64.911, 115.923–157.549 | 12.000–68.000, 110.000–169.000 |
| full | minimized-return | 12.000–64.911, 112.720–154.346 | 12.000–68.000, 103.594–169.000 |

Evidence: `/tmp/refine-native200-focused-final2.log`, `/tmp/refine-native200-final2-evidence.json`, and its 12 sibling PNGs (physical 1600×993 capture). Required check logs: `/tmp/refine-native200-tests.log`, `/tmp/refine-native200-types.log`, `/tmp/refine-native200-lint.log`, `/tmp/refine-native200-math.log`, `/tmp/refine-native200-slop.log`; build log `/tmp/refine-native200-build-final2.log`. Earlier failures and intermediate checkpoints retain separate filenames and are not final evidence.

No ephemeris/geometry change; Horizons was not rerun. No final combined artifact was built or approved in this lane. Root must integrate, rebuild, and rerun independent visual HTTP/file/native-zoom verification against that exact immutable candidate.
