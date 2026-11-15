# Sun/Earth ephemeris audit — 15 November 2026

**6 verified implementation claims, 4 uncertain claims, 2 failing comparisons. Not mission-critical certification.** Directions agree within the pre-registered screen. Earth angular size had a missing site-parallax correction, fixed here. A separate apparent-range input discrepancy remains; the expanded `verify:horizons` deliberately exits 1.

Baseline: `96079ae`; locked contract: `../CONTRACTS.md`. No public data, terrain, assessment, shared identities, UI or generated web/offline files changed. The numerical change needs the integrator's model-identity decision before integration. Machine-readable claims are in [results.json](results.json); tolerance registration was committed before expanded comparisons (`ac89742`).

## Primary evidence and conventions

Fetched fresh NASA/JPL observer responses on 2026-11-15. The 23 bounded responses contain 233 rows: 112 site/body rows, 21 centre rows, and 100 five-minute event rows. [raw/](raw/) stores the exact response body, SHA256, complete request parameters/URL, HTTP status and fetch time. [comparison.json](comparison.json) and [events.json](events.json) retain response identities. No provider errors occurred in these retained calls; provider failure rejection is tested, not counted as physical validation.

The [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), quantities 4/13/14/15/20, defines apparent AZ/EL, full angular diameter, apparent subobserver/subsolar coordinates and light-time-corrected observer range. AIRLESS removes atmospheric refraction, **not** light time, stellar aberration or gravitational deflection. Azimuth increases north→east, clockwise; elevation is relative to the reference-surface normal. The Moon's specified site reference is a sphere of radius **1,737,400 m**, east-positive longitude and planetodetic latitude in degrees, altitude **0 m**, with local north/east/up axes. These are defined audit points; the named coordinates do not assert that real hardware is at reference-sphere altitude.

The [API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html) identifies documentation version 1.3 (June 2025); actual JSON response signatures are **NASA/JPL Horizons API 1.2**. The parser pins the observed response identity and rejects unknown versions. Headers identify target/centre **DE441**, lunar target `MOON_ME` or lunar observer `MEAN_ME`, and `eop.261113.p270209`, with data through 2026-11-13 and predictions through 2027-02-08. The exact EOP identity is recorded for every response; later epochs use the provider's extrapolation conventions.

[NAIF time definitions](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/time.html) distinguish UTC and dynamical TDB. We explicitly request `TIME_TYPE=UT`, Julian dates, Gregorian calendar, fractional seconds and KM. For these post-1962 epochs Horizons UT is UTC. Rows are matched to requested epoch identities within 1 ms of decimal-JD conversion, never assigned by row index without checking the timestamp. TT/TDB headers, missing/extra epochs, wrong sites, frames, target and units are rejected. JavaScript timestamps use POSIX milliseconds and cannot represent leap-second labels; future UTC leap seconds are unknown. These checks establish the fresh fixture convention, not provenance of the original catalog generation.

The [NAIF frame kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf), dated 2025-04-16, maps `MOON_ME` to `MOON_ME_DE440_ME421`, a fixed DE440-PA rotation closely aligned to DE421-ME. [NAIF frame requirements](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/frames.html) and the Horizons manual support this interpretation; they do not make `IAU_MOON`, PA and ME interchangeable. No terrain transform was tested or silently applied.

## Inputs and measured results

Catalog SHA256: `00d28b6c04511cae06353c7a9aa9ca7c35c9f7146821a824e49b138b4b1c0153`. Coverage is 17,521 hourly epochs, 2026-01-01T00:00:00Z through 2028-01-01T00:00:00Z; the last sample is an endpoint, not an extra supported interval. Fresh source inputs were compared with the actual decoded little-endian catalog, not an independently reconstructed replacement.

Seven UTC epochs: 2026-01-01 00:00; 2026-11-14 00:00; **2027-06-29 11:00** (catalog Rian demo start); **2027-07-20 10:00 and 11:00** (documented real-demo alternative contact bracket); 2027-12-31 23:00; 2028-01-01 00:00. Eight reference-sphere sites: connecting-ridge (−89.53432°,209.94767°E), Malapert (−86°,0°), Apollo 11 (0.67416°,23.47314°E), equator (0°,0°), near north pole (89.99°,0°), far side (0°,180°), and dateline points (35°,179.99°) and (−35°,−179.99°). The last five are defined test locations, not published landing claims.

| Comparison | Measured maximum | Pre-registered limit | Outcome |
|---|---:|---:|---|
| Decoded directions, 112 rows | 0.008222674° angular separation | 0.020° | Pass |
| Encoded source lat/lon, 7 epochs | 0.004967° solar; 0.003858° Earth | 0.005001° each coordinate | Pass |
| Archived Earth→Moon range vs fresh same-direction quantity 20 | 0.015520 km (15.52 m) | 0.050 km | Pass |
| Encoded full solar diameter | 0.300 arcsec | 0.500001 arcsec | Pass |
| Site solar semidiameter, 56 rows | 0.000043889° | 0.000080° | Pass |
| Site Earth range using catalog input, 56 rows | **65.896385 km** | 5 km | **56 fail** |
| Site Earth semidiameter before fix, 56 rows | **0.004976004°** | 0.000100° | **52 fail** |
| Site Earth semidiameter after fix, 56 rows | **0.000167497°** | 0.000100° | **40 still fail** |

[TOLERANCES.md](TOLERANCES.md) contains the locked rationale. Centidegree coordinate quantization alone permits a 0.007072° vector perturbation. Great-circle error is used near zenith because raw azimuth is ill-conditioned; elevation and an elevation-scaled azimuth gate also run. Limits are implementation acceptance thresholds, never measurement uncertainties or engineering safety margins. No tolerance was widened after seeing failures.

### Fixed discrepancy and remaining range failure

`buildSeries` originally used Moon-centre range for Earth's semidiameter at every lunar location. It now uses the length of the same approximate Earth vector after subtracting the 1,737.4 km site position. Cartesian ENU tests independently form body/site vectors at the subearth point, limb, antipode, poles and dateline. The baseline numerical regression fails; the fixed one passes. [before.json](before.json) retains all 112 baseline measurements. Initial regression: 13/14 pass; final expanded regression on isolated unmodified `96079ae` lib files: 14/15 pass, exactly the missing-parallax test fails; fixed: 15/15 pass. The baseline reproduction harness supplies only its own distance diagnostic; baseline `lib/astro.ts` remains byte-for-byte archived source.

The catalog was prepared from **Moon observed at Earth centre**, quantity 20. That is an apparent range, not a reciprocal simultaneous geometric distance and not the **Earth observed at Moon** quantity needed for this use. Fresh same-direction range matches the actual stored float32 input within 15.52 m, excluding endian, AU conversion and gross UTC-offset faults as the explanation. Replacing only the range in an audit diagnostic with fresh **Earth from Moon centre** quantity 20 reduces maximum site-range residual to **0.266475 km** and semidiameter residual to **0.000000663214°**. This strongly supports the reversed-apparent-range convention as the remaining cause; it is not proof of independent physical accuracy. Quantized subearth directions and full apparent-coordinate non-equivalence remain.

The 5 km range pre-registration underestimated this reversed-light-time effect. It remains unchanged and **fails**. Direct Earth-from-Moon inputs are not written into public data. The integrator must coordinate a reproducible catalog/pipeline schema/input correction, provenance update and model identity. Downstream consumers using `earthRangeKm` as lunar observer distance (radio, engineering or scene code) need owner review. Sun/Earth centre-direction formulas remain unchanged. Earth any-limb summaries/display size can change with the fixed semidiameter; Earth-centre contact predicates remain unchanged.

### Finite disks, parallax and event timing

The Sun formula uses an infinite-distance direction. A separately constructed finite-distance Cartesian Sun, using the fresh source range, bounds omitted lunar-site parallax below 0.0007° over the tested sites. This supports its stated coarse direction approximation; it is not a full apparent astrometry solver. Solar semidiameter retains its rounded Moon-centre source approximation. No Sun range series is stored; recovering distance from rounded diameter cannot provide high-precision range evidence.

Synthetic straight-horizon tests separately verify any solar limb, solar centre, Earth centre and any Earth limb. Earth's centre threshold is the communication-screen convention; seeing a limb is not antenna acquisition or station availability. Uniform disk fractions ignore limb darkening and two-dimensional terrain occlusion.

Four actual smooth-horizon settings, checked with 25 fresh samples each at 300 s spacing:

| Event | Hourly model bracket UTC | Fresh five-minute bracket UTC |
|---|---|---|
| Equator Sun centre | 2027-06-26 15:00–16:00 | 15:35–15:40 |
| Equator Sun upper limb | 2027-06-26 16:00–17:00 | 16:05–16:10 |
| Near north pole Earth centre | 2027-06-22 15:00–16:00 | 15:20–15:25 |
| Near north pole Earth upper limb | 2027-06-23 06:00–07:00 | 06:55–07:00 |

All four fresh brackets lie inside the hourly model bracket. This only verifies those four crossings against the same underlying JPL ephemeris. It neither proves every terrain event is bracketed nor supplies sub-hour operational timing. Rapid terrain azimuth structure, missed multiple crossings, shallow/tangent events, quantization, heights and EOP/leap-second uncertainty remain unbounded. `poseAt` is display interpolation, not additional physical forcing.

## Parser and provenance audit

The old `verify:horizons` assigned epochs from start time + row position, checked only numeric fields/count, used a single six-hour window and wrote a shared historical record. Its first fresh run passed 56 rows (max AZ 0.011576150°, EL 0.008829295°). The replacement calls the explicit bounded audit, archives source identity and fails when numerical comparisons fail; it does not overwrite the earlier shared report.

The Python source requests Moon 14/15/20 from Earth and Sun 13 from Moon, parses calendar-minute rows, converts AU to km with 149597870.700 and rounds coordinates/diameter before writing little-endian arrays. Its requests rely on observer UT/airless defaults; its cache checks length but lacks archived request/header/checksum binding. Original raw responses are not present in this checkout. Fresh input agreement supports present numerical compatibility, not original provenance. No Python regeneration was attempted: system Python lacks `tifffile`, and terrain rasters/public-data regeneration are outside this lane. No skipped Python verification is counted as passed. The station-evidence Horizons adapter was inspected read-only: it explicitly requests UT/KM/AIRLESS, verifies station/ITRF93 and hourly JDUT identities, rejects pre-1962 UTC relabelling and limits requests; this audit does not requalify DSN station availability or its independent kernel fixtures.

## Reproduction and checks

From `navigator/`, with existing dependencies:

```bash
npx tsx --test tests/audit-ephemeris.test.ts
bash scripts/audit-ephemeris-baseline.sh  # exits 0 only if expected baseline RED reproduces
npx tsx scripts/audit-ephemeris.ts        # offline; expected exit 1 for retained failures
npx tsx scripts/audit-ephemeris-events.ts # offline; exit 0 for these four event brackets
npm run verify:horizons                  # fresh network; expected exit 1, retains source/errors
# Refresh bounded event fixtures only when deliberately collecting new evidence:
npx tsx scripts/audit-ephemeris-events.ts --live
npm test
npm run typecheck -- --incremental false
npm run lint
```

Fresh results: **15/15 focused tests**, **1000/1000 full tests**, zero failed/skipped/cancelled; nonincremental typecheck and full lint exit 0. Baseline red reproduction exits 0 after asserting the expected numerical failure. Fresh expanded provider comparison exits 1: **19 valid tables, 112 site samples, zero direction failures, 56 range failures and 40 semidiameter failures**. Four event comparisons pass offline and live. `git diff --check` passes. `slop-scan` is unavailable on PATH; repository historical triage was read, no arbitrary tooling installed.

The passing software tests verify bounded formulas, decoded inputs and rejection behavior. Independent observed lunar sky directions, qualified terrain/frame/height registration, propagated errors, target-device behavior and mission acceptance remain missing. Same JPL underlying ephemeris is an implementation cross-check, not independent observation. No operational certification or UI acceptance is claimed.
