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
