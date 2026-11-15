# Planning text contrast and keyboard audit

On 14 November 2026 the rebuilt HTTP preview and final standalone file each passed 11 measured text/surface checks. The standalone ran in a fresh headless Chrome context with networking disabled. Both reports contain zero page errors, HTTP error responses and failed checks. This is measured coverage of specified states, not a WCAG-conformance claim.

Reproduce with the installed browser/tooling:

```
node scripts/verify-panel-contrast.mjs --base-url http://127.0.0.1:4317 --output /tmp/solarreach-panel-contrast-http-final
node scripts/verify-panel-contrast.mjs --file /absolute/path/solarreach-navigator.html --offline --output /tmp/solarreach-panel-contrast-offline
```

The verifier uses an isolated 1600×1000 Chrome context, sRGB screenshots, computed text color/font size/weight and Sharp pixel sampling. It never attaches to a user profile, starts a server, installs dependencies, or changes OS settings. JSON reports preserve sample coordinates, actual pixel RGB, CSS alpha layers, applicability thresholds and screenshots. Opaque planning cells must match computed RGB and the intended solid #faf9f4 background within two quantization levels. Glass samples use unobscured blank margins adjacent to the text, supplemented by conservative black/white backdrop bounds through the actual CSS alpha stack. Backdrop blur/saturation is not claimed to be measured; arbitrary bounded sRGB input is allowed underneath the known layers. Unsupported foreground alpha, ancestor opacity/filter/blending, images or unreliable blank samples remain unverified rather than receiving an invented ratio.

| Measured text/state | Minimum contrast | Required |
| --- | ---: | ---: |
| Planner verdict and requirement explanatory copy | 10.95:1 | 4.5:1 |
| Deployment input text on its rendered fill | 7.29:1 | 4.5:1 |
| Requirements, evidence and calendar table cells | 11.54:1 | 4.5:1 |
| Calendar explanatory copy | 11.22:1 | 4.5:1 |
| Calendar heading (below large-text size threshold) | 11.27:1 | 4.5:1 |
| Comparison explanatory copy | **4.777:1** | 4.5:1 |
| Comparison 26 px heading | 8.35:1 | 3:1 |
| Comparison result value | 9.03:1 | 4.5:1 |

The limiting actual comparison sample was foreground rgb(96,111,80) over screenshot background rgb(242,241,236), measured 4.777:1. The independent conservative backdrop bound was 4.800:1 under rgba(250,249,244,.97); the lower actual pixel result governs. Opaque table-corner pixels were exactly rgb(250,249,244). All 11 samples passed on both targets with no unverified samples in those selected states.

Fifty visible form controls across requirements (10), operations (8), external reports (5), calendar (3) and comparison (24) had browser-computed accessible names, accepted focus, and returned to themselves after actual Tab then Shift+Tab. Optional outage/radio limits and charge/discharge caps were enabled temporarily to audit their newly visible fields, then restored. These checks establish those keyboard paths and names; they do not test real screen-reader speech, complete tab order, every error state or all app controls.

Evidence directories: `/tmp/solarreach-panel-contrast-http-final/` and `/tmp/solarreach-panel-contrast-offline/`, each containing report.json and per-surface screenshots. Whole-planner state/download/teaching workflow evidence is documented in [browser-flows.md](browser-flows.md). Native browser zoom methodology and limits are documented in [browser-zoom.md](browser-zoom.md); the existing `/tmp/solarreach-final-browser/report.json` records true 200% Chrome layout zoom (1600 physical pixels, CSS width 800, DPR 2, visual scale 1). This contrast worker did not repeat that profile-based zoom test or claim it covered every later UI change.

Remaining manual gates: actual screen-reader interaction and announcements; semantic comprehension of charts and unknown evidence; full tab-order/focus-visibility review; hover/focus/error/disabled states and nontext graphics; additional backdrop/imagery conditions and all responsive layouts; and visual inspection of new animation/celestial controls. VoiceOver and global OS accessibility settings were not toggled. A visual screenshot or named-control audit is not a screen-reader pass.
