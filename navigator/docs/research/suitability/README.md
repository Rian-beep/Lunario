# Regional map screening

Implemented 2026-11-15 in the isolated `codex/map-screening` lane, based on `6a3927f`. This is a regional, date-dependent ranking layer. `evaluateScenario` remains the only full-mission assessment authority. No existing ephemeris, model identity, horizon asset, NASA imagery or mission requirement is changed.

## API and integration

Import `screeningPoint`, `screeningSamples`, `ScreeningRequest`, `ScreeningPoint` and `ScreeningWeights` from `lib/suitability`. The exported types match `docs/CONTRACTS-MAP-SCREENING.md`. There are no browser globals or network requests at import or evaluation; tests import and run the module under Node. Callers supply already-decoded numerical data. The module does not load terrain, imagery or the catalogue.

`DEFAULT_SCREENING_WEIGHTS` is frozen `{sun:1,dark:1,slope:1,comms:1}`. `DEFAULT_SLOPE_SCALE_DEG` is 10. The locked request type requires explicit weights and slope scale; these constants let the integrator initialize those inputs. Runtime omitted values also use these defaults. Invalid weights (negative, nonfinite, all zero), slope scale, coordinates, projection or stay throw `RangeError`. Unsupported physical coverage/heights/masks produce null component values, rather than throwing or inventing evidence.

Indices are inclusive **forcing** indices: `[startIndex,endIndex]` supplies `(endIndex-startIndex+1) * stepHours` hours. Maximum end index is `catalog.meta.n-2`. The final epoch is an endpoint, never another forcing interval. The actual catalogue contains 17,521 epochs, hence 17,520 hourly intervals. No whole-catalogue celestial precomputation occurs; each job processes only the selected stay, typically 336 hours.

`screeningPoint` evaluates one exact coordinate synchronously. Use `screeningSamples` for map jobs; its options object may be empty. Longitude is normalized to east-positive `[0,360)` without rounding stored coordinates. Prepared masks require coordinate equality, including their selected meridian at a pole; a nearby off-cell click does not borrow a prepared mask. Existing map click analysis stays the integrator's existing exact-coordinate scenario flow.

Polar samples are all 1,980 actual catalogue grid coordinates in original order. The grid has 120 azimuth bins, 3° apart, at 2 m height. Named masks at the same coordinate and exact instrument height take priority. A global job has exactly 288 centres: latitude `-82.5 + 15*row` for rows 0–11, longitude `7.5 + 15*column` for columns 0–23, row-major. These 15° cells are a deliberately coarse regional lattice, **not** a 4.3 km map measurement grid. Appending all polar cells would exceed that initial global job budget; request the separate polar job to retain their detailed prepared support. No spatial smoothing/filling occurs in this module.

The integrator must display the lattice spacing separately from `point.spacingM`. That field is the physical **slope differencing spacing**, null if the numerical stencil is unsupported. Horizon source/azimuth/height and slope source/stencil details are in `source` and `notes`. Neither value is an accuracy bound. Show null cells distinctly; interpolate display only within supported cells, without filling gaps. Keep terrain and smooth-sphere scenario results adjacent in the existing inspector; the new API supplies terrain screening, not a replacement sphere/mission report.

Cancel the previous job with its `AbortController` when dates, heights, mask, weights, terrain or projection change. `AbortError` rejects the promise; partial arrays are never returned. Progress is `(0,total)` then one callback per completed point; callback errors propagate. Cancellation is checked before work, around every yield, before/after progress and before final resolution, including cancellation in the final callback. Callers should also guard their current job identity before publishing a fulfilled result, because an already-resolved older promise cannot be revoked.

## Physical metrics and rank assumptions

All components are reported even when their weight is zero. Every positive-weight component must be known for a composite score. A missing positive-weight component makes the score null. A zero weight excludes that component without changing its unknown measurement to zero.

For selected duration `H`, the normalized components are:

| Component | Physical value | Rank normalization |
| --- | --- | --- |
| Sun | Mean visible fraction of a uniform solar disk | `sunFraction` |
| Darkness | Longest observed run with no solar limb visible, in hours | `1 - longestDarkHours/H` |
| Regional slope | Central-difference gradient angle of numerical heights | `max(0,1-slopeDeg/slopeScaleDeg)` |
| Earth contact | Fraction of intervals with Earth centre above terrain and absolute antenna cutoff | `commsFraction` |

Clamp finite normalized components to `[0,1]`; score is 100 times their weighted arithmetic mean. Weights are internally scaled by their maximum before summation to avoid finite-weight overflow. Equal default weights and the 10° slope scale are **user ranking preferences**, not empirical probabilities, utility calibration, vehicle design limits or safe-landing thresholds. A weighted arithmetic mean permits compensation between known components. It does not enforce hard mission constraints. A boundary-censored darkness value ranks only the observation inside the selected stay; it does not predict darkness beyond it.

`buildSeries` supplies canonical topocentric Sun/Earth geometry and sampled horizons for each instrument. Solar exposure uses canonical `diskFraction`. Darkness uses the same any-limb predicate as `summarize`, and shared `observedAbsence` supplies longest duration and boundary censoring. Contact uses canonical `summarize(...,{antennaMaskDeg})`, which calls `earthCenterVisible`: `Earth elevation > max(terrain horizon, absolute antenna minimum)`. Equality fails, and a 0° mask remains an active horizontal cutoff. It is not an added terrain angle. Solar and Earth coverage are checked independently; incomplete solar exposure/darkness or incomplete Earth contact remain unknown, never percentages of only the known intervals.

Array and antenna heights are independent. Prepared named masks support only their exact 0/2/10 m heights; prepared polar cells support only their exact 2 m height. With an explicitly supplied `globalTerrain`, unsupported prepared coordinates/heights can use an on-demand coarse numerical horizon at the requested height, following the existing 0–10,000 m global-height support. An exact prepared mask with missing rays retains its unknown rays. With no explicit global DEM, unsupported prepared coordinates/heights remain unknown. Embedded `catalog.globalTerrain`/`terrain.globalTerrain` do not implicitly opt a request into coarse horizons.

## Sources, geometry and resolution

No new remote data was retrieved by this lane. References below describe the committed source chain; source accuracy and unarchived original catalogue conventions are not newly verified.

- `public/data/catalog.json`: generated `2026-11-13T20:08:39Z`, original JPL Horizons DE441 subsolar/subearth coordinates, Earth range and solar diameter. Canonical `lib/astro.ts` is unchanged. Original hourly/azimuth sampling and straight solar-disk cut retain their existing limitations. See [ADR 0005](../../decisions/0005-planning-evidence-contract.md) and [models](../../MODELS.md) for unresolved time/frame provenance and terrain equivalence. No new Horizons verification is claimed; neither ephemeris nor canonical direction formulas changed.
- Prepared horizons use `LDEM_80S_40MPP_ADJ.TIF` (40 m) and `LDEM_60S_240MPP_ADJ.TIF` (240 m fallback), [NASA GSFC PGDA product 90](https://pgda.gsfc.nasa.gov/products/90). Named 1°/polar 3° azimuth spacing is different from terrain pixel spacing. Narrow distant ridges can be missed. Finer display terrain does not improve those masks.
- Fine **numerical** slope patches come from decoded `public/data/terrain.json`: source URLs, frame, separate grid x/y spacing and source-pixel spacing are retained in output notes. Only patches with declared source pixels ≤80 m are used; the display overview is excluded. The smallest supported stencil uses steps at least as large as both the output grid and input pixels. Differences stay entirely within one supported patch, so no fine/coarse seam is silently differentiated. Projected differences are corrected by the south-polar stereographic scale `2/(1-sin(latitude))`. Reported spacing is the maximum physical axis step; the stencil spans twice each axis step. A rectangular 20×40 m analytic plane and an off-pole test independently exercise the metric.
- Without a fine supported stencil, an explicitly supplied numerical global DEM provides regional slope: `LDEM_16` V3.1, PDS dataset `LRO-L-LOLA-4-GDR-V1.0`, [source IMG](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img), [source label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.lbl). Source pixels 1,895.21 m; committed area-averaged output equatorial spacing **4,264.221153396021 m**, 2,560×1,280 cells, MEAN EARTH/POLAR AXIS OF DE421. ENU great-circle north/south/east/west differences use that physical output step at every latitude, including poles. This avoids treating the tiny longitude-cell width near poles as fine terrain support.
- Global source SHA256 `a511e40d7a3ea3275945b4da2a1df377133264fab0be94b7434b1cf8907254cb`; bundled gzip SHA256 `296296decb091b8d7075d70de1fc6acbb341b89f343a55de67855bb823a30350`; decoded SHA256 `6f07f0b8edf1274866cacba102c23aa870834806554cbf4b14a3d3344d411ec0`. Existing calibrated decoder/hash checks are reused, not bypassed by this module.
- Coarse horizons follow `lib/global-horizon.ts`: 180 azimuths at 2°, 200 logarithmic distances from 1 m to 1,000 km, nominal radius 1,737,400 m plus numerical terrain/observer height. `geometry.ts` implements its cooperative counterpart using the same constants and ENU construction. Reference tests compare every ray to the existing implementation for a synthetic bump, both poles, meridian/seam and heights. Global horizon metadata remains partial evidence even when every sampled ray is finite; near-ray interpolation does not recover subpixel obstacles. Missing origin or rays stay unknown.

Regional gradients cannot resolve landing-gear footprints, boulders, bearing strength or hazards. Source interpolation, possible 45° latitude-band artifacts, unresolved frame equivalence and physical uncertainty remain. Sun exposure is not electrical power or thermal survival; contact is not station allocation or link margin. This module makes no NASA safe-landing or operational-readiness claim.

## Cooperative execution and cache bound

No global terrain horizon or catalogue time series is computed at import. A job yields a macrotask before starting, after every point, and within a point when its 6 ms work budget is reached (headroom under the 8 ms contract). Checkpoints are one coarse azimuth (200 radial samples) or 64 forcing samples, plus small slope/final-summary operations. Thus at most one completed point is processed per task. The budget is cooperative JavaScript work, not a real-time guarantee against OS scheduling, GC or caller callback cost. Deterministic tests show cancellation can run inside coarse geometry and a full 17,520-interval stay before the first result; browser/device latency remains the integrator's gate.

Only global horizon geometry is cached: an LRU of **576 masks per immutable global DEM object**, enough for 288 centres at two instrument heights (~0.83 MB of Float64 mask payload plus keys/metadata). Keys contain exact coordinates and height; no rounding, scores, weights or date-indexed arrays are cached. Dates, cutoff and weights recompute physical summaries/rank from the selected interval. Completed geometry can survive cancellation; incomplete horizons are never inserted. A different decoded DEM object has a separate WeakMap identity and can be collected. Inputs are treated as immutable; replace a decoded data object rather than editing its samples in place. Tests verify actual cache hits across date/weight changes and eviction after 576 entries. Prepared masks are referenced directly without copying the full grid or precomputing sky geometry. The pre-existing global-horizon cache is not populated by the cooperative counterpart.

## Verification and remaining integration

Required explicit test command (these tests are outside the root test glob):

```sh
npx tsx --test tests/suitability/*.test.ts
npm run typecheck -- --incremental false
npm run lint
```

Additional existing numerical regressions:

```sh
npx tsx --test tests/global-horizon.test.ts tests/terrain.test.ts tests/observed-duration.test.ts
```

Final results and tested SHA are in `/tmp/lunario-map-screening-findings.md`; the tested delivery is `/tmp/lunario-map-screening.bundle` since `6a3927f`. The suite covers independent normalization/analytic slope oracles, unknown/zero-weight semantics, disk/centre boundaries, exact subsystem heights, explicit cutoff, censored runs across chunk boundaries, actual catalogue counts and canonical named/polar references, 288-centre completed jobs, coarse reference geometry, LRU reuse/eviction, date recomputation, cancellation before/during/after work, progress errors and concurrent-job isolation. Initial analytic-ramp fixture quantization was corrected with exactly representable input heights, without weakening its numerical oracle. No existing assertions were changed.

Integrator owns UI legends/controls, terrain–sphere comparison, current-job publication guards, real web/file interactions, rendered support/interpolation, device performance and regenerated offline output. This lane started no app/browser/Simulator/Metro, installed no dependencies, touched no package/shared source and did not build/push/merge. Original NASA imagery and all existing navigation/mode contracts remain untouched. `slop-scan` was not found; no arbitrary quality tooling was installed. Agent numerical verification is not user acceptance or landing evidence.
