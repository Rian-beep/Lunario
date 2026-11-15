# Optional online Moon surface

This module supplies visual-only Cesium Ion Moon tiles (asset **2684829**). It does not change the existing runtime, UI, package manifest, local terrain, collision mesh, flight solution, model horizons or full-mission assessment. The parent integrator owns opt-in controls and runtime mounting. The module is not imported by the application yet.

## Integration contract

```ts
import { createIonMoon } from "@/components/workbench/scene/ion/create-ion-moon";
import { validateIonConfiguration } from "@/lib/ion/config";

// Run only after the person explicitly enables online tiles and supplies a token.
const config = validateIonConfiguration({ accessToken: tokenFromRuntimeInput });
if (!config.ok) {
  showConfigurationError(config.error);
} else {
  const moon = createIonMoon({
    camera, renderer, lat, lon, referenceRadiusKm,
    ...config.value,
    onStatus: status => showIonStatus(status),
  });
  scene.add(moon.group);
  // In the parent's existing render loop, after camera/parent transforms update:
  moon.update();
  // On site/reference-height changes only:
  moon.setFrame(nextLat, nextLon, nextReferenceRadiusKm);
  // On opt-out, token replacement, context teardown, or scene unmount:
  moon.dispose();
}
```

`createIonMoon` returns synchronously. `group` retains its identity through loading, failure and `setFrame`. Imports and factory construction perform no network requests, decoder preload, storage access or account lookup. **The first `update()` starts requests**. Do not call it during ordinary startup or merely because the module has been imported. No second animation loop or renderer is created. Date, lighting, vehicle and flight edits should continue updating the existing scene; they do not require recreating this surface. A new token requires disposal and a new instance.

`ready` is a boolean getter, not a Promise. `status` is an immutable snapshot with `phase` (`idle`, `loading`, `ready`, `error`, `disposed`), `ready`, `fallbackRequired` and a human-readable `error` or null. Root metadata and downloaded-but-invisible models do not make it ready. Readiness means at least one visible tile in the current renderer traversal, **not complete viewport coverage or validated heights**. Keep the committed local Moon available throughout, including loading, uncovered regions and failures; do not destroy the local asset when ready first becomes true. `setFrame` clears readiness until the next traversal. `onStatus` fires on changes, and its exceptions cannot interrupt cleanup. The current initial status is always readable immediately.

Errors are terminal for the instance, hide the streamed group, abort requests and drain queues. The error deliberately omits provider URLs, response bodies and exception details. The parent can offer retry by disposing/recreating after the user corrects connectivity or credentials. `dispose` is idempotent. `update`/`setFrame` after failure/disposal are inert.

## Credentials and decoder

The parent supplies `accessToken` explicitly at runtime. `validateIonConfiguration(unknown)` rejects missing/empty/whitespace tokens, unknown option names, and invalid decoder directories. It accepts only `accessToken` and optional `decoderUrl`. It validates shape, **not token permissions, expiry or availability**; those remain unknown until an explicit online update. No environment-variable fallback, example token, URL token input, persistence or borrowed account is provided. The successful configuration contains the input token and must remain transient: never serialize it into saved inputs, exports, telemetry, logs, screenshots, snapshots, source or Git. Do not capture token input or authenticated request URLs in browser evidence.

`decoderUrl` defaults to the committed `/data/equipment/draco/` directory; overrides must be a local absolute directory or public HTTPS directory ending in `/`, without credentials/query/fragment. The current directory contains the **JS decoder only**, so this module explicitly uses JS Draco with one worker, loaded only if compressed content needs it. An override directory must contain `draco_decoder.js`; it does not switch this module to WASM. Decoder fetches use the lifetime abort signal. The offline app remains independent of this opt-in online surface; attempting online tiles from a `file:` page depends on browser origin/CORS and decoder path access and is not a supported offline guarantee.

## Frame and reference height

The tile body frame is metres, +X at prime meridian/equator, +Y at 90° east/equator, +Z north. Existing NASA model axes are `[bodyX, bodyZ, −bodyY]`. `ionBodyToLocalMatrix` uses the existing `nasaSiteFrame`, converted back to body-axis basis vectors:

```text
sceneX = dot(bodyMetres, east) / 1000
sceneY = dot(bodyMetres, up) / 1000 − referenceRadiusKm
sceneZ = −dot(bodyMetres, north) / 1000
```

This is the inverse local basis (rows), uniform 0.001 scale and translation `(0, −referenceRadiusKm, 0)`, with positive determinant; no reflection, guessed Euler rotation or second lunar-radius normalization. Latitude is degrees north, longitude degrees east (wrapped equivalents accepted). Supply the **same current reference radius as numerical terrain**, normally `(1_737_400 + referenceHeightM) / 1000`, not display observer height or a radius inferred from imagery. The stable parent group applies this transform, retaining all original tile/root/glTF transforms beneath it. Parent and tile world matrices update before traversal. Poles retain the supplied longitude as the local east/north heading convention.

The algebra is tested against the existing NASA basis and independent body cardinal vectors at both poles and ±180°. This does **not** certify the remote asset's actual frame, datum, mesh heights, image alignment, collision suitability or horizon sampling. Before production use, the parent must visually crosscheck identifiable landmarks, east/north motion, pole/dateline transitions and several known LOLA heights at the same physical reference radius. Authenticated rendering, seams/depth overlap against the local fallback, near-ground behavior, target-GPU performance and token-scoped availability remain unverified. No operational, terrain-collision or model-horizon certification is claimed.

## Streaming and attribution

- Independent instance queues/cache; shared renderer defaults remain untouched.
- Four tile download jobs total across origins, one parse job, one deferred node-processing job; 100 nodes processed immediately per traversal.
- LRU maximum 300 tile entries / 128 MiB tracked resource estimate, retention targets 240 entries / 96 MiB. These are admission/eviction thresholds, **not a hard process/GPU/RAM ceiling**: in-flight transfers, temporary decode allocations, manifests, textures and active content can exceed the estimate before accounting/eviction. No catalog-wide traversal or full-resolution terrain preload is requested. Auxiliary glTF resource and decoder fetches are not tile queue jobs.
- `errorTarget = 2` screen pixels; resolution follows the renderer's CSS viewport, capped at 1920 pixels on its longest dimension, with no device-pixel-ratio multiplier. No fade plugin, high-resolution forced depth or speculative prefetch is added. Default ancestor fallback remains enabled.
- `attribution` returns NASA/USGS/Cesium text plus current visible asset attributions returned by the Ion plugin. Provider entries preserve `type: "html" | "text"` and string `value`; known input/provider credentials are redacted. The parent must show credits while streaming is displayed, refresh them as tiles become visible, and **sanitize provider HTML before DOM insertion**, or render it as escaped text. No untrusted HTML is inserted by this module.

## Pinned implementation evidence

Verified against installed `3d-tiles-renderer` **0.5.4**, Three **0.187.0**, and their actual declarations/source. No dependencies changed. Primary reference: NASA-AMMOS's tagged [`example/three/ionLunar.js`](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/v0.5.4/example/three/ionLunar.js), which uses `TilesRenderer`, `CesiumIonAuthPlugin` and lunar asset 2684829. Its token is not used or copied. Its global display rotation is replaced here by the existing site's mathematically defined local transform.

Relevant upstream source:

- [`CesiumIonAuthPlugin`](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/v0.5.4/src/core/plugins/CesiumIonAuthPlugin.js) and [`CesiumIonAuth`](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/v0.5.4/src/core/plugins/auth/CesiumIonAuth.js): endpoint resolution, bearer injection and attribution. The local subclass supplies the missing endpoint abort options, rejects non-3DTILES responses, catches raw failures before upstream diagnostics, and prevents initialization after disposal.
- [`TilesRendererBase`](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/v0.5.4/src/core/renderer/tiles/TilesRendererBase.js) and [`TilesRenderer`](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/v0.5.4/src/three/renderer/tiles/TilesRenderer.js): shared defaults, queue/cache admission, disposal and late-parse handling. The local adapter supplies geometry/material cleanup missing from the aborted-parse branch; its cleanup hook outlives plugin teardown only while obsolete parses are pending.
- [`GLTFExtensionsPlugin`](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/v0.5.4/src/three/plugins/GLTFExtensionsPlugin.js): Draco/glTF registration. Decoder ownership remains local (`autoDispose: false`).
- [Three r187 `DRACOLoader`](https://github.com/mrdoob/three.js/blob/r187/examples/jsm/loaders/DRACOLoader.js): actual JS-only compatibility path and worker lifecycle. Local abortable loader avoids the deprecated setter warning, aborts decoder downloads and checks obsolete initialization before worker use.

Several implemented hooks are missing from the 0.5.4 declarations. Their exact runtime signatures are narrowly declared in `pinned-runtime.ts`; no `any`, dependency patches or shared type overrides are added. Recheck these adapters when upgrading either package.

## Verification

Run both commands: the project's existing top-level test glob does not include nested `tests/ion/` files.

```sh
npx tsx --test tests/ion/*.test.ts
npm test
npm run typecheck -- --incremental false
npm run lint
```

Focused tests bundle the actual installed renderer and plugin implementation, use a stub viewport and mocked fetch/parser results, and restore globals. They never make account/service requests, load production terrain, create a WebGL context or launch a browser/server. Real GPU/authenticated visual proof is deliberately left to the parent integration gate. Science/ephemeris files are unchanged, so no new Horizons verification is asserted.

Worker verification, 15 November 2026: **14/14 focused tests passed**, zero skipped, and **825/825 existing repository tests passed**, zero skipped. Nonincremental typecheck and full repository lint passed. Tests cover poles/dateline/cardinal handedness and height units; invalid/unknown configuration; actual pinned endpoint/root parsing using synthetic responses; no requests before explicit update; visibility-based readiness; stable reframing; terminal fallback; credential redaction; four download jobs across origins; cache thresholds; queued-work cancellation; decoder download cancellation; and normal/late geometry/material disposal. The Node test harness emits Three's existing CJS import deprecation warning; runtime code uses ESM imports. `slop-scan` was unavailable/unconfigured; no tooling was installed. No existing runtime, UI, helper, package, generated offline file or shared planning contract was edited. Durable lane decisions and remaining integration gates are recorded here within the owned paths; the shared project memory hub was not edited under this lane's ownership restriction. These are source/unit checks, not browser, target-hardware, scientific or user acceptance.
