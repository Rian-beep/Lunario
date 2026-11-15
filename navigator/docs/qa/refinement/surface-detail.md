# Close-up texture correction

The original global fallback is 2048×1024 and cannot resolve a physical lander footprint. The original polar NAC bundles sampled 1 m source data at 4.18 m/output pixel. NASA Moon Trek's current default028mm NAC WMTS capabilities advertise matrix 12 at 2.0903206 m/output pixel; matrix 13 is unavailable. A trial at 13 returned no tiles and was rejected. No 1 m rendered-resolution claim is made.

`node scripts/prepare-nac-detail.mjs --surface` now prepares bounded ~1 km site-centre patches at the highest advertised matrix 12. Six actual downloaded/decode-checked JPEG patches add approximately 0.62 MB. Wider 4.18 m NAC patches remain as context. The material blends the finest containing patch into the next finest real source, avoiding an immediate jump to 100 m WAC. Texture cache/load bounds remain unchanged. No mesh detail, boulders or qualified hazards were invented.

Coverage: Malapert Massif, Connecting Ridge, Peak Near Shackleton, de Gerlache–Shackleton, geographic south pole and derived Shackleton crest. Other locations retain the available coarser imagery. Source image acquisition lighting is historical; image detail does not qualify terrain collision or landing safety. Source: [NASA Trek WMTS documentation](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon) and NAC GetCapabilities.

Tests check actual decoded image dimensions, named-site containment, source/output resolution, total compressed size, preservation of broad context, selection of fine plus broad NAC and bounded existing cache/disposal behavior. Final integrated browser checks are still required.

## Consistent global fallback and memory

Local terrain now uses the same original NASA 8192×4096 atlas as the globe for its global fallback, replacing the separate 2048×1024 fallback. This provides four times the linear global context resolution and a consistent source appearance. It is still kilometre-scale global imagery, not metre-scale coverage at arbitrary custom points.

A reference-counted atlas lease shares one Three.js GPU texture between the globe and local terrain. It retires only after both owners release it; failures permit retry, cancellation settles pending loads and late images are dropped. The standalone builder references the existing embedded NASA atlas instead of embedding a second copy. Original NASA asset bytes/hashes are unchanged. Cache ownership tests cover simultaneous owners, idempotent release, late image completion, retry and synchronous loader errors.

C11 cancellation refinement: a globe owner now aborts its stalled atlas wait immediately and disposes geometry before any image callback. Other owners keep the texture alive. Actual-globe/tiny-model regression fails C10 and passes the fix, alongside last-owner, retry and late-load tests.
