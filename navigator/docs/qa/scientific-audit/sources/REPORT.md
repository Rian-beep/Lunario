# Source, terrain and ice audit — 15 November 2026

**9 verified scoped claims, 6 uncertain claims, 3 failing discrepancies. Scientific acceptance remains open.** Verification here concerns metadata, byte identity, formula implementation and bounded source-to-bundle comparisons. It does not certify physical accuracy, mission readiness, terrain safety or resource recovery.

Baseline: `96079ae`, branch `codex/audit-sources`, isolated Clevo worktree `/tmp/lunario-audit-sources/navigator`. The locked evidence contract is unchanged. Existing public data, science implementations, canonical assessment, shared identities, UI and generated outputs were not edited. The deliverable adds reproducible audit scripts, offline primary-source captures, tests and findings. Necessary fixes outside this lane or requiring public-data regeneration are assigned to the integrator below.

## Evidence and coordinate conventions

[PGDA90](https://pgda.gsfc.nasa.gov/products/90) identifies the adjusted terrain in DE421 MOON_ME and separates DEM heights, effective resolution, height error and slope error. [PGDA81](https://pgda.gsfc.nasa.gov/products/81) identifies the 5 m mosaic in that frame and documents interpolation/blending. Its alignment residual is not a universal elevation accuracy guarantee. The [USGS lunar standards](https://psdi.astrogeology.usgs.gov/moon/standards/data_standards/) distinguish the reference sphere and realized lunar orientation frame. Sharing a radius does not establish frame equivalence.

The audit uses a Moon-centred 1,737,400 m reference sphere, selenocentric latitude in degrees, east-positive longitude, and **height above that sphere in metres**. Radius adds 1,737,400 m exactly once. Height is neither geoid-relative topography nor an Earth vertical datum. Polar projection is south-polar stereographic, central meridian 0°, unit scale at the pole, x east and y toward longitude 0°. Raster rows increase southward in projected y. Original COGs examined are PixelIsArea: corner tiepoints require half-pixel offsets to reach centres. The resulting source-centre positions were tested directly; page wording alone was not used to override TIFF tags.

Original topography is static for this comparison. The [PDS LDEM_16 label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.lbl) is V3.1, created 15 March 2019, with source times 13 July 2009 17:33:17 through 29 November 2016 05:48:19 as labelled. The catalog supports `[2026-01-01T00:00:00Z, 2028-01-01T00:00:00Z)` with 1 h forcing. No new ephemeris computation or Horizons pass is claimed. LCROSS event coordinates/time are separately recorded below.

`references/responses.json` preserves **36 exact successful HTTP responses, 5,365,794 decoded response-body bytes**, including COG ranges, five bounded original PDS pixel rectangles, primary HTML metadata, the PDS label and a NASA-hosted original impact-location paper. Each response records URL, requested Range, Content-Range, status, UTC retrieval, ETag/Last-Modified when supplied, byte length, SHA256 and base64 body. The offline replay test forbids uncaptured network access. `references/capture.json` records original sample windows, float values, projected coordinates, transformations, tolerances and failed retrievals. Downloads and temporary work use `/tmp`; no full multi-gigabyte DEM was downloaded. Source capture enforces per-response and aggregate limits.

## Bounded original-data comparisons

The source check reads original COG windows rather than hillshade brightness or rendered geometry. Source decoding uses the existing GeoTIFF library; scalar interpolation and integer global overlap weighting are independent of the production preparation loops. This validates transfer/calibration implementation against the same underlying data, not independent lunar observations.

| Source / grid | Original or selected pixel spacing | Bounded result |
| --- | --- | --- |
| [87S mosaic](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldem_87s_5mpp.tif), Connecting Ridge | 5 m; output 7.992202729 m | Three samples match; max absolute error 0.018998241 m |
| [83S adjusted DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_83S_10MPP_ADJ.TIF), Malapert | 10 m; output 23.976608187 m | Seven samples match; max absolute error 0.035648673 m |
| [80S adjusted DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_40MPP_ADJ.TIF), Odysseus | 40 m; output 32.046783626 m | Centre matches to 0.021791571 m; one unsupported point excluded; final node fails |
| [80S 80 m product](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF), overview IFD | 1280 m overview; output 1185.185185185 m | Two samples match; max absolute error 0.067475370 m; one point beyond source-centre support excluded |

Thus **13 supported, un-clamped samples pass**, one supported edge sample fails, and two unsupported requests are excluded. Fine-grid tolerance is 0.0551 m: 0.005 m initial rounding + 0.05 m packing + 0.0001 m arithmetic allowance. Overview tolerance is 0.2001 m: 0.05 m initial rounding + 0.15 m packing + 0.0001 m allowance. The initial capture used an unnecessarily tight 0.1551 m overview bound; it was corrected from the actual `prepare-terrain.mjs` 0.1 m decimal rounding. No sample or status changed. These are encoding bounds, not terrain-error estimates.

The global [original IMG](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img) supplies signed little-endian 16-bit DN, 0.5 m per DN. The fresh label matches the bundled label byte-for-byte. HEIGHT = DN × 0.5 m; the label's 1,737,400 m OFFSET belongs to planetary radius. Five output cells, including opposite corners and polar-region examples, exactly match independently calculated quarter-pixel area weights: **0 DN / 0 m discrepancy** after rounding. These are coordinate-cell area weights, not spherical surface-area integration. Native spacing is 1895.21 m at the equator; 2560 × 1280 output equatorial spacing is approximately 4264 m. Output spacing, quantization and effective resolution are different quantities. Complete upstream IMG SHA256 was not freshly recomputed; the full bundled packed/decoded assets were checked.

A source-measured Malapert slope stencil at latitude −85.99985841143967°, longitude 359.99670036862335° east gives **11.253694481°**, versus **11.204527367°** from bundled values: signed error −0.049167114°. Propagating the fixed 0.0551 m encoding error through rectangular central differences and stereographic scale yields a 0.186436440° bound. Ground stencil spacing is 23.947403214 m; diameter is twice that. This passes a regional, single-stencil encoding comparison. It does not validate all slopes or compare with a PGDA slope-error raster. The numerical display cutouts and catalog's original 40/240 m nearest-sampled slope/horizon path have different supports and are not expected to produce identical local derivatives.

On a synthetic sphere, the coarse 200-distance/2° ENU horizon at observer height 2 m differs from analytic tangent dip −0.086936571934° by at most **0.000044817539°**, below the predeclared 0.001° algorithm bound. Angular interpolation wraps at north and retains unknown sectors. These are formula tests, not physical skyline evidence. Global nodata fixtures retain unknown height, slope and horizon. Boundary-touching observed darkness stays censored, and unknown coverage does not become darkness.

## Failing discrepancies and required handoff

**S03 — patch-edge registration.** At fine40 Odysseus final grid index 263168, declared projected coordinate `(15747.95321637427, 291732.04678362573) m` gives primary interpolation **2667.8980308327373 m**, while bundled height is **2668.5 m**. Before/after discrepancy remains **+0.6019691672627232 m**, exceeding 0.0551 m. No correction was applied to read-only data.

The builder's bilinear upsampling clamps its last output against the cutout's last source centre. That clamped source value is 2668.499755859375 m, agreeing with bundled data to 0.000244140625 m, but its position differs by `(−7.953216374262411, +7.953216374269232) m`, about 11.25 m. The overview's last declared node similarly extends 94.8148 m on each axis beyond its last source centre. Interior nodes agree. **Integrator action:** authorize reproducible regeneration with a source-pixel interpolation halo or an explicitly registered resampler, preserving interior registration. A blanket spacing edit would move correctly registered interior nodes. Recheck edges, source samples and dependent slopes/scene contact before updating identities.

**S10 — incomplete prepared horizon becomes finite.** AST-selected, unchanged `sample_dem`, `sample_surface` and `horizon_masks` run with synthetic 64 × 64 DEMs. Both DEMs lack a location along a near ray, but ≥8 other valid samples suffice to return **−0.1611439672843969°** rather than unknown. Before/after value is unchanged. The global runtime retains unknown rays, while this prepared pipeline skips missing samples. **Ephemeris-lane/integrator action:** decide and implement conservative unknown-ray treatment or a mathematically justified occlusion bound. No claim is made that a particular bundled ray contains such a hole; original 40/240 m nodata prevalence is missing. The decorator-free probe checks policy, not Numba execution or physical accuracy.

**S11 — stale asset identity.** The 58-file/62,707,258-byte inventory finds 24 comparable manifest identities: 23 match, one fails. `public/data/imagery.json` is SHA256 `da76bb1bf5b8498a708dec97c352718139249db7fc8a4e14c21437139368d717`, whereas the manifest records `992f25593bf66c1b660e0f608351cfe254dd60343a956d9b19ae662815e4e9f5`. Both values were reproduced using `git show 96079ae:./…`; this discrepancy exists at the nominated baseline. Before/after hashes are unchanged. **Integrator action:** review the semantic imagery change and rebuild the shared manifest through its established workflow. A mismatch is an integrity discrepancy, not proof that terrain numbers are wrong.

## Remaining evidence gaps and interpretation

The inventory decodes **24 polar grids, 4,541,976 samples, 91,619 unknowns** without sample-count errors. It records actual SHA256/size for all current assets. It does not fill missing immutable source versions, upstream whole-COG hashes, original source bytes, error/count rasters or complete manifest coverage. Checksums establish byte identity, not scientific accuracy.

The pipeline's Odysseus comparison uses a rounded published point/elevation and can choose a centre offset by closeness to that point. Existing metadata and sampled grid registration agree with the half-pixel convention, but matching a single approximate location to an 800 m guard cannot establish georeferencing accuracy. Retain TIFF registration as authority rather than treating that check as a calibrated vertical/positional error budget.

DE421 ME source orientation, catalog DE441/MEAN_ME labels, and M3 `GCS_Moon / D_Moon_2000` lack a demonstrated common realized frame here. Original catalog response headers/requests are absent. No rotation matrix, frame-equivalence tolerance or metre registration uncertainty is fabricated. EFFRES/ERR maps, narrow obstacles, radial/azimuth discretization and frame effects have no propagated physical bound.

Named horizons sample 1° at 0/2/10 m observer heights; custom prepared masks use 3° azimuth at 2 m and may be spatially borrowed. Global rays use 200 logarithmic distances 1 m–1000 km at 2° azimuth. None proves the intervening skyline; interpolation can omit a ridge. Uniform visible-disk exposure is not electrical power. A regional 0–100 weighted index and slope preference are rankings, not a probability or safety threshold. Canonical `evaluateScenario` remains untouched.

The ice loader preserves **169 representative PSR points with 820 associated M3 detections**, not 169 mapped deposits. Fresh retrieval of the [author archive](https://doi.org/10.5281/zenodo.4646092) failed with HTTP 403 through both official file URLs. The original ZIP/member hashes and extraction totals therefore remain **uncertain in this new audit**, despite existing parser tests passing. M3 sampling (~280 m), PSR association, missing per-point epochs and absent detection footprints cannot establish concentration or excavatable ice. [NASA/JPL's original M3 account](https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles/) supports surface spectral detection, not reserves.

The fresh [NASA-hosted Marshall paper](https://ntrs.nasa.gov/api/citations/20140005563/downloads/20140005563.pdf) matches its pinned 1,138,580-byte SHA256 and the LCROSS Centaur factual coordinates **−84.6796° latitude, −48.7093° east longitude**, event **2009-10-09T11:31:19.506Z**. Reported 1σ location uncertainties are 115 m along latitude and 44 m along longitude; they are not sampling resolution or a deposit footprint. The marker's abundance, unit and resolution remain null. Neither impact ejecta nor spectral associations establish crater-wide grade, depth or extraction feasibility.

## Reproduce and verification

Run from the `navigator` directory. Uses installed project dependencies, Python/numpy and `pdftotext`; no package installation or app server is required.

```bash
# Network source capture, bounded, caching only in /tmp:
node scripts/audit-sources-fetch.mjs
# Current-byte inventory and unchanged pipeline probe:
python3 scripts/audit-sources-inventory.py
python3 scripts/audit-sources-pipeline.py > docs/qa/scientific-audit/sources/pipeline-probe.json
# Regenerate the evidence-contract result document:
python3 scripts/audit-sources-results.py
# Entirely offline checks, including original COG HTTP replay:
npx tsx --test tests/audit-sources.test.ts
npx tsx --test tests/terrain.test.ts tests/terrain-lod.test.ts tests/global-horizon.test.ts tests/suitability/*.test.ts tests/ice/*.test.ts
npm run typecheck -- --incremental false
npm run lint
```

Fresh verification: **12/12 audit tests and 53/53 focused regression tests pass**, zero failed/skipped; the regression suite also runs 7 Python parser tests. Full nonincremental typecheck and repository lint exit 0 without errors or warnings. Audit script syntax and evidence-contract fields pass. Three initial type errors in newly authored tests were corrected; no production defect or pre-existing type failure is inferred. Final receipts are in `checks.json` and `checks/`. Tests deliberately reproduce the known discrepancies; a green test command does **not** make the audit all-green. No UI, offline/browser, full dataset regeneration, new Horizons verification or mission-critical certification is included. `slop-scan` is not configured or installed; no extra tooling was installed. No credentials, paid calls, additional agents or shared browser/server sessions were used. This owned report records the durable audit milestone and unresolved work for the parent; shared memory hubs remain outside this worker's authorized paths.
