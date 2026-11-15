# Development

Use Node 20.19+ (Node 22 recommended) and npm. Runtime does not need Python; the original full catalog pipeline requires its Python scientific dependencies and raw DEMs.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4317/ . Do not run a second server on that port. The original source ZIP and its temporary Cursor remote are not development destinations.

Validation:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run verify:horizons
npm run standalone
```

Tests cover analytic mission/flight cases, unknown terrain, coordinate transforms, share-state validation, chart contracts and CSV safety. `verify:horizons` makes eight serial NASA requests and records 56 checks, including Apollo 11 of the decoded browser data; it fails if provider data cannot be fetched or tolerances are exceeded. Its 0.02° tolerance accounts for catalog quantization. It does not validate terrain occlusion or certify flight dynamics.

The source has a `codex/lunar-workbench` integration branch. Parallel agents use isolated worktrees, disjoint ownership in `docs/CONTRACTS.md`, explicit conventional commits and no shared browser/server. Parent integrates all passing completed branches and owns final visual acceptance. Generated HTML regeneration is a separate commit from source changes.

Keep the shared preview available while compiling. Use a separate Next output directory and an immutable offline candidate:

```sh
SOLARREACH_NEXT_DIST_DIR=.next-candidate npm run build
SOLARREACH_NEXT_DIST_DIR=.next-candidate npm run start -- --port 4318
SOLARREACH_STANDALONE_OUTPUT=/tmp/solarreach-candidate.html npm run standalone
```

Test the candidate independently. Never overwrite a running server’s build directory or remove its hashed static assets while a user page is active. Preserve persisted scenario inputs when promoting a tested build. ESLint excludes generated `.next-*` output; application source remains checked.

`node scripts/prepare-fine-terrain.mjs` adds nested higher-resolution DEM patches with resumable bounded source windows. `node scripts/prepare-nac-detail.mjs` adds LROC NAC crops where supported. Run imagery preparation before NAC preparation; rebuilding the WAC manifest replaces its NAC additions. Never download the multi-gigabyte DEMs wholesale.

`npm run terrain` performs bounded HTTP range reads against NASA's Cloud Optimized GeoTIFF. `node scripts/prepare-imagery.mjs` prepares bounded NASA Moon Trek/LROC texture mosaics. These are preparation commands; normal runtime uses the committed data. All generated assets carry provenance and use supported resources. Source archive chronology is retained honestly.

The standalone builder uses Node APIs and argv arrays rather than platform-specific `/opt/cursor` paths or unquoted shell commands. Its output is `public/solarreach-navigator.html`. Verify this file with networking disabled, including 3D, before claiming offline success.

Dependency note: a targeted PostCSS override removes the inherited high-severity advisory without forcing a major Next.js migration. Remaining npm advisories must be assessed by their actual build/runtime path; do not run a forced major upgrade as part of a visual change.

`node scripts/prepare-nasa-model.mjs --input /path/to/Moon_NASA_LRO_8k_Topo_Small.glb` reproducibly extracts NASA’s original mesh and texture (see the script argument contract and `docs/agent-log/nasa-model.md`). The original 77.7 MB GLB is not committed; extracted gzip and JPEG total about 14.2 MB. The full standalone file is about81MB because its imagery and geometry work offline.

## Planner verification

```sh
node --import tsx scripts/verify-planning.mts --output docs/qa/planning
node scripts/verify-planner-browser.mjs --base-url http://127.0.0.1:4317 --output /tmp/solarreach-browser
node scripts/verify-planner-browser.mjs --file public/solarreach-navigator.html --offline --output /tmp/solarreach-offline
```

The scientific verifier exits 1 for analytic failures and 2 for an explicitly incomplete independent scientific gate. Read its JSON; do not present exit 2 as a pass or suppress it. The browser verifier uses dedicated temporary profiles, including verified native 200% browser zoom. It never resizes the user's live page. Screen-reader and unresolved backdrop contrast gates remain explicit until actually checked.

Version numerical/constraint changes in `PLANNING_MODEL_VERSION`, preserve asset hashes in the evidence manifest, and run the numerical suites before rebuilding production/offline artifacts. Keep source and generated offline delivery commits separate. New scenario imports reject unsupported dates and schedules instead of clamping or deleting original saved entries.

Additional reproducible UI gates use dedicated Chrome contexts:

```sh
node scripts/verify-planning-flows.mjs --base-url http://127.0.0.1:4317 --output /tmp/solarreach-flows
node scripts/verify-playback-flows.mjs --base-url http://127.0.0.1:4317 --output /tmp/solarreach-playback
node scripts/verify-engineering-flows.mjs --base-url http://127.0.0.1:4317 --file public/solarreach-navigator.html --output /tmp/solarreach-engineering
node scripts/verify-dsn-flows.mjs --file public/solarreach-navigator.html --offline --output /tmp/solarreach-dsn
node scripts/verify-scene-persistence.mjs --file public/solarreach-navigator.html --offline --output /tmp/solarreach-scene
node scripts/verify-physics-reference.mjs --file public/solarreach-navigator.html --offline --output /tmp/solarreach-physics
```

Read each script's CLI contract: the engineering verifier exercises both supplied targets, while the other scripts choose one target. Forecast fixtures are intercepted separately from zero-network offline-bootstrap checks. Snapshot the generated file before concurrent file-open runs; never overwrite their input artifact midway. Stop the production server before changing `.next` with a new build, then restart and refresh the user's preview without changing their viewport or scenario.


Refinement-specific reference verification:

```sh
npx tsx scripts/verify-engineering-evidence.mts --live --frame
```

This checks75 station epochs against independently produced SPICE fixtures and primary frame identifiers, while retaining the explicitly open archived-catalog/terrain qualification gate. The optional isolated Python reproduction and pinned kernel hashes are documented in `public/data/engineering-evidence/README.md`; they are not required to run the browser or offline app. Use an isolated `SOLARREACH_NEXT_DIST_DIR` for candidate builds and `SOLARREACH_STANDALONE_OUTPUT` for immutable candidate HTML. Do not rebuild the directory used by the live preview.

## Refinement release gates

`docs/IN-FLIGHT.md` records the active source/artifact and remaining gates. Use immutable candidate HTML, marker, source bundle and instruction identities with `scripts/verify-refinement.mjs` and `scripts/verify-refinement-framing.mjs`; read each script’s CLI contract. The workflow verifier exercises actual reference/candidate, teaching downloads and supplemental evidence flows on HTTP and disconnected file transport. The framing verifier records actual render-frame geometry, viewport occlusion, original NASA fragments, contrast, navigation and native browser zoom. Preserve failed runs as history; source tests and CSS values alone cannot establish rendered acceptance.

Environmental playback verification prepares graph geometry while paused, then measures actual UI Play/Pause timestamps. Scroll/actionability setup must not silently consume a finite mission interval before a rate sample. Physical contact verification preserves the5cm signed-clearance gate across every emitted120Hz state, not just conveniently sampled rendered frames. Contact CCD may use up to8internal substeps; numerical solver settings are stated in the UI and contact report. These checks remain bounded preview regressions, not qualified fracture mechanics or mission approval.

Generated offline HTML is marked as generated and excluded from text diffs in `.gitattributes`; its large embedded data/renderer remain auditable through source changes, artifact hashes and disconnected-browser evidence. Regenerate it with `npm run standalone`; do not edit the minified file by hand.

The optional `tests/refinement-viewport.test.ts` browser gate now has8cases when `SOLARREACH_VIEWPORT_ARTIFACT` is set. Set `SOLARREACH_VIEWPORT_CHROME` for your browser path; the default is `/usr/bin/google-chrome`. It verifies true native200% HTTP/file framing, ordinary controls, inspector scrolling, focused axis labels and final-energy inspection with a bounded environmental clock. Without the artifact variable the five numerical viewport tests still run in the normal source suite.

## Lunario branding and flight regression checks

The actual identity source is `Rian-beep/Lunario` at `aeb673f`; the earlier NASA challenge repository supplies separate science/assets and remains attributed. Preserve exact vendor bytes and regenerate the offline-friendly branding module with `node components/branding/generate-lunario.mjs`. Source fonts are local; their OFL accompanies the web assets and is embedded in standalone HTML. Do not rewrite saved SolarReach identities to change the displayed name.

After an isolated build, run `node scripts/verify-lunario-flight.mjs --url http://127.0.0.1:4341 --file /tmp/lunario-reference-r2.html --out /tmp/lunario-check` with the relevant paths. It uses private contexts, real controls and disconnected file transport. `node scripts/verify-lunario-startup.mjs URL OUTPUT` additionally checks reduced motion, denied session storage and an explicitly failed catalog/retry fixture. Browser path can be supplied through the scripts’ existing executable/environment options.

Wait for the document-owned loader and native intro before interacting. Native dialogs are in the top layer and can cover even a high-z-index body overlay. Do not treat empty contact times as zero in tests, and slow playback before clicking Pause near completion to avoid accidentally clicking the newly rendered Play action. Preserved exploratory failures are described in the current QA ledger.


Public flight usability regression: `node scripts/verify-public-flight.mjs --url http://127.0.0.1:4344 --file /tmp/lunario-public-flight-final.html --out /tmp/public-flight-check`. Fresh contexts use the real Public introduction, check that first-use Play fits inside the inspector without scrolling, edit every numeric control and open its help, and sample fixed-scale Follow framing through nominal, weak-engine and ascent playback. File transport runs disconnected. Loader lifecycle is observed from document startup so a completed transient animation is not mistaken for a missing loader. This is an automated friction/visibility check, not a human enjoyment study.

## Public context and theme checks

`node scripts/verify-public-context-theme.mjs` checks the production server at port 4341 and `/tmp/lunario-features.html` with disconnected file access. Override `LUNARIO_THEME_URL`, `LUNARIO_THEME_FILE`, `LUNARIO_THEME_EVIDENCE` and `SOLARREACH_VIEWPORT_CHROME` as needed. Weather responses in that verifier are explicitly synthetic fixtures, never a live station observation. It checks normal/cache-bypassing reloads, original three-second loader, theme persistence and original white logo, Public Apollo history, all three DSN complex disclosures, and on-demand weather behavior.

Theme preference uses the separate `lunario-ui-theme` localStorage key. Light remains the default; storage-denied contexts still support an in-document toggle. Surface tokens live in `app/mission-theme.css`; imagery, renderer lighting and mission state must not depend on this preference.

Workspace density verification: `node scripts/verify-workspace-space.mjs` uses a production candidate at4345 and `/tmp/lunario-space.html`. Override `LUNARIO_SPACE_URL`, `LUNARIO_SPACE_FILE` and `LUNARIO_SPACE_EVIDENCE`. It checks first-use Public Play, full-height/expanded inspector bounds, a compact Earth toolbar, grouped station selection, Planner Var topic selection/native math, dark disclosure contrast and Compare/flight separation on web and disconnected file.

Orbital context: `public/data/orbits/catalog.json` is a small validated CelesTrak GP snapshot. Keep mission/NORAD identities paired; refresh at most once per provider update (2h cache). `lib/orbits.ts` validates and propagates Earth/TEME/UTC SGP4 elements. `/api/orbits` is an explicit, fixed-ID provider adapter on a Next server, without auth or arbitrary URL input. Static hosting/offline can use the bundled snapshot and GP JSON import. Do not interpret orbital geometry as station booking, lunar relay capability or an accuracy certificate.

`node scripts/verify-orbits-navigation.mjs` checks web/file satellites, independent time/age gates, mission descriptions, pole/POI labels, direction controls and measured close-up LOD. Override `LUNARIO_ORBITS_URL`, `LUNARIO_ORBITS_FILE`, `LUNARIO_ORBITS_EVIDENCE`. `node scripts/verify-chart-proportions.mjs` verifies actual info-button circles and uniform SVG scaling in replanning charts at1600/1280/800px; same URL/file overrides, plus `LUNARIO_CHART_EVIDENCE`.

`tests/fixtures/orbit-reference.json` holds18 independent Python sgp4/Vallado C++ reference states. They check implementation consistency, not real spacecraft accuracy. The snapshot’s source elements, manoeuvres, age and frame limitations still apply. See `docs/research/GODS-EYE-REVIEW.md` for reviewed reuse, source terms and excluded unrelated datasets.

## Hosted ESM entry (separate from the offline download)

From `navigator/`, run `node scripts/build-web.mjs`. It writes repository-root `web/index.html`, hashed ESM chunks, CSS and Geist font under `web/assets/`, plus `web/metafile.json` and `web/build-receipt.json`. No dependency/package change or Next server is required. Keep `navigator/public/` alongside `web/` on the host: large science, terrain, imagery and model assets are requested from that existing directory, not copied or embedded in the hosted document. The existing standalone builder and its self-contained offline output remain separate.

Use a temporary destination for worker/candidate verification:

```sh
LUNARIO_WEB_OUTPUT=/tmp/lunario-web-candidate node scripts/build-web.mjs
npx tsx --test tests/public-assets.test.ts
node --test web-source/build-web.test.mjs
npm run typecheck -- --incremental false
npm run lint
```

`LUNARIO_WEB_OUTPUT` selects an output **directory**. The HTML uses relative chunk/style links and sets `window.__LUNARIO_PUBLIC_BASE__='../navigator/public/'`. `lib/public-assets.ts` exports `publicAssetURL(canonicalPath)`: with no configuration it preserves Next's canonical paths; the hosted configuration resolves against `document.documentURI` (independent of a `<base>` tag), including nested GitHub Pages repository paths. HTTP(S), protocol-relative, data and blob transport URLs pass through. Local paths reject traversal, encoded paths, query/hash suffixes and unsafe schemes; configured bases must be same-origin HTTP(S) directories with no credentials/query/hash/encoding. One leading `../` is allowed for the sibling layout; internal/repeated parent traversal is rejected. A hosted build is for HTTP(S), not a substitute for the disconnected offline HTML.

Apply the helper only when assigning an image/texture URL or starting a fetch/loader. Keep `/data/...` values in source metadata, provenance and cache keys canonical. The web entry also exposes `window.__LUNARIO_PUBLIC_ASSET_URL__` for same-origin parent adapters. Loader coalescing, failure retry, hash checks, decompression, AbortSignal ownership and embedded-global precedence are unchanged. The actual celestial loader source is `lib/celestial-assets.ts`.

The entry mounts the existing Navigator, compiles real Tailwind `app/globals.css`, emits the imported mission theme/component CSS and font stylesheet, and distributes the Geist OFL and orbital source licences. It starts the same document-owned original three-second Lunario loader; Navigator's existing readiness/completion paths reuse it. It preserves the URL, scenario parameters, persistence identities and theme preference boot. The hosted-only `next/dynamic` adapter supports this app's function loaders and `ssr`/`loading` options, leaves Three/Rapier deferred, and offers an explicit page reload if a lazy view fails. Next and offline builds retain their own dynamic implementation.

The deterministic receipt inventories payload/metafile bytes and SHA-256 hashes; gzip-6 values are estimates. `initialJS` is the complete transitive static import closure, not just the entry file, and excludes dynamic imports. Builds fail on missing emitted dependencies or eager Three/Rapier/scene-runtime imports. Receipts contain no output-directory names or timestamps, and the builder test compares two independently emitted destinations. No module preloading of deferred branches is added. Previously hashed assets are retained when rebuilding a destination; publish/prune an immutable candidate as part of the integrator's release process.

Ownership handoff: the integrator must apply `publicAssetURL` at map/image/material I/O boundaries (including `catalog.map.url` and nested imagery URLs), preserve/wire the parent ready/error bridge, and retarget the root entry to `web/index.html`. Those shared files are intentionally outside the web-entry worker delivery. Until those adapters are integrated, the standalone hosted candidate can still request map images from origin-absolute `/data/` paths. Static tests validate chunks, CSS/fonts, transport helper and loader semantics; actual map paint, one-loader parent/iframe behavior, restored URLs, 3D and disconnected offline regression remain integrator browser gates. No browser timing or user acceptance is implied by byte reductions.

## Scientific audit dependencies and publication

The source-replay tests additionally require Python with the pinned NumPy audit dependency. In a temporary environment:

```sh
python3 -m venv /tmp/lunario-audit-python
/tmp/lunario-audit-python/bin/python -m pip install -r pipeline/audit-requirements.txt
PATH=/tmp/lunario-audit-python/bin:$PATH npm test
```

CI creates that environment before tests. Do not treat a missing dependency as a skipped pass. Rerun affected independent audits before changing `docs/qa/scientific-audit/integration/receipt-bindings.json`; the compiler deliberately rejects stale numerical code, inputs and failed receipts. Compilation time is not a new comparison timestamp. Run `python3 scripts/compile-scientific-verification.py`, then rebuild web/offline and execute `node scripts/verify-mission-paths.mjs` against the documented local4356 root server. See scientific-audit reports for independent source replay commands.

CI runs `python3 scripts/compile-scientific-verification.py --check` before tests: this validates reviewed input/subsystem-engine/receipt bindings and committed findings without restamping compilation time. Ordinary compilation remains explicit after reviewed source comparisons. The freshness regression includes a communications-subsystem mutation, failed outcome and non-writing check-mode cases.

The LCROSS original-PDF replay also requires Poppler's `pdftotext` on PATH (`poppler-utils` on the Ubuntu CI runner; Poppler on macOS). CI installs it explicitly. An absent executable is a failed source check, never a skipped pass; the test retains the original coordinate/time assertions and now reports spawn errors directly.
