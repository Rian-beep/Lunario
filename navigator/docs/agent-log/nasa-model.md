# NASA original Moon asset pipeline — 2026-11-14

Workspace: `/home/luke/Storage/solarreach-navigator-20261114-worktrees/nasa-model`, branch `codex/nasa-model`. Baseline: `1c2ae8deb802d6860b8d0db1a5fd4cb73f948d8a`. This worker owns only the seven files requested. No UI, scene, package, server, browser, Simulator, Metro, or native build changes. Parent integrates the scene.

## Source and extraction

Official product: [NASA SVS 14959](https://svs.gsfc.nasa.gov/14959/), “Moon 3D Models for Web, AR, and Animation,” color map and height map variant. Credit: **NASA's Goddard Space Flight Center**. Original [topographic GLB](https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/Moon_NASA_LRO_8k_Topo_Small.glb), 81,505,784 bytes, SHA256 `c4b65fb4df622a37fd75366c2ed9bf9e163e41c0fde178b3b27e31b0173e6953`.

The local input was `/home/luke/Storage/solarreach-navigator-20261114/.parallel/nasa-moon-topo.glb`. It is not committed. The script checks the pinned source hash before extraction and fails on changed input; updating that hash requires inspecting the replacement source. It uses Node built-ins only. Reproduce from the repository root:

```bash
UV_THREADPOOL_SIZE=1 NODE_OPTIONS=--v8-pool-size=1 GOMAXPROCS=1 \
  node scripts/prepare-nasa-model.mjs \
  --input /home/luke/Storage/solarreach-navigator-20261114/.parallel/nasa-moon-topo.glb
```

Omitting `--input` downloads the official pinned GLB. `--output-dir /tmp/solarreach-nasa-repro` allows an isolated reproducibility check. Output metadata contains no changing timestamp or local path. Same-runtime re-extraction reproduced all three asset files byte-for-byte (Node 20.20.2).

The GLB JSON reports one mesh, one triangle primitive, one node with **no transform**, generator `Khronos glTF Blender I/O v4.3.47`. BIN payload starts at file byte 1460. Accessor offsets below are relative to BIN:

| Accessor | Semantic | Type | Count | Byte offset | Byte length |
| --- | --- | --- | ---: | ---: | ---: |
| 0 | POSITION | Float32 VEC3 | 2,021,340 | 0 | 24,256,080 |
| 1 | NORMAL | Float32 VEC3 | 2,021,340 | 24,256,080 | 24,256,080 |
| 2 | TEXCOORD_0 | Float32 VEC2 | 2,021,340 | 48,512,160 | 16,170,720 |
| 3 | indices | Uint32 SCALAR | 3,047,424 | 64,682,880 | 12,189,696 |
| bufferView 4 | JPEG | embedded image | — | 76,872,576 | 4,631,745 |

Every bit-identical XYZ triple is welded to its first occurrence. This leaves **507,906 vertices and all 1,015,808 triangles**. Original Float32 position bytes, index order, and winding are retained exactly under the remapping. There is no epsilon welding, quantization, decimation, procedural displacement, or synthesized terrain. Source normals and UV seam duplication are omitted; a renderer can compute smooth vertex normals once. Original material is double-sided, metallic 0, roughness approximately 0.9.

Outputs:

- `public/data/nasa-moon-mesh.bin.gz`: **9,587,461 bytes** (18,284,616 bytes decoded).
- `public/data/imagery/nasa-moon-8k.jpg`: **4,631,745 bytes**, **8192 × 4096**, copied unchanged from the GLB.
- `public/data/nasa-model.json`: provenance, source and output SHA256 hashes, accessor locations, counts, axis evidence, scale convention, and limitations.

## Coordinate alignment — measured, not assumed from Blender

[NASA's source CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) specifies the color map is centered on 0° longitude. Interpret source UV as `longitudeEast = (u - 0.5) * 360`, `latitudeNorth = (0.5 - v) * 180`. Six recorded original POSITION/TEXCOORD samples constrain all axis signs:

| Original vertex | UV approximately | Original position approximately | Interpretation |
| ---: | --- | --- | --- |
| 504 | (0.5, 0.5) | (0.979349, 0, 0) | prime meridian = +X |
| 1496 | (0, 0.5) | (-0.985701, 0, 0) | 180° = -X |
| 984 | (0.25, 0.5) | (0, 0, 0.981525) | 90° west = +Z |
| 12 | (0.75, 0.5) | (0, 0, -0.972937) | 90° east = -Z |
| 216822 | (0.485352, 0.003906) | (0.023867, 0.986469, 0) | north = +Y |
| 217002 | (0.485352, 0.996094) | (0.023987, -0.988229, 0) | south = -Y |

Thus the exact **coordinate convention**, implemented by `nasaLatLonToXyz`, is:

```text
NASA XYZ = r * [cos(lat)*cos(lon), sin(lat), -cos(lat)*sin(lon)]
Conventional Moon-fixed [X,Y,Z] -> NASA [X,Z,-Y]
```

Angles in the equation are radians; the exported helper takes degrees north/east. The mapping is right-handed. It identifies the visualization texture's prime meridian; it does not independently establish a dynamical ephemeris frame or improve the scientific geometry.

The script compares the inferred direction against **all 2,021,340 source UV/position pairs**. Maximum angular disagreement is **1.5536320823°**, RMS about **0.233951°**. This is an existing deformation/UV mismatch, concentrated near the pinched poles; the convention must not be presented as exact per-vertex scientific geolocation. Tests anchor the mapping to source samples, not just helper roundtrips. Exact original sample values and welded indices are in metadata.

For direction-derived global texture coordinates, compute **per fragment** in NASA object coordinates:

```text
u    = 0.5 + atan2(-z, x) / (2*pi)
vTop = 0.5 - atan2(y, hypot(x,z)) / pi
```

JPEG top row is north. With Three texture `flipY = false`, sample `(u, vTop)`; with `flipY = true`, sample `(u, 1-vTop)`. Use horizontal repeat, vertical clamp. Do not assign one UV per welded vertex and interpolate across the ±180° seam. Compute direction before local-frame rotation, or supply the inverse rotation. Direction UVs intentionally differ slightly from NASA's distorted original UVs.

## Scale and scene integration

Returned `positions` remain **original unitless NASA Float32 coordinates**. No divisor is already applied. `radiusNormalizationDivisor = 0.9822867872752492`, computed in Float64 as the triangle-area-weighted mean of vertex radii over the original triangles. Normalized coordinates are `positions / radiusNormalizationDivisor` and have nominal mean radius 1. The scene conversion is explicitly:

```text
pKm = sourcePosition * model.positionToKm
positionToKm = referenceRadiusKm / radiusNormalizationDivisor
             = 1737.4 / 0.9822867872752492
             = 1768.7298887724514
```

Source min/max radii: **0.9652995145539758 / 1.0003156891895486**. Under this display convention their km radii are **1707.3541030092 / 1769.2882576776**. NASA does not provide a physical calibration of the GLB's unitless relief on the product page. This is an explicit nominal visualization scale, **not physical terrain-height recovery**; the relatively large radius range is preserved from NASA rather than corrected or synthesized. Do not multiply source positions directly by 1737.4 or divide them twice.

`nasaSiteFrame(siteLat, siteLon)` returns NASA-axis orthonormal `east`, `up`, and `north` vectors. For a fixed site frame and a site ground radius `siteRadiusKm = 1737.4 + localLolaHeightM / 1000`:

```text
localKm = [dot(pKm, east), dot(pKm, up) - siteRadiusKm, dot(pKm, north)]
```

The reverse placement is `pKm = east*localEastKm + up*(siteRadiusKm+localUpKm) + north*localNorthKm`. **East/up/north is left-handed**. If baking that transform into vertex positions, reverse each triangle's winding for a renderer expecting right-handed front faces; if using an object matrix with negative determinant, retain the renderer's normal/front-face handling. Do not silently treat this reflection as a quaternion rotation. The asset itself retains NASA's original winding.

NASA [explicitly documents pinched poles](https://svs.gsfc.nasa.gov/14959/). Keep **local numerical LOLA** authoritative for site ground rendering, contact, and heights. This global mesh is visual context only, including its supplied relief amplitude. Parent must handle local/global overlap at the landing site. All Sun/Earth, horizon, lighting scores, trajectories, and landing calculations continue to use their existing scientific inputs. Visual review and user acceptance remain with scene integration.

Loader API (no Three import):

```ts
const model = await loadNasaModel({ signal });
// model.positions: Float32Array, model.indices: Uint32Array
// model.positionToKm, model.radiusNormalizationDivisor, model.referenceRadiusKm
// model.metadata, model.textureUrl
const mesh = decodeNasaMesh(uncompressedArrayBuffer);
```

Online: fetch `/data/nasa-model.json`, then `/data/nasa-moon-mesh.bin.gz`; JPEG URL is returned for the parent's texture loader. Serve `.bin.gz` as a gzip **file**, without an additional `Content-Encoding: gzip` for these stored bytes (the loader performs the decompression). Configure caching normally. No network tile service is used.

Offline: parent standalone bundler can set this before calling `loadNasaModel`:

```ts
window.__SOLARREACH_NASA_MODEL__ = {
  metadata: /* parsed nasa-model.json */,
  meshGzipBase64: /* base64 of committed .bin.gz bytes */,
  textureDataUrl: /* data:image/jpeg;base64, + committed JPEG base64 */,
};
```

The offline path makes no fetch calls, decompresses with browser `DecompressionStream("gzip")`, and returns the data URL. Missing gzip support, corrupt compression, invalid base64, metadata disagreement, malformed binary, or HTTP errors fail explicitly. Parent owns the UI error state and standalone bundler integration; neither is edited here.

## Binary contract — NASAMOON v1

All numeric fields are **little-endian**; no padding after the header.

| Byte offset | Type | Meaning |
| ---: | --- | --- |
| 0 | 8 ASCII bytes | `NASAMOON` |
| 8 | Uint32 | version = 1 |
| 12 | Uint32 | header bytes = 48 |
| 16 | Uint32 | welded vertex count |
| 20 | Uint32 | index count, divisible by 3 |
| 24 | Float64 | radius normalization divisor |
| 32 | Float64 | nominal reference radius in km = 1737.4 |
| 40 | 2 × Uint32 | reserved, both zero |
| 48 | vertexCount × 3 × Float32 | unchanged source NASA XYZ |
| 48 + vertexCount × 12 | indexCount × Uint32 | triangles in original order/winding |

Exact decoded length is `48 + vertexCount*12 + indexCount*4`. Decoder checks header, reserved fields, positive finite scale, exact length (including rejecting trailing bytes), nonzero finite positions, and every index bound. It reads endian explicitly into typed arrays and has no renderer dependency.

## Verification and delivery

- `npm run typecheck`: passed under the requested thread limits.
- `node --import tsx tests/nasa-model.test.ts`: **10/10 tests passed**, no skips; default Node tests run serially. This direct Node-loader command avoids the tsx CLI's IPC path. `node --import tsx --test --test-concurrency=1 tests/nasa-model.test.ts` also exited 0, but on this Node 20/tsx combination reports a single file wrapper; the direct command exposed all ten named cases and counts.
- Tests cover malformed binary length/header/counts, non-finite positions and scales, zero radius, invalid indices, NASA source axes, recorded source UV/position samples, nominal lunar km scale, polar site basis, output hashes, online and offline loading, HTTP errors, corrupt gzip/base64, metadata disagreement, missing gzip support, and cancellation.
- Independent Python/NumPy comparison against the original GLB verified bit-identical unique positions, **every triangle's vertex positions in original order and winding**, and byte-identical extracted JPEG. This comparison uses sorted Float32 bit triples, independent of the script's Map welding algorithm.
- A second extraction to `/tmp/solarreach-nasa-repro` reproduced all three assets byte-for-byte.
- `npm run lint`: passed with zero errors and eight warnings in untouched `components/navigator.tsx`. The exact same eight warnings were reproduced by the same command in a separate checkout of baseline `1c2ae8d`. The owned files have no lint warnings.
- `node --check scripts/prepare-nasa-model.mjs` and whitespace checks passed. No configured slop-scan was found.
- Instruction parity check passed. Memory recall found a historical SolarReach sales-platform hub, which describes a different product and was not reused as lunar-project knowledge. Scope/sandbox do not permit editing the shared vault; durable handoff details are recorded in this owned log for the parent to persist.

Shared git metadata is read-only. Delivery uses a standalone temporary clone at `/tmp/solarreach-nasa-delivery`, with only the seven explicit owned paths staged. Bundle: `/tmp/solarreach-nasa-model.bundle`, containing one commit on `codex/nasa-model-assets` with prerequisite baseline `1c2ae8d`. No push and no update to the shared worktree's git refs/index.

Parent integration:

```bash
git fetch /tmp/solarreach-nasa-model.bundle codex/nasa-model-assets
git cherry-pick FETCH_HEAD
```

Only fetch/cherry-pick once: the owned source/assets already exist uncommitted in this worktree, and the bundle provides their committed equivalent for the parent checkout.
