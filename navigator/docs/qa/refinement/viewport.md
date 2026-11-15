# Viewport fit and inspector scrolling

14 November 2026. Worker branch `codex/refine-viewport-fill`, based on `6c9227a03597c33169dd05433aec79adc7048a48`.

Success means the map uses the available canvas with an accurate projection, inspector use keeps the map/vehicle inside the actual browser viewport, controls remain reachable through internal scrolling, and the existing region, split, dismissal and restoration flows work. The shared browser's separate emulation fix is outside this change.

## Changes

- The application uses `100dvh`, with a shrinkable workspace between the header and timeline. Long header/timeline content scrolls internally. Existing type sizes and controls remain.
- At 681–1080 CSS pixels the inspector docks beside the canvas, capped at 60% of workspace width. Its existing width preference, Widen/Compact buttons and dismissal/restoration remain. At smaller widths it occupies an internally scrolling bottom panel. The two split panes remain visible beside each other in this compact arrangement.
- Inspector content, site lists and map information scroll inside bounded panels. The flight controls wrap within the narrower canvas. Existing map actions occupy a reserved row beside a docked inspector, so the comparison control cannot cover the renderer.
- Expanded polar initial/reset fitting uses one cover scale; edges crop rather than stretching or repeating the finite polar image. Embedded polar views retain their complete overview. The existing regional selection view, manual pan/zoom, graticule, scale, imagery and credits remain.
- Map resizing retains the image point at the centre and the user's scale. Both maps measure fractional CSS dimensions and reconcile the canvas backing store with those dimensions. Drawing and pointer conversion share the same logical coordinates. `data-map-transform` records the actual transform used by each completed map paint.

No scene, camera-framing, numerical geometry, package/configuration, public assets or generated repository artifact changes. Horizons verification was not applicable to these layout/drawing changes.

## Regression checks

`tests/refinement-viewport.test.ts` has five always-on numerical camera tests and an optional real-browser gate. The numerical tests exercise cover/contain bounds, uniform projection scale, inverse pointer mapping, resized centre/scale preservation and the whole-Moon 2:1 mapping across wide, narrow and zoomed sizes. They do not inspect CSS strings.

The browser gate uses a private Chromium instance against an immutable standalone file. It scrolls actual inspector content, checks the canvas against global viewport bounds and the docked inspector, then checks a fractional whole-Moon canvas size. Run it with:

```bash
SOLARREACH_VIEWPORT_ARTIFACT=/tmp/solarreach-viewport-scratch-final5.html \
SOLARREACH_VIEWPORT_PLAYWRIGHT=/home/luke/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs \
npx tsx --test tests/refinement-viewport.test.ts
```

The module override uses the already-installed worker browser package; omit it where `playwright-core` resolves normally. `SOLARREACH_VIEWPORT_CHROME` optionally selects an installed Chrome executable.

Red evidence is retained:

- Original base artifact: browser regression fails with document `scrollY = 839`; map host `y = -443.1875`, height 620 at 800×1000. `/tmp/refine-viewport-baseline-test.log` and `/tmp/solarreach-viewport-baseline-800.png`.
- Before the fractional-size correction: the new drawing-size assertion fails with `681.25 ≈ 681`. `/tmp/refine-viewport-fraction-baseline.log`.

Final verification: 6/6 focused tests, full `npm test` with browser gate enabled **729/729**, zero failed/skipped; `npm run typecheck -- --incremental false`, `npm run lint` and `git diff --check` pass. Ordinary `npm test` without an artifact runs 728 tests. Cached `slop-scan scan .` and `--lint` report five repository findings, none in the owned implementation files: two contextual NASA decode catches preserve causes, two scenario validation catches return rejection, and three directory fan-out metrics. No metric-only refactoring was made.

## Rendered evidence

Final private artifact: `/tmp/solarreach-viewport-scratch-final5.html` (81.36 MB), SHA-256 `4f43a5aa44c0466cf76d06aa079811419680735c436679870ad43396e425656c`. Served only on worker loopback port 43330. No shared preview, browser/window, app server or build was changed.

The private browser matrix exercises 2D polar, polar Home, inspector scrolling, Widen, close/reopen, whole Moon, whole-Moon inspector, paused Lander frame 0, Lander inspector scrolling and split with inspector. Each state captures an actual screenshot and DOM/render observations. Assertions include no right overflow, document `scrollY = 0`, actual canvas bounds within the visual viewport, and global projected vehicle bounds, including separation from the actual map-action controls. Separate checks confirm the declared safe rectangle lies in that viewport and the vehicle does not overlap the inspector.

| CSS viewport | Canvas with widened inspector | Inspector layout |
| --- | --- | --- |
| 1920×992 | 1920×681.25 | Existing desktop overlay |
| 1728×1000 | 1728×667.56 | Existing desktop overlay |
| 1280×1000 | 1280×667.56 | Existing desktop overlay |
| 800×1000 | 320×531 | Right dock, 480 px |
| 390×844 | 390×210.05 | Bottom panel, 178.55 px |
| Native 200%, 960×496 CSS | 384×203.73 | Right dock, 576 px |

Native zoom uses a fresh Chrome profile's real default zoom preference, with no viewport emulation: unchanged outer window, DPR 1→2, inner size 1920×993→960×496, visual scale 1. Native screenshots use Chrome `Page.captureScreenshot` to include the physical viewport; Playwright's element-oriented screenshot sizing at native zoom was insufficient evidence.

- Main matrix: `/tmp/solarreach-viewport-evidence-final5/report.json` and 50 screenshots.
- A final native screenshot exposed the previously floating comparison action overlapping the on-screen vehicle. The final toolbar row and explicit model/action non-overlap assertion close this additional layout defect. Earlier on-screen bounds alone were insufficient.
- Native zoom: `/tmp/solarreach-viewport-evidence-native-final5/native-report.json` and 12 screenshots.
- Pointer proof: `/tmp/solarreach-viewport-pointer/report.json`, screenshots and actual exported decision JSON. Four normal clicks after Home/pan/zoom, polar/global at 1920 and 800, reproject within 0.0026 CSS pixel of the requested click. The gate allows 0.01 CSS pixel for browser pointer dispatch precision; longitude differences near the pole are not a screen-space error measure.
- Additional interactions: `/tmp/solarreach-viewport-extra/report.json` and screenshots cover keyboard separator resize (+32 px), close/reopen width restoration, internally scrolled site list, both instruments, map information, actual 1280→800 resize retaining image centre and scale, and focus-mode restoration.
- Logs: `/tmp/refine-viewport-test-final5.log`, `/tmp/refine-viewport-types-final5.log`, `/tmp/refine-viewport-lint-final5.log`, `/tmp/refine-viewport-matrix-final5.log`, `/tmp/refine-viewport-native-final5.log`, `/tmp/refine-viewport-pointer.log`, `/tmp/refine-viewport-extras.log`, `/tmp/refine-viewport-slop{,-lint}.log`.

These are agent checks in software-rendered Chrome, not human/operational acceptance, a screen-reader audit or hardware GPU performance evidence. The compact split view necessarily offers less screen area. At native 200% with all floating cards left open, the vehicle remains visible but small (about 36 CSS px wide); telemetry and location cards can overlap one another. The existing telemetry dismissal frees space, and no text size was reduced. Root retains the combined artifact rebuild and final integrated review, including its separately owned F4 debris-camera work.
