# UI scientific-audit lane

15 November 2026 · source baseline `96079aec827d9decc2a139b737174a8578f6a67c` · branch `codex/audit-ui` · isolated Clevo Chrome 149.0.7827.155. The locked parent contract is unchanged.

**9 verified UI implementation claims, 3 uncertain claims, 3 failing discrepancies. Zero physical/scientific claims certified.** Passing rendering, clipboard or numerical unit tests cannot establish mission-critical applicability. This lane did not change science, source data, canonical assessment, model identities, scene runtime, global CSS, package files or generated artifacts.

## Demonstrated fix

White chart figures inherited incompatible dark-theme text/surfaces. A real integrated web screenshot reproduced pale chart notes and nearly invisible exact sample values. The new browser regression failed against the seeded implementation before the fix; its full RED output and computed paint are retained in `evidence/contrast-before.tap` and `evidence/supporting-text-before.json`.

| Selected text | Before foreground / background (sRGB) | Before contrast | After foreground / background | After contrast |
|---|---|---:|---|---:|
| Chart notes / source caveats | 208,195,181 / 255,255,255 | 1.72765:1 | 28,25,21 / 255,255,255 | 17.51085:1 |
| Exact sample readout | 28,25,21 / 20,22,25 | 1.03514:1 | 28,25,21 / 255,255,255 | 17.51085:1 |

`components/chart-image-actions.tsx` adds four scoped CSS lines for chart notes, sample readouts and gradient explanation descendants. The chart hierarchy, actions, geometry, inputs and science remain intact. The regression opens the gradient help and checks its actual text as well as sample values. This is a selected computed-color check with inspected screenshots, not a complete raster glyph audit or WCAG-conformance claim. The criterion used is 4.5:1 for ordinary text, from the [WCAG 2.2 contrast requirement](https://www.w3.org/TR/2024/REC-WCAG22-20241212/#contrast-minimum); ratios use its sRGB relative-luminance definition.

## Reproduction and fresh checks

Run from `navigator/`, with existing dependencies and `/usr/bin/google-chrome` (override `CHROME_PATH` if necessary). No app server or app build is started.

```sh
npx tsx --test tests/chart-image.test.ts tests/chart-gradient.test.ts tests/charts.test.ts tests/audience-workspaces.test.ts tests/audience-context.test.ts
node --test tests/chart-image.browser.mjs
node --test tests/audit-ui.browser.mjs
node scripts/audit-ui-contrast.mjs
npm run typecheck -- --incremental false
npm run lint
node scripts/audit-ui-integrated.mjs
```

| Check | Fresh result |
|---|---|
| Focused chart/audience TypeScript tests | 48 passed, 0 failed/skipped/cancelled |
| Existing offline chart browser tests | 6 passed, 0 failed/skipped/cancelled |
| New audit browser tests | 7 passed, 0 failed/skipped/cancelled (parent test plus 6 subtests) |
| Nonincremental typecheck | exit 0, no diagnostics |
| Repository ESLint | exit 0, no diagnostics |
| Integrated candidate journeys | Both completed; exit 1 intentionally reports 5 observations grouped into 2 remaining integration discrepancies below |
| Whitespace / Python verifier syntax | pass |

The integrated verifier must stay red for these candidates. It does not silently skip missing exports and declare success. It can be rerun by the parent against final artifacts using `AUDIT_UI_URL`, `AUDIT_UI_FILE`, and `AUDIT_UI_INTEGRATED_OUT`. Test logs and machine-readable evidence live in this report directory. `slop-scan` was not on PATH; the existing project triage was read, no tool was installed. No ephemeris/geometry changed; no new Horizons validation is claimed.

## Verified implementation and its bounds

- Native ClipboardItem/write/read, without mocks, succeeds for real HorizonGraph, ElevationGraph, ResponsePlot, HorizonPanorama, ElevationChart and ObliqueSketch in an isolated disconnected `file://` fixture. Decoding the native clipboard PNG and the downloaded PNG yields identical dimensions and every RGBA byte (6 of 6). Success text is checked after completion. This is Chromium's headless clipboard, not an external application's paste result. The [Clipboard API working draft](https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/) is the relevant API reference, not physical validation.
- Native permission denial is induced through CDP in the actual isolated browserContextId, without replacing clipboard methods. Copy reports denial and a Download PNG fallback; the subsequent real download succeeds. Existing tests also exercise missing/insecure/unsupported capabilities and synthetic encoding errors.
- All six downloaded chart PNGs are wholly opaque, have white corners, contain dark text and colored plot pixels, and have exactly `ceil(2 × exported SVG size)` pixels on each axis. Plot dimensions are retained inside the wrapper. Both non-square SVG and canvas fiducials independently produce an 80×80-pixel circle from a 40-CSS-unit diameter, against a ±2-pixel anti-aliasing tolerance and ≤1-pixel axis mismatch. Observed errors are 0 pixels. This checks rendering geometry only. [WHATWG canvas serialization](https://html.spec.whatwg.org/multipage/canvas.html#serialising-bitmaps-to-a-file) supplies the PNG/bitmap reference.
- Science and response SVG text is dark on white in both theme attributes at 900- and 420-pixel fixture viewports. SVG screen transforms have equal x/y scale to 1e-6; all three sky canvas backing stores remain 2× their CSS width and height after resize. Missing input samples retain gaps. The original test also checks active-content/external-reference removal and retained clips/metadata.
- Serialized exports retain actual titles, axis labels/units, legends, stated source caveats and unknown-data warnings. ElevationGraph preserves the exact synthetic UTC interval, 2026-11-15 10:00 to 12:00 UTC. This does **not** verify complete standalone provenance; see discrepancy F3.
- The served web candidate actually mounts image actions on HorizonGraph in Replan and ResponsePlot after a real Educator prediction/capture/reveal journey. At 1600 and 800 pixels its HorizonGraph is white with dark labels, two image actions and uniform scaling. A real PNG download is 1332×1392 pixels. Exact plotted values opens and teaching closes back to its opener. Every audience control selects and dismisses its introduction in both web and file transports. No app state or scientific results were injected.
- The new fixture and the seeded complete offline HTML both make **zero HTTP request attempts**, not merely zero successful requests. Integrated runs have zero page and console errors. The offline app's older chart UI remains a failure, not a verified export.

The isolated fixture compiles actual components with esbuild in `/tmp`, loads the repository globals/theme and emitted CSS modules, and removes Tailwind build directives. It is deliberately not the full branded app or a substitute for the integrated journeys. Screenshots of both were inspected. The new numerical-looking fixture inputs are explicit synthetic rendering data, never observational or scientific truth.

## Exact inputs, frames and units

Fixture epoch: `2026-11-15T00:00:00Z`; `index0=10`; 1-hour source spacing; samples at 10:00, 11:00 and 12:00 UTC. Synthetic Sun azimuths 5/15/25°, elevations 2/NaN/4°; Earth azimuths 60/70/80°, elevations 3/4/5°; terrain mask 1/2/NaN/3° at 90° angular spacing; display observer height 2 m. These define local chart axes only: azimuth clockwise from north, elevation above local horizontal; no body-frame or ephemeris correctness is inferred. SVG user units, CSS pixels and raster pixels are separate rendering coordinates. The fiducial uses a 300×100 plot, circle centre (150,50), radius 20 user units; canvas backing store 600×200.

Response fixtures label Load in W and Battery in Wh. W = J/s; Wh = 3600 J; UTC indices use milliseconds internally and hours on the labeled time axis. Degrees are retained as the displayed angular unit (π/180 rad); no unit conversion in scientific code was changed. Real app defaults identify Connecting Ridge, −89.53432° latitude, 209.94767° east longitude, display height 2 m, a 336-hour stay from `2027-06-29T11:00:00Z` through `2027-07-13T11:00:00Z` exclusive. Catalog metadata declares MOON_ME / Horizons MEAN_ME and a 1,737,400 m reference-sphere radius; those labels are reported, not independently established by this lane.

## Failing discrepancies and parent handoff

**F1 — Separate replanning ComparisonPlot bypasses image support.** In both integrated transports its stored-energy chart has no chart-image actions; its figure background is RGB 27/29/32 and SVG is transparent. It is implemented in `components/replanning/curves.tsx`, outside the named science/sky/audience chart ownership. Parent should determine the intended coverage, then wire the existing helper and white chart surface if all charts are intended to export. No source-to-UI or cross-lane file was edited here.

**F2 — Seeded complete offline HTML is stale relative to chart source.** File SHA256 `500ecca4774b7adead4a5268f3ad9b22bc970510a05c6b4d69b074ee77680828` remains byte-identical throughout the run. HorizonGraph has zero image actions at both tested widths, transparent surfaces and pale labels; Teaching ResponsePlot also has zero actions. The web candidate has the image actions. Download execution for the file is explicitly recorded as unexecuted. Parent owns rebuilding/identifying and retesting the final offline artifact. No generated output was changed or committed. `zero HTTP` alone cannot clear this discrepancy.

**F3 — PNGs do not fully identify their scientific scenario.** Horizon/sky/response exported metadata lacks a complete exact site + UTC span + dataset/model/frame identity. Science exports contain source-family/cadence/caveat text and the time plot contains UTC bounds; response exports contain test-choice/gap explanations, but no dataset/model identity. Skyline exports use sample indices; the oblique export is clearly schematic but lacks source-family identification. The declarations were inspected in the real export SVGs, not inferred from on-screen adjacent paragraphs. Complete scenario provenance requires caller context and parent-owned wiring. Preserve uncertainty until supplied; do not invent it from synthetic test values.

The supporting-text fix is verified in source fixtures; parent must integrate and build it, then rerun its final full-app copy/transfer/contrast gate. The published candidate tested here predates this scoped fix. None of F1–F3 was fixed by changing science or hiding a warning.

## Evidence identity and remaining uncertainty

`results.json` contains every locked-contract field, observed errors and status counts. `references/manifest.json` pins saved bounded primary-standard extracts and checksums; each source extract records exact URL, fetched response URL, retrieval UTC, byte length, full-response SHA256 and response headers. Refresh with `python3 scripts/audit-ui-references.py`; network failure is a failure to refresh, never a pass. The WHATWG page is a dated snapshot of a living standard. The Clipboard reference remains a working draft.

`scripts/audit-ui-contrast.mjs` independently recomputes the retained before/after contrast ratios from the paint evidence; `evidence/contrast-ratios.json` records its output.

`evidence/browser-observations.json` records export and decoded-pixel hashes, metadata, dimensions, fiducial measurements, fixture hash and browser version. `evidence/integrated-observations.json` records exact loaded HTML/JS/CSS response hashes and transport. The served candidate changed during earlier probes; final-run evidence applies only to those recorded loaded response identities, not a claimed immutable release or the stale release-manifest sourceCommit. No equivalence between generated artifacts and the worker's current source is asserted. Full snapshots/downloads remain under `/tmp/audit-ui-browser/` and `/tmp/audit-ui-integrated-final/`; their hashes are retained in `evidence/raster-manifest.json` (no image binaries committed).

Early harness failures are distinguished from product discrepancies: the first synthetic catalog omitted required `t0ms` and never mounted; the first CDP denial targeted the default browser context instead of the isolated test context. Both were corrected without weakening product assertions; successful native denial was then reproduced. These are not counted as application failures. Initial integrated strict assertions stopped at the old file artifact; the final verifier completes both journeys and reports the same failures explicitly.

Still unverified: Safari/Firefox/mobile/OS paste destinations, clipboard permission UX on target devices, full raster glyph contrast, native 200% final-build reflow, complete screen-reader/canvas alternatives, human audience acceptance and all physical/mission applicability. Parent owns the final combined artifact and operational/scientific gates. No certification, general WCAG conformance or mission-readiness claim follows from this work.
