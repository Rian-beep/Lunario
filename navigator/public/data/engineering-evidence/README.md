# Independently checked engineering evidence

Station fixtures were requested from Horizons on 14 November 2026. `*-horizons.json` retains exact requests, response headers, CSV and provider version. Target: Moon center (301); observer: representative terrestrial antenna coordinates already defined in `lib/dsn.ts` from JPL 810-005/301O; airless apparent azimuth/elevation, UTC epochs, km range, hourly. They are not the app's existing lunar catalog and are not station bookings.

`spice-reference.json` was independently produced using CSPICE via spiceypy in `/tmp/solarreach-engineering-venv`, DE440s, an explicitly dated terrestrial binary PCK, ITRF93 observer-locus `spkcpo`, LT+S and geodetic ENU dot products. The implementation adapter never uses this Python calculation at runtime. Kernel source URLs and SHA256 identify the input bytes. The Horizons DE441 output includes relativistic light deflection, whereas this reference omits it. Different ephemeris/EOP implementations explain small residuals; the comparison tolerance is a regression threshold, not physical uncertainty.

Fresh live comparison: 75 samples (25 epochs × Goldstone DSS-14, Madrid DSS-63, Canberra DSS-43), maximum absolute residuals AZ 0.000268688691°, EL 0.000073366240°, range 0.003244174296 km. No weakened fixtures or invented Earth rotation are used. The current date's EOP predictions are retained in the raw headers.

Run without network:

```
node_modules/.bin/tsx scripts/verify-engineering-evidence.mts
```

Requery the real provider, without silently replacing fixtures:

```
node_modules/.bin/tsx scripts/verify-engineering-evidence.mts --live --frame
```

Only explicit `--live --write` replaces raw observer fixtures. Reproduce the independent numerical reference using the script in this directory in an isolated Python venv with numpy/spiceypy; `--check` compares regenerated reference samples with the committed reference, with no write. The source uses a dated EOP filename, not a moving `latest` input. No binary kernels are committed.

## Primary radio references

- [810-005/301O](https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301O.pdf), antenna coordinates (already in shared `lib/dsn.ts`).
- [810-005/101H](https://deepspace.jpl.nasa.gov/dsndocs/810-005/101/101H.pdf), 70 m antenna RF interfaces, 11 March 2025. No nominal gains/noise values are silently adopted.
- [810-005/105E](https://deepspace.jpl.nasa.gov/dsndocs/810-005/105/105E.pdf), atmospheric effects, 22 October 2015. `jpl-105-example.json` is the published section 2.1.5 arithmetic example, not a forecast. Gain must exclude atmospheric attenuation when loss is carried separately; system noise must include atmosphere, lunar and relevant other noise. The module-owned helpers test published slant loss/noise arithmetic. No current surface-weather observation is converted to RF loss or future weather.

The chain computes one lunar-to-ground downlink only: supplied coding/information rate, free-space margin, explicitly dated rate-limited allocation, lunar mask and station full-disk clearance. It does not synthesize an uplink command/acquisition service, antenna tracking dynamics, or a mission allocation. Hardware inputs are constant declared assumptions; changing elevation-dependent gain/noise is not modeled. Imported station-specific lunar visibility and azimuth profiles can replace explicit Earth-center proxy / constant-horizon assumptions. Imported source labels and raw text are not authenticated mission evidence. Every complete result is conditional.

## Frame gate

[Current Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), “Lunar Mean-Earth Frame of DE421”, specifies the fixed DE440 PA rotation toward DE421 ME. [NAIF lunar FK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) identifies MOON_ME_DE440_ME421 and distinguishes it from IAU_MOON, which must not be substituted. PGDA product 90 specifies DE421 MOON_ME. This narrows the convention ambiguity but does not authenticate the original catalog response headers or quantify terrain/frame/event propagation. The `--frame` gate fetches the primary documents and verifies these convention identifiers, then explicitly reports the remaining open gate. No shared science identity or numerical terrain formula changed and no canonical closure is claimed.

## Scope and bounds

Communications runs: maximum 31 days, 745 geometry endpoints, 1000 non-overlapping rows per interval evidence set, 100 critical windows, 2 MB imports and streamed provider response, 45 s request timeout, explicit cancellation, no polling. Missing source coverage, geometry, horizon, lunar visibility, hardware/rate, weather/frequency or allocation leaves full capacity/adequacy unknown. Explicit zero allocation differs from missing allocation. Geometry is left-held hourly, including cutoff/range, not a validated subhour contact predictor. A conservative 0° station local-horizontal floor prevents treating a negative supplied cutoff as Earth-transparent. Whole-disk station clearance (including the maximum supplied skyline within its azimuth footprint) and center range plus lunar radius are conservative spatial screens only; they do not bound temporal variation or lunar terrain errors.

Declared-bounds runs: at most three fields / 27 lower–nominal–upper cases, using the sole `evaluateScenario` authority with the exact held requirements and operations. Report sampled ranges, case identity and provenance only. No continuous enclosure, probability, qualified uncertainty or zero unknown uncertainty is inferred. Each synchronous canonical assessment is not preemptible; cancellation is checked between cases with an event-loop yield.
