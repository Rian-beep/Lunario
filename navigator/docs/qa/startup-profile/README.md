# Startup delivery profile — 15 November 2026

Scope: Clevo startup worker, base `6a3927f`, branch `codex/map-startup-profile`. Only `scripts/startup-profile/**` and this directory are owned. This is a measured packaging investigation and a compile-tested web design, not a deployed fix or reproduction of the user's blank screenshot. The integrator owns shared startup, maps, loader, packaging, UI and generated artifacts.

## Finding and priority

**Stop using the offline download as the hosted application.** The public [Pages dashboard](https://rian-beep.github.io/Lunario/) embeds `navigator/public/solarreach-navigator.html`. Its fetched, decompressed bytes exactly match this checkout's **81,236,036-byte** offline artifact, SHA-256 `8de622395941c418dcdaf73ad95454c3909f6974ebaf4bec336ebdaec2a3be8d`. Pages sends **55,488,638 gzip body bytes** for that iframe even on the recorded CDN cache hit. The tiny root page does not make the application small.

The offline HTML first executes **74,370,907 bytes of inline data assignments**. Application JS is a second **6,630,926-byte** script beginning at byte **74,605,079**. The `#root` container has no app content until that script executes and React commits. Starting optional resources after mount cannot avoid downloading or parsing the earlier embedded payload in this packaging. Keep this self-contained artifact for explicit offline use; create a separate hosted entry from the same production components and public data.

Priorities for the integrator:

1. **P0: separate web and offline packaging.** Small HTML/CSS + native ESM chunks; normal public asset requests; no inlined terrain, all-site imagery, NASA mesh or equipment in the web document. Keep the offline IIFE/embedding path unchanged. This removes the large serialized transfer before the application can execute.
2. **P0: fix transport asset bases at the same time.** The current `/data/catalog.json` resolves to the origin root and returns **404** on Pages; `/Lunario/navigator/public/data/catalog.json` returns **200**. Current offline injection avoids many such fetches, so this is a demonstrated hazard for the proposed web entry, not evidence that today's offline iframe fails its catalog fetch.
3. **P1: defer and coalesce numerical terrain and heavy render resources.** Do not start 12.12 MB local terrain and 6.03 MB global terrain for every map visit. Preserve real unknown/loading states and restored scenarios. Keep requested NASA detail and quality unchanged.
4. **P1: coordinate readiness and loader reveal.** Preserve original vendor animation, minimum 3000 ms, reduced-motion behavior and failure paths. Signal useful application readiness after a committed map shell, rather than using iframe `load` as proof that React is visible. Resolve both success and terminal error. Do not make the minimum duration a prerequisite for starting app/data work.
5. **P2: move flight computation behind actual consumers, then profile again.** Current CPU evidence favors terrain decode before speculative flight rewrites. Do not change physics, prepared horizons, `evaluateScenario`, model identity or scientific assertions to improve a score.

## Reproduce without a server

From `navigator/`, with the repository's already-installed dependencies:

```bash
node scripts/startup-profile/profile.mjs --remote --output /tmp/lunario-startup-profile.json
node --test scripts/startup-profile/profile.test.mjs
npm run typecheck -- --incremental false
npm run lint
```

Omit `--remote` for static builds, hashes and CPU measurements only. The single profiling script performs three **in-memory** esbuild builds, transitive static-import accounting, asset inventories/hashes, HTML script offsets, real production terrain/flight CPU probes and optional public HTTPS GET/HEAD requests. It writes only its chosen report, temporary HTTP captures that it removes, and no application outputs. It never starts a server/browser, installs dependencies, probes guessed hosts, intercepts network or rewrites production source. `baseline.json` is the recorded receipt. Its `revision` identifies the baseline application commit; its source hashes distinguish application inputs and the shim experiment.

Tests are explicitly invoked `.mjs` tests in the owned scripts directory. They are **not** picked up by `npm test`; nor should integration assume `tests/startup/*.test.ts` is in the root glob. The seven tests cover project-path resolution and rejection boundaries, transitive/cyclic static graph accounting, UTF-8 HTML offsets, lazy/default/named component loading and caching, rejected-import behavior, and actual application chunk boundaries with both installed Next and the client shim. No existing assertion or check configuration was relaxed.

## Evidence and limits

### Public delivery

`baseline.json.publicDelivery.observations` records UTC timestamps, statuses, compressed wire body bytes, decompressed document bytes, SHA, DNS/connect/TLS/first-byte/total seconds and selected cache headers. The script follows the **actual iframe src** read from Pages and verifies its same-origin `/Lunario/` target. It also probes loader JS, site CSS and both catalog paths with HEAD. A HEAD result establishes status/headers, not JSON validity or body download timing.

The receipt contains one sequential GET per document from a fresh curl process without a browser HTTP cache. CDN and OS caches are uncontrolled. The CDN's `HIT`/`Age` values are retained. The final iframe GET took **9.380155 s** (first byte 0.040940 s), CDN `HIT`. These are **HTTP transfer observations, not measured browser cold-cache time, FCP, LCP, app-ready or 3D-ready times**. No localhost measurements or claims about the Mac preview are made. Early exploratory iframe GETs varied from 8.57 to 13.78 s for the same bytes, illustrating why a single transfer is not a universal latency estimate; the committed receipt is the canonical final sample.

The public root HTML differs from the checked-in root (for example, its navigation injection uses a MutationObserver retry). Both inspected versions embed the same offline artifact. Do not assume root source equivalence from iframe equality.

### Static sizes (decimal bytes)

| Item | Bytes | Role |
| --- | ---: | --- |
| Offline HTML / hosted iframe | 81,236,036 | Entire document before app can finish startup |
| Catalog JSON | 1,004,402 | Initial site/horizon/ephemeris data |
| Polar hillshade PNG | 1,363,407 | Existing map relief |
| Polar WAC overview JPEG | 1,796,481 | Default enabled imagery; preserve appearance |
| Local terrain JSON | 12,119,158 | Numerical terrain, currently eagerly decoded |
| Global terrain metadata | 7,992 | Declares hashes, dimensions and limits |
| Global terrain gzip | 6,025,781 | 6,553,600 decoded Int16 bytes |
| Imagery metadata JSON | 9,517 | Small; duplicate consumers are the avoidable part |
| NASA Moon mesh gzip | 9,587,461 | Defer to 3D; preserve bytes/fidelity |
| NASA Moon 8K JPEG | 4,631,745 | Whole-Moon/3D consumers; preserve bytes |
| Lander GLB | 716,840 | Equipment/3D consumer |
| Evidence manifest JSON | 29,484 | Canonical assessment provenance |
| Planning demo JSON | 2,375,452 | Teaching/demo consumer; not essential to first map |

The inventory includes all imagery manifest images with hashes. Not every standalone-embedded auxiliary asset is inventoried separately; the full HTML byte/hash accounts for the complete package. Compression estimates use local gzip level 6 and are labeled separately from measured Pages wire bytes. Do not sum decoded dimensions, gzip files, base64 strings and their source assets as if they were independent network requests.

### Compile experiment

| Build from actual standalone entry | Initial static JS graph | gzip-6 estimate | JS files |
| --- | ---: | ---: | ---: |
| Current IIFE | 6,630,926 | 2,315,149 | 1 |
| ESM + installed Next dynamic | 1,190,584 | 352,245 | 28 |
| ESM + client lazy shim | 1,186,195 | 350,762 | 28 |

These include the full transitive static graph, not just the entry chunk. CSS is reported separately, and excludes the Tailwind CLI output. This is approximately **82% less initial JS** in the compile graph, not an 82% faster measured load. Actual first render can activate more dynamic chunks. Rapier alone contributes approximately 4.34 MB to the current IIFE; Three core/module adds approximately 0.60 MB. Both leave the initial static graph in **both** ESM variants. MathML, glossary and eager panels remain measurable initial inputs; do not strip their content blindly.

The installed Next implementation is already lazy when imported by esbuild. A shim is therefore optional compatibility isolation, not the primary optimization: its additional initial saving is **4,389 raw bytes / 1,483 gzip-estimate bytes**. The supplied `lazy-dynamic.mjs` is a **client-only experiment**, aliased only inside the profiling build. It supports exactly the existing function-loader calls with `ssr`/`loading`; it is not a replacement for Next's server/preload APIs. Its `ssr` option has no server meaning here. No shared app import is changed. ESM builds retain native `import.meta.url`; only the current IIFE comparison uses the existing builder's `document.baseURI` substitution.

React caches a lazy loader's successful result **and rejection**. A production adapter needs a scoped error boundary, visible failure/retry and a deliberately renewed lazy identity on retry (or a clearly labeled page reload). Merely resetting an error boundary does not cause React to call the same rejected lazy loader again; module/network retry still needs real browser validation. The tests verify the cached failure and a new identity with a recovering loader, not CDN recovery or browser module-cache invalidation. [React lazy reference](https://react.dev/reference/react/lazy).

### CPU scope

The receipt includes five actual `decodeTerrain` runs over **4,541,976 cells**: **160.69–173.81 ms** decode, separately timed from **4.82–9.34 ms** JSON parse. Five production `simulateFlight(DEFAULT_FLIGHT)` runs take **4.00–12.50 ms**, returning **481 points** each. These run in Node 20.20.2 on this Clevo's Ryzen AI MAX+ 395, using already-read input and no terrain callback for flight. Raw samples, machine, runtime and caveats are retained; they are not browser/mobile CPU timing, JS compilation, peak-memory measurements, restored-scenario timing or a simulation of the full startup critical path. Decode expands packed terrain to ordinary JS arrays. A future packed/typed representation would need separate consumer and numerical equivalence verification; deferring the existing decoder is the smaller first change.

## Source-level startup and cache map

| Source / path | Observed behavior | Integration implication |
| --- | --- | --- |
| Root `index.html`, `css/site.css` | Eager offline iframe; frame starts at opacity 0; `load`/cached `readyState` fast path calls reveal; 45 s safety only asks vendor to hide | `load` is not React readiness. Cached `about:blank` timing and failure after parent reveal are hypotheses to reproduce, not diagnosed screenshot causes. Hiding a loader alone does not repair a hidden/unready frame. |
| `scripts/build-standalone.mjs` | Base64 imagery, mesh, equipment, DEM and other data precede monolithic IIFE | Keep file mode; do not reuse it for default Pages delivery. |
| `standalone/main.tsx` | Static Navigator import, createRoot, theme CSS | Reuse component entry, separate build configuration and asset transport. |
| `Navigator` mount effect | Starts global terrain, catalog, evidence, imagery and local terrain | Calls run concurrently; global data is **not awaited** before publishing catalog/state. It still competes for network/CPU and later triggers derived work. |
| `lib/global-terrain.ts` | One module `pending` promise caches success/coalesces calls; rejection resets it; validates metadata, packed/decoded hashes and decompression bound | Retain validation and retry semantics. It has no fetch AbortSignal; consumer `active` flags suppress stale state but do not cancel transport. |
| `lib/terrain.ts`, `catalog.ts`, `imagery.ts`, `provenance.ts` | Embedded global first; otherwise absolute `/data` fetches. No module promise cache in these loaders | Add bounded shared pending/result ownership; reset on failure. Current local terrain decoding repeats per call even with embedded input. Do not tie a shared fetch to one consumer's abort. |
| Navigator + `PolarMap` | Both call uncached `loadImagery`; PolarMap loads WAC overview after metadata, hillshade independently | Metadata is 9.5 KB, not the 12 MB issue. Coalesce metadata; prioritize visible map images and retain existing imagery default. |
| Navigator useMemo chain | Resolves horizon, series/summary, mission/evidence, reference height and `simulateFlight` before ready return; flight recomputes with terrain/reference changes | Default `view=map`, but `!flight` still holds the entire app in loading. Separate map readiness from optional flight without publishing fabricated terrain/flight results. |
| Scene component/runtime | `afterPaint` defers mounting; site geometry/imagery prepare cooperatively; local material queue/cache is already bounded | Preserve those existing controls; do not invent a second competing render/cache path. |
| NASA model/equipment loaders | Signal-aware fetches; NASA checks compressed length and decoded mesh invariants; no module pending cache in these loader functions | Preserve checks/ownership/disposal and existing transferred globe reuse. HTTP cache alone is not proof of decode/GPU reuse. |
| Branding runtime/vendor | Document-owned Symbol prevents repeated React mounting of inner vendor; `data-min-duration=3000`, manual `hide`, completion promise | Preserve vendor bytes, duration and completion contract. Root and iframe are distinct documents with separate loaders; coordinate timing rather than accidentally waiting for two serial startup sequences. |

Do not defer global data indiscriminately: restored custom/global-context scenarios and requested numerical screening may require it. A missing result must remain explicitly pending/unavailable, with the existing smooth-sphere comparison still shown. Terrain data must never silently become a sphere-derived numeric terrain answer.

## Concrete hosted counterpart for integrator implementation

Use a static **`web/index.html` + hashed ESM assets** artifact under the project root, alongside the existing offline HTML. Retarget the current iframe to `web/index.html` while retaining existing layout, navigation and controls. Compile the same `standalone/main.tsx` and CSS sources with installed esbuild, `format:'esm'`, `splitting:true`, `outdir`, production define, hashed `entryNames`/`chunkNames`, and native ESM `import.meta.url`. Do not add dependencies or a runtime server. [esbuild splitting reference](https://esbuild.github.io/api/#splitting).

```js
// Design sketch: the profiling script validates the equivalent JS graph.
await build({
  entryPoints: ['standalone/main.tsx'], bundle: true,
  format: 'esm', splitting: true, outdir: webAssets,
  entryNames: '[name]-[hash]', chunkNames: 'chunks/[name]-[hash]',
  minify: true, jsx: 'automatic', target: ['es2020'], metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  // Optional, client web build only:
  // alias: { 'next/dynamic': absolutePathToReviewedClientAdapter },
});
```

Use relative `<script type="module" src="./assets/main-HASH.js">` and emitted relative chunk imports. Generate HTML from the metafile's actual entry output rather than guessing a hash. Build Tailwind and mission CSS using the repository's existing toolchain, link emitted CSS, and retain the actual Geist font/licence and vendor loader assets. Do not preload all dynamic chunks or duplicate large public assets in a second tree. No blanket runtime `fetch` monkey patch or generic reverse proxy.

For `web/index.html`, explicitly declare its public asset base as `../navigator/public/`, resolved against `document.baseURI`. This becomes `https://rian-beep.github.io/Lunario/navigator/public/` on Pages. Retain canonical metadata values such as `/data/global-terrain.bin.gz`; apply `publicAssetURL(canonicalPath, publicBase)` **only at I/O** after validation. Resolve image `src`, catalog.map.url, nested imagery URLs, NASA mesh/atlas, GLB/Draco dependencies, CSS/font URLs and worker URLs too; a catalog-only rewrite is insufficient. No origin-absolute `/data/` or `/assets/` request should escape the project base. Project Pages URLs include the repository directory. [GitHub Pages locations](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Start catalog + provenance and the visible map's hillshade/WAC early. Load local terrain for requested numerical local detail/flight/3D; load global terrain for actual global-context consumers; load NASA mesh and lander on 3D/flight demand. Defer all-site patches, other celestial/equipment assets and teaching demos until their existing consumers request them. Coalesce repeated data loads with explicit loading/error/retry; keep prepared data hashes and schema checks. Prewarm optional work only after useful paint and with a bounded budget, not an eager fetch of every deferred asset.

The shell and original loader should paint immediately from small local resources while app/data load concurrently. Preserve the original minimum duration and lift-away. If retaining the iframe, use a same-origin, source-checked ready/error handshake after the relevant commit/paint; preserve deep links, scenario parameters, local storage identities, keyboard behavior and existing parent navigation. Never gate the first useful 2D shell on 3D, equipment, ion credentials or optional flight simulation.

## Verification and remaining handoff

Final scoped checks: seven focused tests pass; nonincremental typecheck and full lint pass. An initial lint run caught two reserved `module` variable names and a test display-name issue in new profiling files; those were fixed without disabling rules. No base-failure claim. `slop-scan` is not installed/configured here. No scientific source changed, so fresh Horizons verification is not claimed. Full app numerical regression, production builds, file journeys and visual acceptance remain integrator gates.

The integrator must still measure actual browser cold-context navigation and first map/3D interactions on the **built web artifact and Pages path**, retaining resource sizes, long tasks, timing definitions, console/errors and request lists. Separately exercise cache hit, chunk/data failure and retry, interrupted/changed demand, global/custom restore, nested asset bases, narrow/200% layouts, original loader first visit/reload/reduced-motion and terminal failures. Verify the offline artifact fully disconnected and unchanged in capability. This worker cannot establish browser blank-page cause, a three-second app-ready guarantee, GPU savings, field latency or visual correctness from compilation/HTTP receipts.

Durable findings are saved in this owned report and receipt. No shared vault/project hub was edited because the current worker instruction restricts writes to these two owned repository scopes (plus requested `/tmp` handoff files). User acceptance and deployment remain unclaimed.
