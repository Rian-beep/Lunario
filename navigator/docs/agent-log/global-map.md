# Global lunar map handoff

Date: 2026-11-14
Workspace: `/home/luke/Storage/solarreach-navigator-20261114-worktrees/global-map`
Baseline: `1c2ae8deb802d6860b8d0db1a5fd4cb73f948d8a`

## Scope and integration

Owned files only: `components/global-map.tsx`, `components/global-map.module.css`, `lib/global-map.ts`, `tests/global-map.test.ts`, and this log. No root, catalog, imagery, PolarMap, package or shared Git metadata changes.

Import the named `GlobalMap` export. Its exported `Props` type matches the requested contract: `sites`, `selectedId`, `compareIds`, `custom`, `onSelect`, `onPlace`. All catalog groups are accepted without a group whitelist or group-based rendering branches. Catalog coordinates and membership remain the parent's responsibility.

Texture loading reads the NASA offline `textureDataUrl` directly, otherwise `/data/imagery/nasa-moon-8k.jpg`. On error it tries the embedded global imagery URL or `/data/imagery/global.jpg`. Both failures leave coordinates, graticule and pins usable with an explicit imagery-unavailable message. The NASA model and imagery imports are type-only; no mesh loading, decoding, network tiles, illumination computation or texture-derived heights are involved. Imagery files are absent in this worker checkout; asset rendering is pending parent integration.

The component imports a CSS module. The parent's standalone bundler must collect/inject its emitted CSS alongside the application CSS when integrating this component. The baseline standalone script does not yet collect imported CSS output. The worker has not rebuilt or edited the offline HTML.

## Behaviour

- A true 2:1 equirectangular surface fits within wide or narrow viewports, with west-to-east longitude and north-to-south latitude. Zoomed views wrap across the dateline; margin clicks never place a lunar coordinate.
- Pointer drag, anchored wheel zoom, two-pointer pinch and midpoint pan, small corner zoom/reset controls, keyboard pan/zoom/reset, keyboard catalog cycling and keyboard custom placement.
- Regional selection moves to the new location at a useful zoom. Nearby selections preserve framing. Resize and unrelated rerenders preserve manual pan/zoom. Polar limits leave room for the pins.
- Screen-space clusters expose counts and zoom on activation. Selected and compared pins remain individual. Labels try four placements and avoid earlier labels/pins/controls. Selected labels have first placement priority and selected pins draw last.
- A DOM “Sites in view” list provides individual buttons, selected state, comparison status and coordinates even when canvas labels collide. The parent retains its full catalog selector. Canvas description documents keys and placement; nearby text identifies the selected location and coordinates.
- Persistent copy distinguishes texture context from date-simulated illumination and states that computed terrain illumination is unavailable outside bundled south-polar coverage.

## Verification

All Node checks use `UV_THREADPOOL_SIZE=1 NODE_OPTIONS=--v8-pool-size=1 GOMAXPROCS=1`.

- `npm run typecheck`: passed.
- `node node_modules/eslint/bin/eslint.js components/global-map.tsx lib/global-map.ts tests/global-map.test.ts`: passed.
- `node --import tsx --test --test-concurrency=1 tests/*.test.ts`: passed for all seven files. This Node 20 runner reports file-level totals; each file was additionally executed serially with `node --import tsx <file>` to verify actual assertions.
- 11 new map tests passed; the six existing files contain 30 passing tests. Coverage includes finite clamps, longitude wrap, geographic inverse, 2:1 sizing, dateline pan/picking, letterbox rejection, mobile/panoramic/polar framing, anchored zoom, regional selection, cluster identity and label collisions.
- No science/ephemeris formulas changed; Horizons revalidation is not triggered.
- No browser, server or native build/QA was started, as requested. Final visual review, touch-device interaction, screen-reader behaviour, 200% zoom and integrated offline imagery/CSS remain for the parent. Passing math/type/lint checks are not visual acceptance.

## Durable handoff

The read-only shared Git metadata requires an isolated temporary repository and a conventional commit bundle parented to the baseline. Bundle path and commit ID are in the delivery message. Only the five owned files belong to the delivery commit; the parent-provided untracked `lib/nasa-model.ts` is deliberately excluded.

Instruction parity passed at session start. Shared-memory recall was attempted through Qdrant (approval unavailable) and then via canonical vault search. The existing `Projects/SolarReach.md` refers to the unrelated UK solar-sales project and was not used as lunar-product evidence. Shared-vault writes are outside this worker's writable/owned scope; this log records the implementation decisions and verification for the parent to merge into the appropriate lunar project memory.
