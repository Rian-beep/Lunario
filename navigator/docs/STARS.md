# Bright stars for lunar display context

`lib/stars.ts` exports `Star`, the immutable `BRIGHT_STARS` array, `starDirectionJ2000(star)` and `moonFixedStarDirection(star, epochMs)`. The module statically imports `public/data/stars.json`; it makes no runtime network request and can be bundled by the existing offline esbuild path. Integration and generated HTML remain the root integrator's responsibility.

This is approximate visual context, **not navigation, star-tracker simulation, pointing certification or planning-assessment evidence**. It does not replace `lib/astro.ts`, Horizons Sun/Earth samples, terrain horizons or `evaluateScenario`.

## Data, attribution and licence

Star data: **HYG Database v4.1 by David Nash / Astronexus**, derived subset by SolarReach contributors, licensed **[Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**. This subset is distributed under that same licence. Preserve the attribution, source and licence with redistributed data and credit changes; an integrated UI/offline distribution should expose this attribution in its data credits. No endorsement is implied.

Downloaded directly from the catalogue creator's public repository on 14 November 2026:

- [Pinned CSV](https://raw.githubusercontent.com/astronexus/HYG-Database/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/CURRENT/hygdata_v41.csv).
- [Creator's field documentation and epoch notes](https://github.com/astronexus/HYG-Database/blob/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/README.md).
- [Creator's licence declaration](https://github.com/astronexus/HYG-Database/blob/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/CURRENT/LICENSE).

HYG compiles Hipparcos, Yale Bright Star and Gliese data. It is a compiled catalogue, not a new observation campaign. Its documented coordinate epoch and equinox are both 2000.0. `mag` is apparent visual magnitude, not absolute magnitude or an instantaneous brightness prediction for variable stars. Names are source labels; HYG includes unofficial companion-name suffixes, so do not present every label as an IAU-approved name.

The subset contains **523** rows with `mag <= 4.0`, excluding the catalogue's Sun row (`id = 0`). Coordinates and magnitudes are finite. Selection is independent of lunar site, date and visibility; it is not a claim that all 523 stars are visible simultaneously. Sorting is ascending magnitude, then numeric HYG ID. Every point is a source record; there is no random filler or synthetic photometry.

| Export field | Source / conversion |
| --- | --- |
| `id` | `HYG:` followed by the source `id`, retained for source-row lookup |
| `name` | `proper`, else trimmed `bf`, else `HR <hr>`, `HIP <hip>` or the HYG ID |
| `raDeg` | Source `ra` in hours multiplied by 15; rounded to nine decimal places (conversion precision, not observational accuracy) |
| `decDeg` | Source `dec`, degrees |
| `magnitude` | Source `mag`, apparent visual magnitude |

The raw CSV SHA-256 is `d9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd`. The JSON metadata carries the revision, digest, licence, epoch, units and transformation. For example, Sirius is source ID 32263, RA 6.752481 hours, declination −16.716116°, V −1.44. Multiplying RA by 15 gives 101.287215°.

## Axes, rotation and time

`starDirectionJ2000` returns a dimensionless unit tuple `[x, y, z]`:

```text
x = cos(dec) cos(ra)
y = cos(dec) sin(ra)
z = sin(dec)
```

The right-handed axes are +X toward the J2000 equinox, +Y toward RA 90° / 6 h, and +Z toward the north celestial pole. Coordinates must be finite, RA in `[0, 360)` and declination in `[-90, 90]` degrees; invalid coordinates throw `RangeError`.

`moonFixedStarDirection` returns dimensionless **IAU_MOON** axes: +X equator / prime meridian, +Y equator / 90° east, +Z lunar north pole. Input `epochMs` means UTC Unix milliseconds, as returned by `Date.parse` for a UTC timestamp. Nonfinite or out-of-JavaScript-Date-range values and dates before 1972-01-01 UTC throw `RangeError` because the bundled leap-second conversion starts then. This computational range is not an accuracy guarantee. Intended use is the app's 2026–2028 display period.

The orientation source is NASA/JPL NAIF's [pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), specifically `BODY301_POLE_RA`, `BODY301_POLE_DEC`, `BODY301_PM`, their 13 nutation/precession amplitudes and `BODY3_NUT_PREC_ANGLES`. These are the **IAU 2009 lunar coefficients retained in that kernel**: its comments explicitly state that the 2015 report supplied no Earth/Moon orientation update. Pole angles are in degrees; `d` is TDB days since JD 2451545.0, 2000-01-01 12:00:00 TDB, and `T = d / 36525`.

```text
alpha = 269.9949 + 0.0031 T + sum(a_i sin E_i)
delta =  66.5392 + 0.0130 T + sum(b_i cos E_i)
W     =  38.3213 + 13.17635815 d - 1.4e-12 d² + sum(c_i sin E_i)
E_i   = phase_i + rate_i T
```

All 13 published phase pairs and amplitude triplets are transcribed in `lib/stars.ts`, including zero amplitudes and the quadratic prime-meridian term. There is no invented constant spin or omitted libration series. The [NAIF PCK rotation convention](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/pck.html#Orientation%20Models%20used%20by%20PCK%20Software) gives the passive inertial-to-body product `R3(W) R1(90° − delta) R3(90° + alpha)`; the code applies these rotations in that order from right to left.

UTC is converted using the coefficients and leap dates in [naif0012.tls](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls): `TT − TAI = 32.184 s`, `TAI − UTC` from its effective-date table, and the periodic `TDB − TT = 0.001657 sin(M + 0.01671 sin M)` seconds, where `M = 6.239996 + 1.99096871e-7 × TDB_seconds_since_J2000` radians. Three iterations solve the periodic term. This avoids treating UTC noon as J2000 TDB noon. The last bundled leap date is 2017-01-01 (37 s); later dates assume no additional leap second. **Update the table when a later leap second is introduced.** JavaScript Unix timestamps cannot represent the leap-second instant itself. This is not a general civil-time conversion service.

## Frame and apparent-position limits

NAIF describes IAU_MOON as a trigonometric approximation to the lunar Mean Earth/Polar Axis frame. Its kernel recommends the lunar binary PCK plus matching frame kernel for greater accuracy. This output is **not asserted identical** to the app's `MOON_ME / Horizons MEAN_ME` catalogue or LOLA's DE421 MOON_ME terrain. No constant frame correction or invented error bound is applied. The unresolved frame evidence boundary in ADR 0005 remains open. A renderer may use these axes as an explicitly approximate Moon-fixed background, with its existing body-to-scene convention; it must not use this helper to pass terrain/pointing requirements.

HYG positions remain fixed at J2000.0: **proper motion is not propagated** despite those fields existing upstream. No parallax, radial-motion propagation, observer position, stellar aberration, gravitational deflection, occultation or local horizon test is included. Pole/meridian evolution is a frame rotation, not a stellar proper-motion correction. Magnitudes are fixed catalogue values; no variability, exposure or instrument response is modelled. The small J2000-equatorial versus ICRF distinction is also ignored, consistent with this approximate display use. No arcsecond or navigation accuracy is claimed.

## Reproduction and verification

To recreate the subset, download the pinned CSV, check its SHA-256, and use Python's `csv.DictReader`: retain non-Sun rows with finite RA/declination/magnitude and `float(mag) <= 4`, apply the field mapping above, then sort by `(magnitude, int(id[4:]))`. Keep the metadata and attribution with the output. This process needs no astronomy package or runtime service.

The focused tests include known inertial axes, all catalogue norms, pair-angle/handedness preservation, invalid input and seven independent CSPICE reference matrices. Matrices cover 1972, UTC noon on the J2000 calendar date, both sides of the 2016 leap second, and 2026–2028 epochs. The matrix comparison tolerance is `2e-11` per dimensionless component: an implementation-regression tolerance, **not model accuracy**.

Reference matrices were generated on 14 November 2026 with SpiceyPy 8.4.0 / CSPICE_N0067, outside the repository and without adding a runtime dependency:

```python
import spiceypy as spice
spice.furnsh("pck00011.tpc")
spice.furnsh("naif0012.tls")
matrix = spice.pxform("J2000", "IAU_MOON", spice.str2et("2026-11-14T12:00:00"))
```

Downloaded kernel SHA-256 values:

- `pck00011.tpc`: `3dff7b1dbeceaa01f25467767d3fa25816051c85d162d1edf04acb310ee28bb1`.
- `naif0012.tls`: `678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b`.

Worker decision record, 14 November 2026: stay within the four owned new files; use sourced HYG rows and the full published IAU lunar series; keep the approximation separate from mission assessment; leave UI credits, renderer wiring, server, builds and offline artifact generation to integration. Validation results are recorded below after execution. No shared contracts or source geometry were edited, so this lane does not claim a newly run Horizons verification.

Validation on this isolated worktree, 14 November 2026:

- `npx tsc --noEmit --incremental false`: exit 0, no diagnostics or pending cross-lane dependencies.
- `node --import tsx --test tests/stars.test.ts`: 15 passed, 0 failed, 0 skipped; seven CSPICE matrix comparisons passed at the stated tolerance.
- `npx eslint lib/stars.ts tests/stars.test.ts`: exit 0, no diagnostics.
- Direct comparison against the downloaded, hash-checked pinned CSV: exact selected ID set and all RA/declination/magnitude conversions passed for 523/523 rows.
- No server, shared browser, production build or standalone artifact was started/generated. End-to-end renderer/offline integration remains with the integrator; these numerical and data checks are not user acceptance.
