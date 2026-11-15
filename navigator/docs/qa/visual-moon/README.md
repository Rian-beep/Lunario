# NASA visual Moon delivery — 15 November 2026

This is an opt-in display upgrade, isolated from the scientific terrain and assessment paths. The parent must wire the fifth `createNasaGlobe` argument in its owned runtime and rebuild its hosted/offline artifacts. The existing four-argument path still uses the unchanged authored NASA assets. No runtime/UI controls, scientific loaders, package files or generated app outputs were edited.

## Integration

```ts
createNasaGlobe(lat, lon, referenceRadiusKm, signal, {
  device: {
    maxTextureSize: renderer.capabilities.maxTextureSize,
    textureBudgetMiB: 128,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
  },
  prepareTexture: texture => renderer.initTexture(texture),
});
```

128 MiB is an explicit conservative texture budget, not a measured device-memory claim. It selects through 4096×2048 when the device permits. Lower memory devices can use 32 MiB (through 2K); use 512 MiB only when the parent has positively budgeted the rest of the scene and wants 8K. Width is also bounded by the renderer's actual maximum. Account separately for the existing authored geometry, local terrain, celestial models, framebuffer and other scene resources. The budget covers old/new RGBA mip chains **and both retained decoded browser images** during a swap; it is an estimate, not a total-process memory limit. No 16K/32K/float colour texture is allocated.

The returned `visualStatus` (also `mesh.userData.visualMoon`) has actual colour source, loaded primary width, relief source and explicit fallback warnings. Replace the runtime's hardcoded “original topographic Moon / 8K image” status with those facts. The mesh retains its legacy name for compatibility; it is not the source/calibration label. `maxRadiusKm` reflects the selected radial derivative with 1 m allowance for Float32 rotation/storage, or the legacy source on fallback. Keep local qualified terrain near the surface: this global display cannot establish clearance, touchdown or geology.

The first map is 1024×512, then one replacement at a time through the bounded ladder. Each completed map is verified against its actual decoded width/height before optional GPU pre-upload and publication. Previous owners are released after publication. A failed upgrade retains the last successful tier. A failed initial tier shows an untextured grey globe with a warning; it never silently uploads the legacy 8K atlas on a constrained device. Relief failure retains authored relief with a warning. An older runtime abort after initialization does not kill a transferred globe's progressive owner; final `dispose()` cancels pending upgrades and releases all leases. Existing shared atlas caching/refcount semantics are reused unchanged. Date, lighting and camera updates never create asset requests.

Hosted transport uses `publicAssetURL`. For a disconnected HTML upgrade the parent offline builder must inject, before application startup:

```ts
window.__LUNARIO_VISUAL_MOON__ = {
  radiiGzipBase64: /* committed radii-1x.bin.gz bytes as base64 */,
  textures: {
    '/data/visual-moon/colour-2025-1024.webp': 'data:image/webp;base64,...',
    // Include only the bounded tiers intended for that offline artifact.
  },
};
```

Missing embedded higher tiers retain the available lower tier without an HTTP request. Without this injection the legacy four-argument offline path continues unchanged. Do not enable the new path in the standalone file until the parent has regenerated and verified this hook. Hosted builds must copy all selected new assets without changing canonical URLs or the existing NASA manifest.

## Verified sources and transforms

[NASA SVS 14959](https://svs.gsfc.nasa.gov/14959/) identifies the original topographic model and warns about pinched poles. The original `Moon_NASA_LRO_8k_Topo_Small.glb` source is 81,505,784 bytes, SHA256 `c4b65fb4df622a37fd75366c2ed9bf9e163e41c0fde178b3b27e31b0173e6953`. Existing compressed authored geometry, 1,015,808 triangles, frame, body directions, JPEG and original metadata remain intact. The opt-in derivative radially reprojects the same 507,906 vertices; indices and angular directions are unchanged. This intentionally replaces the artistic radial amplitudes, not the scientific DEM or any navigation frame.

[NASA SVS 4720](https://svs.gsfc.nasa.gov/4720/) describes the December 2025 colour TIFFs as sRGB and the full float16 EXR as linear. Its 2025 update improves colour/dynamic range and polar detail. This is an aesthetic product: LROC colour outside ±70° is filled with lower-resolution monochromatic LDAM, and small high-latitude gaps are inpainted. It cannot support visibility, power, ice, composition or regolith claims. Higher texture resolution does not supply missing polar geology.

Actual final inputs, downloaded only under `/tmp/visual-moon-sources/`:

| Input | Verified payload | SHA256 |
| --- | ---: | --- |
| `lroc_color_16bit_srgb_8k.tif` | 8192×4096, RGB16, embedded sRGB IEC61966-2.1 profile; 243,289,792 bytes | `db7808e878b6a55eb409bb231eab8deb477f84b5c9d7396d76ff73e5d54992d9` |
| `ldem_64.tif` | 23040×11520, IEEE Float32; 1,061,775,722 bytes | `af55ea2ed9173d1744b98ac4205501bd0bb0dcfc6ac49a11473a411dc64afd90` |

The colour TIFF is decoded directly to RGB16 codes using GeoTIFF. Lower tiers use exact sRGB decoding to Float32 linear RGB and repeated 2×2 area reduction; output uses exact sRGB encoding and RGB8 rounding. Native 8K directly rounds RGB16 codes without spatial resampling. WebP is lossless **relative to RGB8**, not the source RGB16. No JPEG re-encoding, sharpening, tint, contrast boost or synthesized detail. The complete colour ladder is 41,393,260 bytes: 511,424 / 1,970,572 / 7,873,346 / 31,037,918 bytes at 1K / 2K / 4K / 8K. Nine native source pixel triplets, profile hash, decoded pixel hashes and all derivative hashes are in the committed manifest. Preparation verifies every WebP decoded byte against its RGB8 input.

The final radial derivative samples **signed float kilometres relative to 1737.4 km**, using pixel-centred bilinear interpolation with longitude wrapping and clamped polar rows. Radius is exactly `1737.4 + elevationKm`, multiplier 1. The unsigned `*_uint.tif` products instead use half-metres relative to 1,727,400 m and are rejected. Source elevations span −9.1145000458 to +10.7570009232 km; sampled mesh radii span 1728.8523270421–1747.8295284317 km before Float32 rounding. This replaces the legacy artistic 1707.354–1769.288 km span. The 1,393,258-byte gzip contains one Float32 radius per original vertex, with source/mesh/index hashes and 11 calibration samples. Float32 radial rounding is bounded by approximately 6.11 cm; that does not imply terrain accuracy. Subpixel alignment, source resolution, authored topology and source polar limitations remain.

The material is smooth, diffuse, roughness 1 / metalness 0, with no noise, normal map, bump map, displacement texture or invented microgeometry. The sRGB primary texture is decoded once by WebGL. Per-fragment spherical mapping keeps source orientation, and analytic UV gradients avoid an implicit-mipmap longitude seam jump. The new source retains RGB; no grayscale conversion, ACES curve or exposure adjustment is applied to the new material. Epoch lighting still shades this aesthetic colour map and is not photometric validation. The old grayscale/tone-mapped epoch behaviour stays on the legacy path. Polar stretching is visibly reduced by 1× relief but remains; no claim of eliminating NASA's authored angular artifact.

`source-receipts.json` contains fresh HTTP 200/headers for both pages, both final input files, the existing GLB and the larger colour alternatives. The actual EXR is 988,589,585 bytes; the actual 16K TIFF is 953,573,340 bytes. These were HEAD-verified, not downloaded or silently shipped. The 8K input was chosen as the actual primary-resolution ceiling, not relabelled as a marketing “32K” asset. An earlier temporary `ldem_16.tif` preparation was replaced by the final `ldem_64.tif` derivative.

Reproduction uses installed dependencies only:

```bash
node scripts/prepare-visual-moon.mjs /tmp/visual-moon-sources/lroc_color_16bit_srgb_8k.tif /tmp/visual-moon-sources/ldem_64.tif
npx tsx --test tests/visual-moon*.test.ts tests/nasa-model.test.ts tests/nasa-atlas-abort.test.ts
node docs/qa/visual-moon/verify-browser.mjs
node docs/qa/visual-moon/verify-browser.mjs /tmp/lunario-visual-moon-browser-8k 8192 512
```

## Evidence and remaining integration checks

Fresh focused suite: **21/21 pass**, including all new asset/lifecycle cases plus unchanged NASA model/abort tests. Fresh full `npm test`: **995/995 pass**, zero failed/skipped/cancelled. Nonincremental full typecheck and lint pass. Diff whitespace checks pass. No configured/installed `slop-scan` was found. The new radial data is strictly visual; ephemeris, assessment, local terrain, scientific geometry and model identity did not change, so a Horizons science rerun was not performed or claimed.

The browser verifier runs a private Chromium/SwiftShader instance with intercepted local transport, without an app server or shared browser/profile. It exercises the actual NASA model, new radii and WebPs, actual compiled custom shader, 1K→4K progression, actual primary dimensions, the seam and pole, source colour transfer, 24 view/appearance updates with zero refetch, fallback legacy loading and GPU disposal. Test-colour output is exactly `[209,160,90,255]`. At 4K, identical repeat frames differ by zero codes; a 0.01° orbit differs by mean 0.05834 codes at the seam and 0.0004453 codes at the pole. These are bounded fixture screens, not proof of zero artifacts over every camera/device. The persistent one-texture post-disposal count equals the pre-globe baseline: Three r187's shared DFG LUT; geometry returns to zero. No shader or page errors.

A second fresh run with explicit 512 MiB budget verifies the native **8192×4096 primary map actually uploads and renders** on the fixture's 8192 maximum texture device. All four tiers load; repeat delta remains zero, 0.01° seam delta is 0.0583432 codes and pole delta 0.0004568 codes, with the same clean disposal baseline and zero shader/page errors. Raw run receipts and selected inspected screenshots are committed under `evidence/`; all near/far/seam/pole shots remain under `/tmp/lunario-visual-moon-browser{,-8k}/` for the parent. Neither run requested a 16K or larger runtime asset.

The constrained-device screen sets a 512 maximum texture edge: it compiles/renders the actual no-map fallback, reports `colour: unavailable`, and requests zero WebPs/JPEGs. Lifecycle fixtures cover failed transport/dimensions, cancelled startup, cancelled upgrades, late completion and idempotent disposal. Their request wait uses timer ticks with a bounded timeout and cleanup on assertion failure; an earlier busy-immediate polling loop was caught as flaky during final verification and replaced.

Final screenshots/results are delivered with the QA evidence. They show actual source colour, near/far hemisphere alignment, source polar stretching and the more severe legacy polar shading for comparison. Browser timings use intercepted in-memory transport and software rendering; they are **not** production-network or target-device latency measurements. No integrated browser acceptance, handheld-device validation, near-surface geology, qualified surface contact, user acceptance or operational certification is claimed. Parent retains real runtime/UI source labels, live renderer/frame transfer, final hosted/offline builds and actual disconnected artifact review.

The new asset/material API has no epoch input and creates no date-triggered I/O; its cached resources survive ordinary appearance updates. The fixture tests those owned methods and view updates. The parent must still verify actual Navigator date scrubbing produces zero refetch after wiring, together with live cross-site renderer handoff.
