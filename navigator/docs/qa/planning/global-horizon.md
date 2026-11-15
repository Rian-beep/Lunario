# Global coarse numerical horizon fallback

This additive module supplies a computed coarse skyline at arbitrary lunar coordinates from calibrated numerical LOLA elevations. It does not use brightness, image shadows, the unitless NASA globe vertices, or invented site measurements. Parent integration must retain prepared named-site and polar-grid authority and make global-context use explicit in scenario identity. The global result remains partial scientific evidence, never fine landing-hazard certification.

## Source and calibration gate

The authoritative source is [PDS LOLA LDEM_16.IMG](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img), with its [detached label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.lbl). Product LDEM_16 V3.1 was created 2019-03-15. The committed metadata preserves the complete label and its SHA-256, source IMG SHA-256, and decoded/packed output hashes. [NASA SVS CGI Moon Kit 4720](https://svs.gsfc.nasa.gov/4720/) independently explains numerical LOLA height-map calibration; its aesthetic color map is explicitly unsuitable for science. No SVS color map or unsigned TIFF supplies this implementation's physical samples.

The PDS label establishes signed little-endian 16-bit samples, 5760 columns × 2880 rows, scaling factor 0.5, and reference radius 1,737,400 m. Physical elevation is DN×0.5 m; planetary radius is 1,737,400+DN×0.5 m. This is not the SVS unsigned TIFF encoding, which requires removing its documented +20000 DN shift before interpreting half-metres. Confusing those encodings introduces a 10 km offset.

Registration is pixel-centred, north-to-south rows, east-positive 0–360° longitude, 16 pixels/degree. The frame is **MEAN EARTH/POLAR AXIS OF DE421**, not an unproved transformed frame. Source map scale is 1895.21 m/pixel at the equator. PDS notes gridded interpolation and possible 45° latitude-band edge artifacts; neither this source scale nor output spacing establishes effective resolution or physical error. Those accuracy fields remain null.

## Prepared product

`node scripts/prepare-global-terrain.mjs` fetches only the 33,177,600-byte source IMG and small label, with byte limits and a 120 s source timeout. Existing source files are reused from `SOLARREACH_GLOBAL_CACHE` (default `/tmp/solarreach-global-source`). Any unsupported label/calibration/registration or wrong source size fails preparation. No large new source archive or dependency install is required.

Native source cells are area-weighted into a 2560×1280 simple-cylindrical grid, then rounded to the nearest half-metre. The output grid is 0.140625°; north/south angular spacing corresponds to about 4.264 km and east/west spacing decreases toward the poles. Output spacing is not effective resolution. Source values outside the label’s declared DN range -18150…21580 propagate as an unknown output cell using internal sentinel -32768; they are never averaged as physical heights. The actual prepared product has no missing output cells and numerical elevations from -8868 to 10447 m. This describes the resampled model, not the true lunar extrema or completeness of local hazards.

Files:

- `public/data/global-terrain.json`: schemaVersion1, source/calibration/registration, complete PDS label, settings/notes, actual sample fixtures and packed asset identities.
- `public/data/global-terrain.bin.gz`: gzip of little-endian Int16 DN; 6,553,600 decoded bytes. DN×0.5 m gives height above the reference sphere. -32768 means unknown. Packed size is 6,025,781 bytes.

## Runtime API and offline integration

`loadGlobalTerrain(): Promise<GlobalTerrainData>` reads `window.__SOLARREACH_GLOBAL_TERRAIN__` when present, otherwise local `/data/global-terrain.json` and `metadata.packed.url`. For standalone output, inject the metadata with `encodedHeights` containing base64 of the **gzip bytes**. No source-server request occurs at runtime. Parent bundling owns injection; this change does not modify the standalone builder or application consumers.

`decodeGlobalTerrain(metadata, optionalGzipUint8Array): Promise<GlobalTerrainData>` validates calibration/shape, verifies compressed SHA-256, bounds streaming decompression to the declared decoded length, verifies decoded SHA-256, and decodes explicitly little-endian Int16 values. It uses browser-native DecompressionStream and Web Crypto; unavailable APIs or corrupted data fail explicitly. No scientific array is decoded from a visualization asset.

`sampleGlobalHeight(data, latDeg, lonDeg): number | null` uses bilinear interpolation on the resampled grid, retaining missing cells. Longitude wraps; input coordinates are not rounded. Within the final half-cell of either pole, interpolation tends to the first/last-row mean at the exact pole. That is a declared coarse polar-cap interpolation, not an additional measured polar point. Missing support or invalid coordinates returns null.

`terrainForGlobal(data,latDeg,lonDeg,heightM)` returns `TerrainChoice` plus `{kind:'global-coarse',coverage:'partial'|'unavailable',sourceSpacingM,outputSpacingM,notes}`. The mask has 180 azimuth samples at 2°, with independently computed observer height above the coarse surface. Finite heights from 0 to 10000 m are an explicit implementation bound, not a prepared-height or accuracy claim. Invalid inputs or missing observer support return unavailable. A missing radial sample makes that entire ray unknown rather than assuming a clear horizon. A valid computed point uses requested cellLat/cellLon and distanceKm0; exact=false denotes a coarse approximation, not nearest-cell positional borrowing. Parent provenance must use kind/coverage to explain this distinction rather than calling it a prepared polar mask.

The ENU ray march follows the existing pipeline's spherical-curvature expression: `atan2((R+hTarget)*cos(theta) - (R+hObserver+height), (R+hTarget)*sin(theta))`, with theta=surfaceDistance/R. Great-circle target coordinates are built from radial, east and north unit vectors, avoiding longitude singularities at poles. Azimuth is clockwise from north relative to the selected meridian; at the exact pole, that meridian defines the otherwise nonunique azimuth zero.

Each point samples 200 logarithmic distances from 1 m through 1000 km per azimuth (36,000 height queries). This is an explicit coarse numerical setting, not a guarantee that every obstructing feature was sampled. Interpolated samples at distances finer than grid spacing do not recover fine terrain. Computation is synchronous and bounded; callers should avoid running uncached points on every pointer movement. The per-dataset cache retains 64 exact normalized-coordinate/height/hash keys without rounding inputs, returns independent mask copies, and cannot be poisoned by mutating a returned mask.

## Integration boundary and verification

Use the same selected fallback for display, analysis, energy/contact and exports. Prepared named masks and supported polar 2 m custom masks retain precedence. Legacy saved input and raw demonstration coverage must not silently upgrade; the parent owns explicit `terrainMode`, dataset/model identity changes, coverage presentation and export recomputation. A global coarse resource result may be conditional or fail modeled constraints; full landing readiness still needs its external evidence. Unsupported/missing global data must remain unknown.

Five tests exercise committed hashes and label calibration; rejected miscalibration; analytic flat-sphere tangent dip and explicit radial-discretization value; known synthetic eastward height bump; longitude wrap and poles; missing rows/observer support; invalid inputs; exact coordinate identity and cache mutation isolation. Synthetic fixtures are labeled by construction and test geometry, not lunar measurements. The 1e-10 degree assertions compare floating-point formula equivalence only; they are not claimed lunar accuracy or physical uncertainty. Parent-level all-consumer and offline artifact verification remains required.

Fresh final checks: preparation completed from the downloaded primary PDS source and reran with unchanged asset identities; five tests passed locally and on isolated Clevo remote Node using existing dependencies. Both packed-byte loading and standalone gzip-base64 injection decode were verified. Final local `tsc --noEmit` exited 0. This is remote numerical validation, not a claim of remote Sol authorship or integrated UI/offline artifact verification.
