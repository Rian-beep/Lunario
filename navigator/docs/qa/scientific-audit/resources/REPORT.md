# Electrical resources and communications audit

15 November 2026; isolated `codex/audit-resources`, baseline `96079ae`.

**7 verified implementation claims, 7 uncertain applicability/evidence claims, 0 failing claims within the bounded checks. No mission-critical certification.** No production calculations, canonical assessment, model identity, shared engineering screens, UI, datasets or generated app files changed. Nine relevant numerical/source files match baseline byte-for-byte; see `input-identities.json`. Passing analytic cases do not establish flight hardware performance, terrain visibility accuracy or actual support availability.

## Evidence and reproduction

`results.json` is the claim register required by the locked contract. `comparisons.json` contains every actual/reference value, absolute error and tolerance: **288 comparisons** (63 power/RF/coordinate/atmospheric comparisons plus 225 components from 75 station samples). `reference.json` contains independently generated linear-SI RF references, ENU vector/area-quadrature solar references, explicitly closed-form energy cases and published Cartesian station coordinates.

Eleven deliberately retained primary responses total 10,424,295 bytes. `sources/manifest.json` records direct request URL, HTTP status, exact retrieval UTC, content type, ETag/Last-Modified where supplied, length and SHA-256. These are source evidence, not generated web/build output. All hashes verify offline. The original oversized/truncated preliminary download was replaced with the complete PDF before validation; its hash is not used. Network failures are never accepted as passes.

Run from `navigator/`:

```bash
python3 scripts/audit-resources-fetch.py
python3 scripts/audit-resources-reference.py
python3 scripts/audit-resources-identities.py
npx tsx scripts/audit-resources-compare.ts > /tmp/audit-resources-comparisons.json
npx tsx --test tests/audit-resources.test.ts tests/mission.test.ts tests/mission-events.test.ts tests/dsn.test.ts tests/station-weather.test.ts tests/engineering-evidence.test.ts
npm run typecheck -- --incremental false
npm run lint
```

`audit-resources-fetch.py --refresh` explicitly refreshes the manifest's fixed requests. Provider changes must be reviewed; ordinary tests do not use the network. Python uses only its standard library. Existing CSPICE reference bytes and kernel identities remain at `public/data/engineering-evidence/spice-reference.json`; their baseline SHA-256 is pinned in this lane's input identities. CSPICE is a different computation of JPL ephemerides, **not independent observation**. No new kernels were downloaded or CSPICE computation claimed here.

## Primary references

- [JPL DSN 810-005 current handbook index](https://deepspace.jpl.nasa.gov/dsndocs/810-005/), retrieved 2026-11-15.
- [301P, Coverage and Geometry, issued 2026-05-22](https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf), §§2.1.2–2.1.5, Tables 2/3/5/6. The code's cited [301O, issued 2024-07-01](https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301O.pdf) has the same three representative coordinates. Current P is archived too; no station coordinate upgrade was needed.
- [105E, Atmospheric and Environmental Effects, issued 2015-10-22](https://deepspace.jpl.nasa.gov/dsndocs/810-005/105/105E.pdf), §§2.1.2–2.1.5 and lunar noise §2.4.2. Reference example is DSS-34 Canberra, **32 GHz**, climatological 90% year-average weather, 20° elevation. It is not DSS-43 hardware or dated weather for a mission.
- [101I, 70-m Subnet Telecommunications Interfaces, issued 2025-10-09](https://deepspace.jpl.nasa.gov/dsndocs/810-005/101/101I.pdf), station/feed/band/noise interface context. No example user gain/noise input is certified by this document.
- [NASA Small Spacecraft Technology, Power](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/), archived live page on 2026-11-15: technology/qualification context, not a validation of these default inputs.
- [ITU-R P.525-5 (2024), §2.3](https://www.itu.int/dms_pubrec/itu-r/rec/p/R-REC-P.525-5-202411-I!!PDF-E.pdf) supplies free-space point-to-point equations. [ITU-R P.838-3 (2005)](https://www.itu.int/dms_pubrec/itu-r/rec/p/R-REC-P.838-3-200503-I!!PDF-E.pdf) identifies frequency/polarization-dependent rain coefficients. These are ITU standards, separately identified from NASA/JPL evidence. No P.838 attenuation solver is implemented or validated by this audit.

## Numerical findings, including before/after

Production inputs and formulas are unchanged. The same measured residuals therefore describe **both baseline and delivery**; before→after error reduction is zero. No discrepancy was concealed by changing a tolerance. Errors below are implementation/reference residuals, not environmental error estimates.

| Check | Baseline and delivery maximum error | Fixed acceptance tolerance and rationale |
| --- | ---: | --- |
| Five closed-form storage/bus cases, generated/stored/unmet/curtailed Wh, reserve h, event offsets | 0 in metric units | 10⁻⁹ Wh/h; events 10⁻¹² h; floating point arithmetic only |
| Eight incidence/partial-disk powers | 4.332×10⁻⁶ W | 0.001 W; midpoint disk quadrature discretization, not terrain accuracy |
| Three RF budgets, four columns each | 7.106×10⁻¹⁵ dB | 10⁻¹⁰ dB; different linear-power derivation, double precision |
| Three antennas, nine Cartesian components | 0.001146 m | 0.002 m; DMS and Cartesian table rounding, not station position accuracy |
| 75 fresh Horizons vs retained CSPICE azimuths | 0.000268689° | 0.002°; pre-existing different-kernel/apparent-coordinate comparison scope |
| Same elevations | 0.000073367° | 0.002°; not an acquisition/event guarantee |
| Same ranges | 0.003245 km | 0.1 km; DE441 vs DE440s and apparent-coordinate differences, not tracking accuracy |
| JPL printed slant attenuation | 0.000259111 dB | 0.0005 dB; printed three-decimal rounding |
| JPL printed atmosphere noise | 0.002417511 K | 0.06 K; printed rounded intermediate loss, not physical weather uncertainty |

### Electrical power and storage

Units are irradiance W/m², area m², useful generation/load/bus caps W, storage Wh and interval duration h. One Wh equals 3600 J; the two-second 360 W test yields 0.2 Wh. Charge cap is surplus bus power before charge efficiency; discharge cap is delivered bus power before stored-energy debit. Reserve is a reporting threshold, **not an automatic load cutoff**. Null caps mean unlimited; zero caps prevent the flow.

Closed-form cases exercise depletion with nonunit efficiency, bus-limited charge/discharge, capacity saturation and reserve recovery. A separate two-hour cycle receives 100 Wh surplus, stores 80 Wh, later delivers 40 Wh, and exposes 60 Wh unmet load: charging and discharging losses are distinct. Conservation uses generated + battery-delivered + unmet = load + battery-charge-input + curtailed, all on the bus. This does not pretend that battery internal losses are bus load.

The fixed-array normal and solar direction are compared independently as ENU unit vectors (east, north, up; azimuth clockwise from north, tilt from upward normal). Back-face incidence is clipped to zero. Uniform disk fractions use independent numerical chord integration rather than the production circular-segment formula. Half the disk visible means half the assumed irradiance throughout a modeled interval; it does not mean half an hour of illumination. `sun` means any visible disk and overlap uses this Boolean, so it is not equivalent full-power hours.

Applicability is uncertain: fixed 1361 W/m² is a declared constant rather than date-specific Sun-distance irradiance. No measured array IV/temperature/MPPT/dust/degradation response, battery capacity vs temperature/age/rate, self-discharge, heater loads, qualified depth-of-discharge or reserve policy is connected. A single horizon cut and centre-direction incidence do not integrate a structured solar disk through a two-dimensional terrain skyline. Tracking assumes ideal orientation. Default values remain illustrative.

### Radio and terrestrial stations

The independent RF reference uses isotropic transmitted power flux density (W/m²), receive effective aperture (m²), received W, energy per bit (J), then thermal noise density kT (J). Only the final comparisons convert to dBW/dB. GHz→Hz and km→m are explicit; c=299,792,458 m/s and k=1.380649×10⁻²³ J/K. Doubling range or frequency costs 6.0206 dB at fixed gains; doubling power adds 3.0103 dB, and doubling noise temperature/rate costs 3.0103 dB. Gains are dBi, loss is nonnegative dB, rate is bit/s. This is a one-way link; no radar factor or accidental dBm offset appears.

Goldstone/DSS-14, Madrid/DSS-63 and Canberra/DSS-43 are actual **ground antennas at three complexes**, not spacecraft or satellites. Cartesian axes are Earth-fixed ITRF93: X Greenwich/equator, Y 90° east/equator, Z north. Heights in Table 5 are WGS84-ellipsoid metres, not MSL. Their Table 2 reference epoch is **2003.0**. The implementation's geodetic conversion agrees with the published Cartesian components at that epoch; fixed positions are not propagated using Table 3 velocities. Using 23.87 Julian years as a scale gives displacement magnitudes about 0.466/0.728/1.235 m for Goldstone/Madrid/Canberra. These are a scale estimate, not an applied 2026 transformation or an error bound. No precision pointing claim follows.

Three fresh Horizons API 1.2 responses provide 25 samples each, inclusive hourly epochs **2026-11-14T00:00:00Z through 2026-11-15T00:00:00Z**. Query target Moon 301, geodetic `coord@399` Earth station, UT, airless apparent azimuth/elevation, range KM, step 1 h. Response headers identify **DE441**, **ITRF93**, **EOP eop.261113.p270209**: observed coverage through 2026-11-13, predicted thereafter through 2027-02-08. All audited epochs are therefore in predicted EOP. The retained CSPICE comparison uses DE440s, `spkcpo MOON / ITRF93 / OBSERVER / LT+S`, explicit Earth binary PCK and naif0012 leap-second kernel with recorded hashes. JavaScript UTC/POSIX arithmetic does not model an inserted leap second. No UT1=UTC or GMST-only transformation is silently supplied by this lane.

Communications envelopes require separate station horizon, lunar mask, hardware, dated band/frequency-matched attenuation and allocation. Missing evidence remains incomplete even for a zero-bit requirement. Source bytes are reparsed; imported computed columns cannot override them. Capacity integrates bit/s × seconds, including partial allocation windows. Whole lunar disk clearance and centre-range plus 1737.4 km are conservative spatial screens, **not a lower bound over time**. Left-held hourly geometry may miss an acquisition/loss inside the hour. Earth-centre visibility at the lunar site neither proves the chosen terrestrial station ray clears local terrain nor establishes booking, antenna acquisition, compatible coding or actual payload rate. An explicit Earth-centre proxy remains a user assumption; all successful chains are conditional and `operationalApproval` stays false.

### Atmosphere, weather, censoring and uncertainty

JPL's supplied-zenith-loss/sine-elevation approximation is restricted here to 10–90°. Emission noise is TM×(1−10^(−A/10)); it is not the complete system noise. The link must receive a correctly scoped total system temperature including receiver, atmosphere, attenuated cosmic background and lunar hot-body contributions. Vacuum gain plus separate weather loss avoids double-counting. A precipitation accumulation in mm or cloud percentage alone cannot establish attenuation in dB; rain-rate distribution, frequency, polarization, slant path, gaseous absorption and station-specific evidence matter. Current Open-Meteo output remains weather context, not NASA attenuation evidence, and never becomes mission weather outside its dated UTC coverage. No live weather call was needed to certify this absence of inference.

Solar gaps poison downstream storage; contact gaps censor contact totals instead of becoming blackouts. Pre-gap violations remain visible. Runs meeting the stay boundary can extend beyond it; reported duration is only the observed span. Native mission results do not add an operational guarantee or infer an unknown run end. Hourly samples and load/deployment subsegments provide no subhourly physical forcing measurements or quantified event-time uncertainty.

Declared bounds use the canonical `evaluateScenario`, holding operations/requirements fixed; the existing focused tests exercise stale binding, invalid corners, cancellation and up to 27 distinct lower/nominal/upper cases. This confirms routing and finite-case behavior. It provides no probability distribution, correlated hardware model, continuous enclosure or qualified uncertainty; no physical truth is upgraded by those tests.

## Parent handoff and checks

Fresh final focused run: **380 passed, 0 failed, 0 skipped, 0 cancelled** (includes this lane's new tests and existing power/events/DSN/weather/evidence suites). Nonincremental typecheck and ESLint pass with zero errors/warnings. Source verification: **11/11** archived response hashes/lengths. Numerical comparison: **288/288** within declared tolerances. An initial command named nonexistent `tests/station-weather-context.test.ts`; it performed no tests and is not counted. The corrected suite uses `tests/station-weather.test.ts`. `slop-scan` is not installed/configured in this worktree; no tool was installed. No app server, browser profile, Simulator/Metro, paid call, build, offline regeneration or geometry change occurred; the catalog Horizons verification gate is not applicable to unchanged catalog geometry.

**Shared-file proposals (read-only review):** no arithmetic correction is indicated for `engineering-screens.ts` ground-support capacity: h × allocated-time fraction × 3600 s/h × Mbit/s yields Mbit. Preserve its explicit supplied-overlap/usable-payload assumptions and conditional status. Parent should retain separate evidence gates when integrating; no shared edit is requested by this lane. A future qualified station workflow needs dated site propagation/EOP, actual masks, vehicle antenna/radio/noise/coding inputs and station allocations; these gaps should not be closed with defaults. Model/version changes, if later chosen, remain integrator-owned.
