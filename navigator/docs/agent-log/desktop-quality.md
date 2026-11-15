# Desktop quality — Clevo refinement

Date: 2026-11-14. Worktree: `desktop-quality`; branch: `codex/desktop-quality`.

## Scope and intent

Own only `app/globals.css`, `components/polar-map.tsx`, `app/layout.tsx` and this log. Root JSX remains untouched. Followed AGENTS.md, docs/CONTRACTS.md, the map-first workbench design and the user's newer rejection of dark blue / phone-sized desktop UI. The warm ivory correction is **not** recorded as user acceptance.

Read the local frontend-design guidance. The map is the defining surface; chrome uses ivory glass, mineral olive and restrained brass. Outfit carries functional type and tabular data; Fraunces appears only in the selected-place title. No new assets, dependencies, browser, server, install, native build or heavy render.

Instruction parity passed. Qdrant recall was denied by the runtime's never-approval policy, so vault text was searched and read. The existing `Projects/SolarReach.md` concerns a different UK solar/MongoDB product; it must not be treated as lunar-project memory. This log is the durable handoff within the worker's writable ownership. Parent should capture the relevant lunar work in the correct canonical hub and sync the vault.

## Implemented direction (awaiting parent visual QA)

- Consolidated the stacked theme corrections into component rules and one responsive system. Desktop uses larger typography, practical control targets, a dominant full-width map, floating instruments, clear selected states and readable warm materials. Kept scientific chart and tooltip class contracts.
- Below 1080 CSS px (including desktop browser zoom), the map receives its full width and instruments flow beneath it. At narrow widths they stack. Date fields remain available rather than disappearing. Tables scroll locally. Parent must verify actual 200% zoom and horizontal overflow in the browser.
- Map labels use measured text widths, collision slots and leaders, avoiding instrument bounds, pins and the scale. Nearby pins form numbered spatial clusters; click to zoom or select exact sites in the existing Sites drawer. Derived coordinates retain derived labels and diamond symbols.
- Selected sites, custom coordinates and Reset frame the usable map region. Resizes preserve the map centre and zoom rather than losing the subject offscreen. Scale uses great-circle distance at the displayed bar's endpoints, with a numerical solve for its actual length. No celestial geometry changed.
- Bundled LROC WAC metadata/images load through `loadImagery()` and typed georeferencing. Higher-resolution patches load only when visible and useful; LOLA hillshade remains the fallback. Acquisition lighting and coarse scenario lighting remain separate. Source resolution and output sampling are shown separately; resampling is not presented as new measured detail.
- Optional online Moon Trek NAC now requires explicit map-local opt-in. Maximum 6 in-flight requests, 24 tiles per view and a 96-entry cache, with failed requests retained until normal cache eviction. Requests are limited to the supported south-polar coverage. No online tile is needed for bundled imagery or relief.
- Fixed stale image-load redraws and pointer cancellation creating a custom site.

## Cross-boundary root requirements

1. In `components/navigator.tsx`, rename the imagery layer radio from `LROC imagery · Moon Trek online` to `LROC WAC imagery · bundled`. The map itself now has a separate explicit `Load online NAC` button. Root's existing label would misdescribe the new bundled path.
2. For the improved imagery to be the initial presentation, set root's `imagery` state to `true`. Keep the relief radio available. This worker preserves root's current `false` default until parent integrates that change.
3. Integrate the parent's `public/data/imagery.json` and image assets, including offline embedding. Those assets were absent in the worker base and have now been copied into this worktree by the parent. Their dimensions match metadata for the overview and all nine patches. They remain outside this worker's staged/committed files.

## Validation

Dependency marker observed at `/home/luke/Storage/solarreach-navigator-20261114/.parallel/dependencies.ready` before validation. Initial `npm run typecheck` passed. Full final check results and commit follow below.

Browser / visual / 200% zoom, actual image georegistration and online service behavior are reserved for parent QA and are not claimed as passed. No science equations changed; Horizons re-query is not triggered by these presentation edits.

Final worker checks (after final source edits):

- `npm run typecheck`: pass, including the parent's copied terrain interfaces.
- Exact `npm test`: cannot start in this sandbox (`listen EPERM` for `/tmp/tsx-1000/*.pipe`, the tsx CLI's IPC server). Reproduced with untouched HEAD package/test files in `/tmp/solarreach-desktop-baseline`, before any tests execute.
- Equivalent runner: `UV_THREADPOOL_SIZE=1 NODE_OPTIONS=--v8-pool-size=1 node --import tsx --test --test-concurrency=1 tests/*.test.ts`: **6 test files pass, 0 fail**. Serial execution and smaller pools avoid the concurrent workers' `EAGAIN` process/thread limit.
- `UV_THREADPOOL_SIZE=1 NODE_OPTIONS=--v8-pool-size=1 npm run lint`: pass, **0 errors, 8 warnings**. All eight are in the read-only `components/navigator.tsx`; independently linting its untouched HEAD source via stdin reproduces those exact eight warnings. No warning in owned source.
- Existing Tailwind CLI compiled `app/globals.css` successfully to `/tmp/solarreach-desktop-quality.css` (280 ms); no production/native build or render.
- CSS parsed successfully; duplicate top-level correction rules and duplicate declarations were consolidated. `git diff --check`: pass.
- Pillow header checks: actual JPEG dimensions match metadata for the polar overview and all nine site images. These parent-provided assets and terrain changes are left untouched and unstaged.

`app/layout.tsx` needed no edit: existing Outfit/Fraunces loading already provides the selected typography. No new font dependency or external asset was introduced.

Root integration still needs the two imagery-state / label edits above and browser QA at desktop, split, narrow and 200% zoom sizes. Please check open/closed instruments, selected-site/cluster labels, scale, optional online NAC, keyboard controls, reduced transparency/motion, tooltip/chart readability, custom coordinates and offline imagery. This worker did not claim user acceptance or visual qualification.

## Commit transport limitation

The direct owned-file stage/commit attempt was rejected because the sandbox mounts `/home/luke/Storage/solarreach-navigator-20261114/.git/worktrees/desktop-quality/` read-only (`index.lock: Read-only file system`). No worktree branch ref or shared index could be changed. To deliver a concrete conventional commit without touching parent/other-worker metadata, the worker creates an isolated Git directory and bundle under `/tmp`. Its parent is this worktree's HEAD and its tree differs only in the three owned edited files. Parent can fetch the local bundle and cherry-pick the supplied hash. No pushes or remote changes.
