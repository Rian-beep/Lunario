# Map screening integration verifier

Worker: `codex/map-integration-qa`, base `aa17575`, 15 November 2026. Only this directory and `scripts/verify-map-screening.mjs` are owned. No application changes, dependencies, servers, authenticated tiles or generated tracked HTML.

```bash
SOLARREACH_STANDALONE_OUTPUT=/tmp/lunario-map-qa-offline.html npm run standalone
node scripts/verify-map-screening.mjs --mode all \
  --url http://127.0.0.1:4356/ \
  --file /tmp/lunario-map-qa-offline.html \
  --out /tmp/lunario-map-qa-final-r6
```

Use a fresh output directory. `--mode web` and `--mode file` run either transport. Any failed assertion/browser error exits nonzero. Evidence is refused inside the actual Git root, including the directory above `navigator`. Request receipts omit queries and external provider paths. No HAR, storage, full DOM or credential input capture.

The browser uses installed `/usr/bin/google-chrome` and `playwright-core`, with explicit SwiftShader/no-sandbox flags. Tests use ordinary buttons, selectors, keyboard input and real canvas pointer picking. Passive canvas paint observation records raster pixel hashes, alpha support and the current public map transform; it does not read or alter React internals. Cancellation begins during active sampling, changes dates and viewport, and compares every raced publication against a separately settled replay of the final date/viewport.

Coverage: real loader/introduction; cold hosted DEM request deferral; 1,980 polar centres; all four physical factors plus the combined index; legend units/unknown support; opacity and weight recolouring without HTTP; 170 ice references and both publication/dataset sources; both 2D maps; dismiss/minimize/restore; explicit Globe overview, both pole labels/buttons, landmark labels, east/west dateline traversal; north/south mesh ray picks and split-map region changes; native 100%/200% layout zoom and control geometry. The file transport blocks HTTP before navigation and must attempt zero HTTP after ranking, ice and globe use. The offline file embeds its DEMs; it does not establish hosted payload laziness.

Native zoom uses isolated profile preferences, a fixed physical 1,600-pixel window, DPR/layout-width measurements and unclipped CDP screenshots. Device emulation and viewport resizing are not substituted for browser zoom. Fresh contexts establish a cold browser cache only; there is no link-throttling or hardware GPU performance claim. Screen-reader and general accessibility acceptance remain outside this run.

## Receipts

Final result: **40 pass, 4 fail, CLI exit 1**. The cold file flow passes all 17 checks; all three file contexts attempt zero HTTP. Both native zoom proofs pass: physical screenshot/window width stays 1,600; CSS width 1,600→800, DPR 1→2, visual scale 1. Native 100% controls pass in both transports. All observed data paths are qualified under `/navigator/public/data/`; the supplementary receipt verifies them even though the hosted console assertion fails first. Hosted entry in all three web contexts: `/web/assets/main-INPOHF65.js`.

Failures to hand back to the integrator:

- **200% legend controls, web and file:** fresh Public → 2D South pole → Layers → enable ranking → select solar disk → dismiss Layers → click Minimize legend. The header's **Show a delayed landing** button intercepts the pointer. CSS legend rectangle `(16,83.43,336,273.07)`; minimize button `(185.87,94.83,119.74,28)`. See `web-native200-native-zoom-measurement-and-controls-fail.png` and its file equivalent in the evidence directory. No forced clicks or injected layout fixes.
- **Hosted console/request failure:** the full hosted command's Globe/pole/dateline/split journey records `/navigator/public/data/celestial-models/assets/earth.glb` → `net::ERR_ABORTED` and `NASA earth asset failed AbortError: BodyStreamBuffer was aborted`. The exact triggering transition is not isolated; the complete ordered UI reproduction is in the verifier. No failed HTTP responses or unhandled page errors occurred. Do not suppress this console failure to obtain green.
- **Hosted startup duration:** outer loader 6.590 s, inner loader 4.545 s, exceeding the verifier's 6.5 s ceiling. Other runs were faster; this observation does not isolate network versus CPU cost or prove a product regression.

Final browser results and screenshots: [/tmp/lunario-map-qa-final-r6/report.json](/tmp/lunario-map-qa-final-r6/report.json). Execution log: [/tmp/lunario-map-qa-final-r6.log](/tmp/lunario-map-qa-final-r6.log). The JSON pins the executed verifier SHA-256, local source base, offline SHA-256 and per-session hosted script/data paths; the hosted build is controlled by the parent and can change between contexts.

[/tmp/lunario-map-qa-final-r6/receipt-summary.json](/tmp/lunario-map-qa-final-r6/receipt-summary.json) confirms the delivered verifier matches the executed SHA-256, the offline artifact is unchanged, all observed nested data paths are qualified, and all file contexts attempt zero HTTP. Actual GPU device: ANGLE Vulkan SwiftShader/SwANGLE; WebGL enabled, WebGPU unavailable in software.

Temporary offline HTML SHA-256: `66a97c64116f0ff6c2816e34b4e21b29f00b8500bf7ad42644a555ea82443b85` (81.52 MB). It is outside Git. Browser evidence is likewise outside Git and is not included in the worker bundle.

Fresh source checks: `node --check scripts/verify-map-screening.mjs`; scoped ESLint; `npm run lint`; `npm run typecheck -- --incremental false`; CLI help, invalid mode, credential URL, in-repository output and unknown-option cases all pass. `npm test` was not repeated (parent reported 912 green); no scientific formulas changed. `slop-scan` is not installed/configured.

Earlier exploratory receipts are not final results. An older hosted root showed a roughly 46-second loader and `/web/branding/lunario/assets/logo.svg` 404; later contexts no longer reproduce that 404 or long safety timeout. The loader gate accepts 2.8–6.5 seconds, including its reveal animation; the final cold hosted observation of 6.590 seconds still fails this gate. Link/CPU timing is not isolated by this measurement. Verifier selector/readiness and screenshot-clip corrections were made before the final run. No application fix is claimed by this worker.
