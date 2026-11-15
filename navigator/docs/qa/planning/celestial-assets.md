# Actual NASA Sun/Earth models and bounded source-Git inventory (T22)

The Sun and Earth are the original binary glTF files linked by NASA's [Sun model page](https://science.nasa.gov/learn/heat/resource/sun-3d-model/) and [Earth model page](https://science.nasa.gov/learn/heat/resource/earth-3d-model/). They are retained byte-for-byte, with embedded PNG textures and no mesh simplification or image conversion. Each is under the 20 MB acquisition bound:

| Asset | Committed path | Original bytes | SHA-256 |
|---|---|---:|---|
| Sun | `public/data/celestial-models/assets/sun.glb` | 4,343,656 | `a178f5c43c2c9a6ee6c011c315149a7ab5a2594fd5aa9119ee219625a18da1dd` |
| Earth | `public/data/celestial-models/assets/earth.glb` | 12,916,400 | `05a5aea99db8ab472487a06debc3b5d0b2cae7636a1a6b9ecfa40b7d1722ba23` |

The source Sun has an emissive PNG material; Earth has a base-color PNG and a normal-map PNG. Both contain mesh/accessor data and all image bytes in their GLB containers. They require no Draco, WASM or external texture downloads. Earth is credited NASA/JPL-Caltech on its official page; Sun is an official NASA Science HEAT/Eyes resource without a more specific artist attribution established here. [NASA media-use guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) applies. No endorsement is implied and no licence for unrelated third-party app code is inferred.

## Runtime API for parent integration

`lib/celestial-assets.ts` exports `CELESTIAL_ASSETS.sun/earth` with `{kind,name,path,bytes,sha256,page,source,credit,displayDiameter:2,scope}` and:

```ts
const handle = await loadCelestialAsset('sun' /* or 'earth' */, abortSignal);
sceneGroup.add(handle.group);
// The group has nominal diameter 2; its parent can scale to a chosen display radius.
handle.dispose();
```

The loader preserves authored geometry, textures, materials and node rotations, centres its bounds and uniformly scales its maximum diameter to **2 display units**. This is a nominal display normalization, not recovered physical units. In particular the Sun's source node includes a 90° X rotation and 1000× authored scale, while Earth uses a different raw geometric size; both are retained inside the normalization wrapper. No verified body-fixed/epoch texture orientation is claimed. The parent must not substitute these CGI model coordinates for JPL-derived direction, range, physical size or science times. Any decorative rotation must remain a visual convention.

The promise throws on failure rather than returning a procedural NASA-labelled replacement. Parent owns loading/ready/error presentation and should keep its existing Sun/Earth position authorities. `AbortSignal` applies to file fetch; cancellation is also checked before and after parsing. A model that finishes parsing after cancellation is disposed before throwing `AbortError`. Returned disposal is idempotent and releases geometry, materials, textures and owned image bitmaps. No scene/runtime, navigator, manifest or standalone-builder file was modified by this workstream.

For direct-file offline output, inject `globalThis.__SOLARREACH_CELESTIAL_MODELS__` before initialization, mapping both exact root-relative paths to `data:model/gltf-binary;base64,...` URLs:

- `/data/celestial-models/assets/sun.glb`
- `/data/celestial-models/assets/earth.glb`

Normal web mode fetches these committed local paths. `file:` mode rejects missing embedded assets explicitly; it never silently fetches NASA's remote host. Embedded texture blob URLs are handled by GLTFLoader and require no URL rewrite or additional dependency. Static loader imports can be bundled by the existing esbuild workflow. Parent owns actual offline/browser/GPU validation and must account for approximately 17.26 MB of original GLB bytes (roughly 23 MB before HTML compression when base64-inlined).

## Source acquisition and provenance

Run `node scripts/prepare-celestial-models.mjs` to reacquire the exact two NASA CDN originals. It streams with a 20,000,000-byte limit per asset, verifies byte count/SHA-256 and GLB/self-contained structure, and performs no installs/conversions. CDN assets have content hashes rather than a fabricated Git revision. Full provenance is `public/data/celestial-models/provenance.json`.

The [official NASA Git repository](https://github.com/nasa/NASA-3D-Resources) was actually cloned to a separate temporary directory with `--filter=blob:none --no-checkout --depth 1 --single-branch`, then checked out with a README-only sparse pattern. It is pinned at **`11ebb4ee043715aefbba6aeec8a61746fad67fa7`**. Complete nontruncated Git-tree metadata is archived in `public/data/celestial-models/source-git/nasa-tree.json`; the original repository README is retained beside it. This records all 1,583 tree entries and 5,003,809,285 declared blob bytes without bulk-downloading the five-gigabyte asset repository.

This pinned NASA Git tree contains Earth printing archives, Earth textures, Moon printing/textures, Apollo Lunar Module and other spacecraft/equipment entries. It contains **no Sun/Earth globe GLB**, so the separate official NASA educational/CDN downloads above are identified honestly. The complete tree and the relevant Sun/Earth/Moon/lunar/lander/rover/equipment subset are in `inventory.json`. Already acquired Apollo geometry remains in the existing equipment directory and the existing NASA Moon globe is unchanged; neither was duplicated or relabeled. The inventory is a source catalogue, not a promise that all five gigabytes are shipped.

## Original requested Git: changed since earlier audit

The requested [Rian repository](https://github.com/Rian-beep/NASA---Space---App-Challenge) is no longer a README-only repository at the current refs. A fresh read-only refs query returned nine heads; a tenth (`cursor/mission-climate-2608`) appeared by the subsequent blobless, no-checkout clone. All ten pinned branch trees were inventoried without executing upstream code or merging/changing the owned app. Luke's private `origin` was preserved. `source-git/original-branches.json` records every file's path, Git blob SHA and declared size for each of those snapshots; `inventory.json` lists the branch-to-commit pins. This is an audit snapshot, not a claim that upstream will stop changing.

Main is pinned at `09b158c828f6af72df0b42afc2b3da533c8c4169`. None of the ten trees contains a `.glb` or `.gltf` file. Original Earth/Moon visualizations use images and app geometry; they must not be represented as NASA-authored mesh assets. Earth files include a credited 2048×1024 Blue Marble texture and a static cloud mosaic, explicitly not selected-date weather. Source branch names concerning weather/climate do not expand this lunar-only app's scope.

All inventoried branches share identical Git blobs for these science families:

| Family | Main path | Declared bytes | Integration meaning |
|---|---|---:|---|
| Numerical terrain | `src/lib/science/fixtures/terrain.json` | 1,448,961 | 432×432 = 186,624 heights; 80 m postings; south-pole window only |
| Terrain sidecar | `src/lib/science/fixtures/terrain-preparation.json` | 3,885 | MOON_ME/DE421, 1,737,400 m sphere, pixel-centre origin (−14,840,16,840) m, 12 km horizon search radius |
| Cached ephemerides | `src/lib/science/fixtures/ephemerides.json` | 527,038 | 36 grouped site/body/date windows in December 2026, not replacement global/all-year coverage |
| Example locations | `src/lib/science/fixtures/sites.json` | 1,387 | Three derived example analysis sites, not NASA-designated landing pins |
| Demonstration manifest | `src/lib/science/fixtures/demoManifest.json` | 3,677 | Demo scenarios and notes, not canonical current-app assumptions |

Six raw Horizons fixtures for example-a/b/c × Sun/Earth are also present, about 183 KB each. Numerical terrain heights are native 80 m postings rounded to 0.01 m per source metadata, with no spatial resampling claimed there. The distinct 216×216 PNG preview uses 160 m block-mean hillshade and explicitly **must not be sampled as numerical terrain**. The existing app's canonical data model, frame uncertainty and scientific verification gates remain authoritative; do not import this window or its source formulas blindly. No licence file for the original application code was located in the pinned trees, so NASA imagery credit is not treated as a blanket app-code redistribution licence.

## Verification scope

Commands: `npm run typecheck`; `node --import tsx --test tests/celestial-assets.test.ts`; `node_modules/.bin/eslint lib/celestial-assets.ts tests/celestial-assets.test.ts scripts/prepare-celestial-models.mjs`; `git diff --check`.

Tests use the **actual GLTFLoader** and both committed original models. In Node, only GPU bitmap allocation is substituted: Sharp actually decodes each embedded PNG before a dimensioned bitmap stand-in is supplied. Mesh vertices, material textures, normalization, complete local-only dependencies, late cancellation and idempotent disposal are exercised. The tests also verify source hashes, missing-file/offline errors, and the complete pinned Git inventories. This does not substitute for browser/GPU orientation, image appearance, direct-file loading or scientific body-frame validation. No server, user browser/profile, build, Simulator, Metro or dependency installation is used.

Verified on Clevo, 14 November 2026: project typecheck passed; all five celestial-asset tests passed with no skips; targeted ESLint passed; local `git diff --check` passed. Both NASA originals were independently reacquired by the preparation script and matched their pinned byte counts/SHA-256. The official sparse clone's actual tree object is `20cddf392bdd9474d6e2e7c4bdad7d06f183b06b`, separately recorded from commit `11ebb4ee043715aefbba6aeec8a61746fad67fa7`. Authorship was local, validation remote. Node emitted Three's CJS deprecation notice; the actual loader test uses structural Three object flags so disposal also works across ESM/CJS module instances. Browser/offline GPU integration remains with the parent.

Renderer handoffs share immutable, length- and SHA256-verified source bytes. One view's AbortSignal immediately cancels its wait/use, not the shared owner fetch needed by its successor. Owner fetches bypass disk-cache writes, have a30s deadline and a strict streaming byte bound; failures evict the cached promise. Parsed geometry/textures remain per-view and dispose independently.
