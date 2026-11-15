# Polar imagery overlay correction

## Proven cause

The user's large blurry circle is the optional **online NAC averaged polar-cap mosaic**, not a disk drawn over the map, not a LOLA mask and not a circle baked into the bundled WAC overview. The live headless reproduction used a fresh dedicated Chrome context at its fixed default viewport, without a user profile, viewport mutation, server/build operation or application-source modification.

At the same regional framing, canvas draw-call instrumentation and screenshots established:

- Default and overview-only views draw `map.png` plus `imagery/polar.jpg`; no detail patches are eligible and the circle is absent.
- Enabling online NAC adds four `LRO_NAC_AvgMosaic_SPole855_1mp` tiles at z3 (`3/3/3`, `3/3/4`, `3/4/3`, `3/4/4`). Their circular coverage boundary reproduces the user's inset exactly.
- Those online tile pixels are approximately **1,070.24 m/px**, while the already drawn WAC overview has **267.56 m/px output sampling**. Its native WAC source is 100 m/px. Thus the old layer order replaced coherent, finer regional context with a coarser averaged polar-cap pyramid. The two image families also contain different historical acquisition lighting.

Before evidence: `/tmp/solarreach-polar-before/composite.png`, `overview-only.png`, `hillshade-only.png`, `online-nac-regional.png`, `draws.json`, and `online-draws.json`. The online-NAC screenshot visibly matches the uploaded circular-cap artifact. No raster pixels or numerical data were edited to produce the diagnosis.

## Correction

The online preference remains enabled, but it neither requests nor paints NAC at regional scales coarser than the native WAC source (100 m per screen pixel). The button/credit now explain that NAC is waiting for detail-scale zoom. Returning from detail to a regional view also stops cached NAC tiles from repainting the cap.

At 100 m/px or finer, tile selection prefers the next **finer** pyramid level (`ceil`, bounded to the existing z2–z10 server range), rather than rounding to a possibly coarser level. It then checks a conservative whole-viewport footprint against the existing 24-tile budget. If necessary it uses the next coarser level only while its output remains finer than native 100 m WAC; otherwise it retains the coherent WAC basemap until further zoom. This avoids a budget-truncated central tile rectangle without inventing image pixels. For example, 100 m/px chooses z7 (66.89 m output sampling), and 50 m/px chooses z8 (33.45 m). The source may be 1 m NAC, but the requested/displayed pyramid is not advertised as a 1 m image. The existing request count, concurrency and cache bounds are retained.

Painting keeps optional online NAC below any eligible finer bundled NAC patches. The source-family credit now says **NAC** when NAC pixels actually draw, instead of calling a 1 m source “WAC”. It distinguishes native source spacing from output sampling and retains WAC elsewhere. Source/image extents, projection transforms, native masks, raster bytes, pins, horizon lookup, timing and numerical science are unchanged. No black/shadow pixels are removed and no feathered artificial heights or fabricated detail are introduced. The shared imagery manifest and all 3D source assets remain untouched.

## Verification

`tests/polar-imagery.test.ts` first reproduced three failures with the old selection rule: regional NAC was not deferred, 100 m/px selected coarser z6 rather than z7, and invalid sampling could request a tile. After the correction all four focused tests pass. They verify the captured z3 regression, detail-level physical sampling bounds, invalid inputs and honest family/output labels.

Commands: `node_modules/.bin/tsx --test tests/polar-imagery.test.ts`; `node_modules/.bin/eslint components/polar-map.tsx lib/polar-imagery.ts tests/polar-imagery.test.ts`; `npm run typecheck`; `git diff --check`.

Focused tests, targeted ESLint and diff checks passed locally. Full typecheck reports six errors in the already committed `tests/global-context.test.ts` because the assigned `46ada04` checkpoint predates its uncommitted global adapters. A separate pristine detached `46ada04` baseline produces the identical six errors in that same file; no polar-map/helper/test type errors are reported. Logs: `/tmp/polar-baseline-typecheck.log` and `/tmp/polar-current-typecheck.log`. The parent integrates the existing global adapters before the final project-wide check.

Actual **compiled after-fix** browser imagery remains pending the coordinated parent rebuild. Do not treat the source patch or a test-only suppressed draw as an after-build visual pass. The parent will release the preview after merging this correction, then the same regional online-enabled framing must show the coherent WAC base with no cap, preserve source/scale text, and still draw detail NAC when zoomed in. The offline bundle must retain the same bounded layer-selection behavior without remote tile requests by default.


## Compiled visual verification and bounded detail follow-up

The first integrated correction was tested on the updated production preview. `/tmp/solarreach-polar-after/online-nac-regional.png` shows the same regional framing with online NAC enabled, **no pasted polar cap**, and **zero NAC requests** (`requests.json`). Default WAC imagery, pins and graticules remain aligned. The before screenshot and four z3 source draw records were preserved as `/tmp/solarreach-polar-before/online-nac-regional-original.png` and `online-draws-original.json`.

Zooming to detail fetched and drew z8 NAC pixels with truthful 33 m output sampling. That test also exposed two remaining bounded detail issues: the old visible-patch ratio prevented 4.18 m-sampled bundled NAC from ever drawing at a normally reachable 63 m/screen-pixel view; and a 24-tile cap could leave a visible tile rectangle. With parent coordination, the follow-up makes bundled NAC useful whenever the view requests 100 m/px or finer (with its original source pixels/downsampling retained), and selects an online level whose conservative full viewport footprint fits the same 24-tile budget while remaining no coarser than native WAC. It defers online imagery rather than paint a partial budget footprint when no such level fits. Existing finer bundled NAC still draws last. Credits now explicitly say **Finest visible** sampling to avoid implying uniform resolution across mixed coverage.

Both new tests failed before that follow-up and all six focused tests pass after it. A 1280×640 view at 63 m/px chooses z7, not the budget-truncated z8 footprint; an oversized view that cannot fit useful NAC remains WAC. These are display-selection tests, not new source-resolution or terrain-accuracy claims. The detail follow-up's compiled visual remains pending the next coordinated build; the first integrated regional no-cap/zero-request visual is already verified.
