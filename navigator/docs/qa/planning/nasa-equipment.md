# NASA equipment geometry

Apollo Lunar Module geometry is the original 716,840-byte GLB published by [NASA Science](https://science.nasa.gov/3d-resources/apollo-lunar-module/), credited NASA/Michael D. Carbajal. The committed model is byte-for-byte identical to the pinned NASA GitHub revision; provenance, checksums, terms and decoder attribution are in `public/data/equipment/provenance.json`. NASA's repository describes these assets as free and without copyright and links its media-use guidelines. This project does not claim NASA endorsement.

The existing procedural spacecraft has been removed. `createLander()` still returns a synchronous kilometre-scaled `group` and illustrative `plume`; the NASA model is added asynchronously. The returned `ready` settles after loading or reporting an error, and `dispose()` aborts fetch and frees late-arriving geometry. There is no silent procedural replacement. `onStatus` and `group.userData.equipmentStatus` report loading, ready, error and disposed; `equipmentError` supplies a readable failure. Runtime must surface these statuses to the user and call this disposal handle on cleanup.

The GLB is Y-up with no transformed nodes. Runtime centres the source X/Z bounds, places its lower Y bound on the ground and uniformly normalizes height to **nominal 7 metres**. Source model units and engineering dimensions have not been independently validated. This is display geometry only: translational physics remain the generic model, and plume/attitude are illustrative. It is not an Apollo flight simulator, landing clearance calculation, or mission reconstruction.

## Offline integration

The normal app fetches only the committed local paths. For single-file offline use, before initializing the app the standalone builder must set `globalThis.__SOLARREACH_EQUIPMENT__` to a map containing:

- `/data/equipment/apollo-lunar-module.glb`: `data:model/gltf-binary;base64,...`
- `/data/equipment/draco/draco_decoder.js`: `data:application/javascript;base64,...`

The NASA GLB requires Draco. The bundled Apache-2.0 JS decoder avoids external CDN or WASM downloads. GLB textures are embedded in its binary, with PNG fallback; texture blob URLs pass through the loading manager. The static GLTFLoader/DRACOLoader imports are bundled by esbuild. A missing equipment asset under `file:` produces an explicit failure instead of fetching a remote substitute. Preserve the decoder license in distributed materials.

Reacquire and verify the source with `node scripts/prepare-equipment.mjs`. This command has no installs or conversions. Targeted verification is `node_modules/.bin/tsx --test tests/equipment.test.ts`; typecheck is `npm run typecheck`. The test decodes every compressed mesh using the actual committed decoder, checks the source hash and embedded images, checks normalization and lifecycle failure/late-disposal paths. Browser/GPU appearance and file-open loading require the parent's integrated runtime/standalone QA.

## Rover boundary

The checked [official NASA 3D model repository](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models) contains the Apollo Lunar Module but no Apollo lunar roving vehicle. A bounded official lunar rover download was not found in this pass. No third-party model or Mars rover is relabeled as lunar equipment. The provenance records this gap explicitly.

Verification on Clevo, 14 November 2026: `npm run typecheck` passed; all 7 targeted tests passed with no skipped tests; targeted ESLint on `lib/equipment.ts`, `vehicle.ts` and `tests/equipment.test.ts` passed. Source reacquisition on macOS verified the pinned hash. `git diff --check` passed. No server, browser, Simulator or Metro was started. The test runner emits Three's CJS deprecation notice; it does not affect these passing checks.
