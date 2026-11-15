# Regional map screening, sourced ice and streamed visual terrain

The landing-site map needs comparisons across locations, while the hosted entry currently downloads the entire offline application. These are separate numerical, evidence and transport problems.

## Decision

A user-enabled map layer reuses the canonical visibility calculations at explicitly sampled coordinates. Its composite index is the weighted arithmetic mean of mean visible solar-disk fraction, one minus longest observed darkness divided by the selected stay, regional slope preference, and Earth-centre visibility including the antenna mask. Unknown positively weighted factors produce an unknown index. Weights and the slope scale are preferences; the index is neither a success probability nor a landing assessment. The canonical scenario evaluator remains the full-mission authority.

Map cells indicate sampling support; they do not establish fine spatial confidence. A viewport grid may refine the whole-Moon display, bounded to 256 centres and no finer than the underlying global DEM. Stale jobs cancel, progress yields cooperatively, and only two physical result screens are retained. Display factor, opacity and weight changes reuse computed metrics.

Ice evidence is a separate categorical layer. The published catalogue supports 169 regional M3/PSR reference locations and a separate LCROSS impact-water observation. These are not deposit footprints, concentration measurements or reserves. Unmarked areas are unknown. Original source frames, licences, hashes and processing limitations remain attached.

Cesium Moon is an optional online visual source through NASA-AMMOS 3D Tiles Renderer 0.5.4. It uses metre-based conventional lunar body coordinates transformed into the existing local kilometre scene. The existing NASA globe remains until streamed tiles are visible. Download concurrency, parse concurrency and GPU cache are bounded. Tokens stay in runtime memory and are omitted from scenario persistence and all exports. Flight collision and mission calculations retain the documented numerical DEM; the streamed mesh does not silently redefine qualified heights or hazard evidence.

A separate hosted ESM build loads data and renderer chunks on demand, resolving canonical public asset paths only at IO boundaries. It shares app components with the independent single-file offline build. The static host must publish both the generated web directory and navigator/public assets. No credentials or provider tiles are bundled in Git or the offline file.

## Consequences and verification

Tests cover numerical unknowns/weight handling, cancellation, source validation, frame transforms, bounded lifecycle cleanup and nested-host asset paths. The integrator also checks actual web and file journeys, request/byte traces, loader timing, map navigation and fallback behavior. A successful visual request is not scientific terrain qualification; neither an empty map nor an exhausted observation window proves permanent darkness or absence of ice.
