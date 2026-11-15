# 0005 — Planning evidence contract

Status: accepted for bounded resource screening; scientific limitations remain explicit. Reviewed 2026-11-14, T02 evidence reviewer.

The manifest uses exactly the EvidenceRef and EvidenceManifest fields frozen in the implementation plan. Unknown spacing, effective resolution, precision and identity fields are null. Spacing is a model or product setting, never a claimed error bound. Stable capability IDs are `ephemeris`, `horizon-catalog`, `horizon-custom`, `terrain-local`, `imagery`, `globe`, `mission-locations`, `user-assumptions`, `landing-readiness`. Additional `asset:<relative path>` entries identify actual bundled bytes with SHA-256. The dataset ID includes the catalog hash prefix. Rebuild hashes whenever assets change.

## Coverage decision

Use [2026-01-01T00:00:00Z, 2028-01-01T00:00:00Z). Catalog meta.n=17521 contains both boundary epochs and 17520 hourly intervals. The last epoch supports the preceding interval only. Do not extrapolate one more hour, shorten saved stays silently, or describe a boundary as a supported stay start. Endpoint fixtures are `{startIndex:0,endIndex:1}` and `{startIndex:17519,endIndex:17520}`; `{startIndex:17520,endIndex:17521}` is unsupported. Dates outside these bounds require an explicit unsupported-coverage result.

## Verified implementation conventions

`pipeline/build_dataset.py` uses east-positive longitude and latitude in degrees, spherical radius 1,737,400 m, terrain heights relative to that sphere, and local azimuth clockwise from north. Named horizons are sampled every 1° at heights 0/2/10 m; custom sites borrow the nearest 3° prepared mask at 2 m. Their 40 m fine and 240 m fallback DEM pixels are separate from ray spacing, angular sampling and display mesh spacing. The display terrain has nested 5/10/40 m cutouts with an 80 m base and coarser overviews; no single effective resolution is established.

Historical preparation at the 14 November review requested OBSERVER tables for Moon 301 from Earth center 500@399, quantities 14,15,20; solar diameter uses target 10 from Moon center 500@301, quantity 13, hourly. Parsing stores Earth range in km from AU using 149597870.700. Observer validation requests Sun 10 and Earth 399, coord@301, GEODETIC, site longitude/latitude/zero altitude, quantity 4 every 120 days. Those historical requests did not explicitly set TIME_TYPE, APPARENT or reference-system options. UTC-labelled catalog dates follow the observer-table UT assumption; the provider default and original response headers have not been independently archived here. Do not assert a newly verified time/aberration transformation.

The [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) documents apparent azimuth/elevation corrections including light time and stellar aberration and atmospheric refraction for Earth only. Lunar geometry is airless. The current derived Sun/Earth formulas are preserved; they are not a new complete apparent-coordinate implementation. [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) explicitly identifies MOON_ME of DE421. Catalog metadata says MOON_ME / Horizons MEAN_ME and DE441. Exact orientation equivalence and its error propagation remain unresolved; no transformation or numerical tolerance is fabricated.

Uniform disk fraction above the local sampled horizon is a straight local cut, not full terrain-disk integration. Narrow distant ridges, spatial borrowing and hourly event bracketing remain limitations. Do not interpret resource screening as landing certification.

## Validation and designations

Existing catalog validation records 112 samples with maxima Sun elevation 0.00071°, Sun azimuth 0.00019°, Earth elevation 0.00068°, Earth azimuth 0.00548°. These are historical comparison residuals, not source accuracy, confidence bounds or a newly rerun test. No ephemeris or geometry changed; no Horizons request was needed in this review.

[NASA release 24-136, 2024-10-28](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/) describes potential regions for further study. Generic `artemis` group display becomes “Published polar study site”; original source designations and dates in catalog source text remain immutable. Neither that release nor this review establishes current NASA approval of pins. No region polygons or mission reassignment are inferred.

The [NASA globe](https://svs.gsfc.nasa.gov/14959/) retains original geometry in the existing preparation metadata. Its unitless relief at nominal scale and polar artifacts cannot supply scientific local heights. Historical LROC imagery cannot supply selected-date shadow truth. Mission locations retain individual published/approximate/derived distinctions.

## Consequences and rollback

Evidence coverage distinguishes complete epoch coverage, partial spatial/physical assessment, borrowed custom masks and unavailable readiness evidence. Engineering assumptions remain user assumptions. Resource-screening results stay conditional where frame, mask or engineering assumptions matter; landing readiness remains unavailable. No data values, coordinates, science formulas or catalog IDs change. Revert source-copy and manifest changes together if rolling back. T03 supplies automated contract/endpoint tests; this repository checkpoint has no dedicated provenance suite yet.

## 15 November 2026 addendum — current planning-5 conventions

The current producer now explicitly requests UT and AIRLESS. Coordinate quantities14/15 retain their declared observing geometry; Earth range is requested separately as Earth399 from Moon centre500@301, quantity20, and converted from explicitly requested AU to km. The corrected catalog has17521 UTC boundary epochs. Earlier response/header provenance and cross-frame applicability limits above remain historical/unresolved; the new source is archived and hash-bound in docs/qa/scientific-audit/integration. Registered terrain cutouts now sample their declared coordinates using native pixel bilinear interpolation plus a halo; missing producer ray support stays unknown. This addendum supersedes current-tense range/request descriptions above without treating corrected transfer accuracy as physical surface accuracy.
