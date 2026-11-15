# Visual Moon GPU upload follow-up

The native Clevo fixture reproduces 0.40–0.53-second frame stalls in the progressive HTML-image colour path. An additive `bitmapDecode: true` option reduces the median maximum gap in the three seconds after globe readiness by **78.6%** with a stationary camera (**402.6 → 86.0 ms**) and **83.1%** with a continuous camera orbit (**471.0 → 79.6 ms**). This is a measured source-image upload improvement, not evidence that the parent's reported M1 Pro 1.1-second gap has been resolved.

Production implementation source: **545807bbe4ee88d16fb1fd708e7d1355cb898555**; camera-motion/labelled-control harness: **37f0159**; evaluation base **3c82b5aa02c4da52053fd3c12c180cca18fd6d4e**. `evidence/baseline-native.json` substitutes the exact base `visual-moon/assets.ts` at bundle time; other production inputs are unchanged from the base, except the new bitmap module, which that control does not import. `evidence/bitmap-native.json` runs the committed implementation with its additive option enabled. Raw traces include source hashes, upload call timings, RAF/render observations, decode timings, request paths, framebuffer hashes and disposal counts.

## Device and scope

Measured here on CLEVO-X2, AMD Ryzen AI MAX+ 395, Chromium **149.0.7827.155**, WebGL renderer **ANGLE (AMD, Vulkan 1.4.335 (Radeon 8060S Graphics (RADV STRIX_HALO) (0x00001586)), radv)**. Requested launch flags: `--no-sandbox --enable-gpu --use-gl=angle --use-angle=vulkan`. The harness requires a native renderer unless `SWIFTSHADER=1` is explicitly selected. No SwiftShader measurement is represented as hardware evidence.

Three fresh private contexts per final lane for both stationary and continuously orbiting camera modes; 800×800 canvas, DPR 1, antialiasing, existing NASA 2025 colour, unchanged 1× radial relief, 1,015,808 triangles, existing per-fragment spherical-UV shader, same camera/light setup inherited from the existing isolated fixture. Transport is intercepted HTTPS with committed local assets, not a real network connection. OS/disk and driver caches remain warm; no CPU throttle or controlled workstation isolation. Contexts are fresh; this is not a cold-internet or cold-machine claim.

The readiness marker is the fixture's `createNasaGlobe` return with its first 1K map. The three-second window includes progressive upgrades. There is no intentional three-second product loader in this isolated fixture. RAF callback gaps and synchronous `renderer.initTexture`/WebGL call durations are CPU-side observations, not GPU fences, completed GPU work, scanout or presentation FPS. The parent-owned app/harness was not changed or run.

## Reproduction and cause

The original path spends almost all its measured `initTexture` time inside **`texSubImage2D` with an HTMLImageElement source**. At 8K this call takes about 399–402 ms in the final three controls. Explicitly decoding that HTML image first does not remove the upload stall. Creating an ImageBitmap **from the loaded HTML image** reduces subsequent upload time but moves the stall into the conversion. Passing the fetched **Blob directly** to `createImageBitmap` allows frames to continue during decoding and avoids that expensive HTML-image upload path.

This intervention establishes a browser source-preparation/upload-path bottleneck. It does not establish that raw GPU bus transfer, lazy decoding alone, or mipmap execution accounts for the entire duration. `generateMipmap` returns near the timer resolution here, but that cannot prove its GPU execution is free. First rendered-frame work is around 20 ms, far below the reproduced 400 ms gap. There is no shader, geometry, camera or visual-resolution change in the fix.

Stationary-camera timing ranges, milliseconds (three samples each):

| Observation | Exact base HTML image | Opt-in Blob bitmap |
| --- | ---: | ---: |
| 1K `initTexture` | 9.4–9.6 | 2.1–2.1 |
| 2K `initTexture` | 25.4–25.6 | 1.1–1.8 |
| 4K `initTexture` | 102.3–107.4 | 10.5–11.7 |
| 8K `initTexture` | 399.2–401.8 | 35.1–41.2 |
| Maximum gap, first three seconds after ready | 400.8–417.9 | 77.9–86.0 |

The final single-sample diagnostic controls also retain source/frame evidence: explicit HTML decode yields a 414.0 ms maximum gap with a 399.3 ms 8K upload; HTML-image→bitmap conversion yields a 450.3 ms gap despite a 39.9 ms upload (the conversion itself takes 393.9 ms). These explain why simply adding decode() or converting the already-loaded image is insufficient.

Separate direct-Blob decode probes after the measured upgrade window, median milliseconds on the fixed lane:

| Tier | Main-context asynchronous API | Dedicated worker API |
| --- | ---: | ---: |
| 1K | 8.4 | 7.9 |
| 2K | 26.6 | 26.4 |
| 4K | 98.0 | 99.1 |
| 8K | 386.8 | 385.5 |

These are decode promise elapsed times, not CPU utilization. Worker wall time additionally includes worker startup and transfer; fetch time is recorded separately. The API invoked on the main context is asynchronous with a Blob. The runtime fix creates **no JavaScript worker**, because the worker experiment provides no material decode-time advantage. The worker is a measurement-only control.

A local **150 ms** diagnostic screen deliberately fails on the exact base (421.1 ms in the recorded RED run) and passes all three fixed samples. This screen distinguishes this regression on this fixture; it is not a general device/UX acceptance target. Residual 78–86 ms gaps still exist.

## Implementation and ownership

Only `components/workbench/scene/visual-moon/assets.ts` and the new sibling `bitmap-atlas.ts` change production behavior. The default path remains unchanged. `bitmapDecode: true` selects a separate shared lease cache using the **existing unchanged WebP tiers**, fetch abort, direct-Blob decode, dimension/encoded-length checks, one active fetch/decode, and at most four pending manifest-tier jobs. Releasing queued work removes it before fetch. A running browser decode cannot be cancelled by JavaScript; its consumer settles immediately, no replacement decode starts until it finishes, and any late bitmap is closed. Last-owner release disposes the GPU texture, clears the source and closes the bitmap once. No date/camera value enters a URL/cache key.

The bitmap is decoded with `imageOrientation: 'flipY'`, `premultiplyAlpha: 'none'`, `colorSpaceConversion: 'none'`. WebGL ignores Texture.flipY for ImageBitmap, so orientation is baked during decode and its texture has `flipY=false`. The existing SRGBColorSpace, repeat/clamp wrapping, mip/filter settings and shader remain unchanged. There is no upload of closed bitmaps during ownership transfer: a ready asset owns its lifetime independently of the old runtime's abort signal.

Unsupported bitmap APIs use HTML images through 4K with an explicit warning. A first-tier bitmap failure retries the original HTML path through 4K with a warning. A later tier failure retains the successful lower map. Embedded offline assets bypass bitmap fetch/decode and retain their deterministic 4K ladder. No worker, WASM/transcoder, CDN or credentials are introduced. Same-origin Blob fetch may be restricted by CSP connect-src; that failure follows the conservative fallback. No worker-src or WASM permission is needed. Fetch uses `credentials: 'omit'`.

The existing explicit device budgets remain authoritative: unknown-memory/offline devices retain 4K; 8K still requires the existing large budget and texture-size capability. The fix is **not a compressed GPU texture** and does not claim reduced resident GPU memory. The prior conservative decoded-image/GPU-chain estimate at the 4K→8K swap is about 373.3 MiB; the new encoded Blob adds up to 29.6 MiB at that tier, still below the existing 512 MiB authorization. That is accounting, not measured process/driver peak memory, and it excludes unrelated scene resources and browser staging. No 16K/32K allocation was added.

### Parent wiring

Add only this option to the existing fifth `createNasaGlobe` argument, preserving its real renderer capabilities, explicit device budget and pre-upload callback:

```ts
{
  ...existingVisualMoonOptions,
  bitmapDecode: !embeddedOffline,
  prepareTexture: texture => renderer.initTexture(texture),
}
```

Use the existing embedded-file mode for `embeddedOffline`, not connectivity inference. Omitting `bitmapDecode` or setting it false is the matched HTML-image negative control with the same NASA 2025 colour and 1× relief. The four-argument legacy globe is a different visual path and is not the matched negative control. There is no parent runtime/UI/build wiring in this delivery.

## Fidelity, fallback and verification

All four committed WebP hashes, decoded RGB8 hashes and original geometry/radial hashes pass unchanged. No encoding was performed and no asset changed. Existing RGB16→RGB8 quantization is still display-only; the NASA colour map remains aesthetic data, not a scientific surface measurement.

Across all six native baseline/fixed views and all three runs, the full 800×800 RGBA framebuffer hashes are identical: near side, far side, south pole, longitude seam on both sides, and physically lit south pole. All **nine** actual source colour/UV probes match their expected RGB8 values exactly. Repeated renders are identical and camera/appearance changes issue zero new requests. Two rendered PNGs are retained for inspection; polar source stretching is inherited and unchanged. This does not claim near-surface geological fidelity or temporal acceptance in the integrated app.

Fresh checks:

- Focused visual/source/device/lifecycle tests: **23/23**, zero failed/skipped/cancelled. Twelve new behavioral tests cover sharing, single active decode, queued/active cancellation, late close, startup abort, live transfer, upgrade failure, dimensions, HTTP/length failure, unknown-tier rejection, unsupported API, offline behavior and disposal.
- Full local `npm test`: **1,375/1,375**, zero failed/skipped/cancelled. This is this worker's run, not the parent's baseline receipt.
- Nonincremental typecheck and owned ESLint pass. Full repository lint was not run; no attribution of its reported incoming diagnostic is made here. `slop-scan` is neither installed on PATH nor configured in this package; none installed for this task.
- Native before/after: three samples each in both stationary and continuously orbiting modes, strict hardware identification, matching source imagery/shader, identical rendered frames/landmark colours, complete geometry/texture disposal back to the single shared renderer DFG texture.
- Disconnected **file:// fixture**, both `bitmapDecode=false` and true, real embedded source assets, existing 128 MiB/4K device budget: identical renders, exactly 1K/2K/4K uploads, **zero HTTP requests**, **zero bitmap decodes**, no errors/warnings, disposal to zero geometries and one shared renderer texture. This is not the parent-generated offline application.
- Exact-base RED browser loop exits 1 for the recorded 421.1 ms gap. Fixed three-sample loop and comparison exit 0. No numerical/scientific module changed; no Horizons run or scientific qualification is claimed.

### Commands

Run from `navigator/`; all output paths are under `/tmp`. Each command starts only its own private browser, never an app server:

```sh
npx tsx --test tests/visual-moon*.test.ts
npm test
npm run typecheck -- --incremental false
npx eslint components/workbench/scene/visual-moon/*.ts tests/visual-moon*.test.ts scripts/evaluation-performance-gpu/*
BASELINE_REF=3c82b5a RUNS=3 node scripts/evaluation-performance-gpu/measure.mjs /tmp/lunario-gpu-exact-base-final
RUNS=3 BITMAP=1 MAX_GAP_MS=150 node scripts/evaluation-performance-gpu/measure.mjs /tmp/lunario-gpu-accepted
node scripts/evaluation-performance-gpu/compare.mjs /tmp/lunario-gpu-exact-base-final/results.json /tmp/lunario-gpu-accepted/results.json /tmp/lunario-gpu-comparison.json
# Expected RED, exit 1:
BASELINE_REF=3c82b5a RUNS=1 MAX_GAP_MS=150 node scripts/evaluation-performance-gpu/measure.mjs /tmp/lunario-gpu-red
node scripts/evaluation-performance-gpu/offline.mjs /tmp/lunario-gpu-offline
ORBIT=1 BASELINE_REF=3c82b5a RUNS=3 node scripts/evaluation-performance-gpu/measure.mjs /tmp/lunario-gpu-orbit-base
ORBIT=1 RUNS=3 BITMAP=1 MAX_GAP_MS=150 node scripts/evaluation-performance-gpu/measure.mjs /tmp/lunario-gpu-orbit-fixed
node scripts/evaluation-performance-gpu/compare.mjs /tmp/lunario-gpu-orbit-base/results.json /tmp/lunario-gpu-orbit-fixed/results.json /tmp/lunario-gpu-orbit-comparison.json
# Diagnostic controls, no production loader patch:
RUNS=1 DECODE=1 node scripts/evaluation-performance-gpu/measure.mjs /tmp/lunario-gpu-html-decode-final
RUNS=1 DECODE=bitmap node scripts/evaluation-performance-gpu/measure.mjs /tmp/lunario-gpu-image-bitmap-final
```

## Parent follow-up: distinguish the failed conversion control

The parent note correctly flags a 450.3 ms gap despite a 39.9 ms upload. That run is explicitly `DECODE=bitmap`: the deliberately unsuccessful **HTMLImageElement → ImageBitmap** conversion control, with `mode.bitmap=false`. It is **not** the delivered `BITMAP=1` path, which decodes a **fetched Blob directly**. The HTML-image conversion itself blocks frames for about 394 ms. Upload duration alone would incorrectly approve it; the full frame-gap gate rejects it. The final harness now prints this distinction in `controlDescription`, and supports `ORBIT=1` for a continuous existing-camera orbit during model loading and progressive colour upgrades. No universal smoothness claim is made.

The requested moving-camera follow-up is green on the same native Radeon with identical renderer/shader/geometry and a continuous **0.05 rad/s** orbit of the existing fixture camera: **534.6, 468.7, 471.0 ms** maximum post-ready gaps on the exact-base source, versus **78.0, 79.8, 79.6 ms** on the direct-Blob path. The latter 8K upload calls are **34.1–35.5 ms**. All three fixed samples pass the same 150 ms screen; the full frame hashes/landmark checks still match after returning to the six fixed probe views. See `evidence/orbit-{baseline,bitmap}-native.json` and `evidence/orbit-comparison.json`.

No `canUpgrade`/idle-gating option was added: no additional model-refinement stall was reproduced by this moving-camera fixture. Parent-owned provider streaming, flight/control state and the complete app remain unmeasured. The residual roughly 80 ms gap remains open; this follow-up is bounded render-loop evidence, not universal smoothness or full-app acceptance.

## Compression decision and remaining acceptance

**No KTX2 asset, transcoder or compressed loader ships.** Official Three KTX2Loader/ImageBitmapLoader/WebGLTextures source was read, and official Khronos KTX Software 4.4.2 tools were downloaded only under `/tmp`. No lossy GPU encoding was performed. The measured smaller intervention removes most of the reproduced critical-path delay while preserving every rendered pixel; adding a codec/transcoder/quality trade-off is not justified for this fix. No claim is made that a compressed tier could not further reduce payload or GPU residency; that experiment remains open if a new memory/upload target warrants it.

Parent still owns Mac M1 Pro confirmation, its original 1.1-second symptom, actual web/offline generated builds, complete app navigation/site transfers/date scrubbing/context restore, real transport/cold network and target-device acceptance. The local residual stall and large uncompressed 8K residency remain limitations. Do not promote these fixture checks to user acceptance or a universal performance pass.

Primary references: [Three ImageBitmapLoader](https://threejs.org/docs/pages/ImageBitmapLoader.html), [Three KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html), [HTML image decode specification](https://html.spec.whatwg.org/multipage/embedded-content.html#dom-img-decode), [Khronos KTX Software 4.4.2](https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2). `primary-sources.json` pins the installed Three source hashes and downloaded tool identity; tools are not delivered as dependencies.

Parent notes were absent at implementation/initial testing/implementation-commit checks. The subsequently received decode-control warning was read, investigated and answered with the labelled controls and the moving-camera follow-up above; the optional idle-gate suggestion was considered but no unproven production API added. Notes checked again before final delivery. No shared-vault writes were made, per this worker's explicit scope. This report/findings/evidence are the durable handoff for the parent to integrate into shared memory. No runtime.ts, nasa-globe.ts, parent performance harness, shared UI, package, scientific/binding, generated web/offline, push or merge changes.
