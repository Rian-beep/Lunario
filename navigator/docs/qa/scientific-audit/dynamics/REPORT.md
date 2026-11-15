# Dynamics scientific audit — 15 November 2026

**13 scoped implementation/formula claims verified, 4 applicability claims uncertain, 1 numerical discrepancy failing.** These counts do not certify physical truth, a landing site, historical Apollo reconstruction or mission-critical use. The full machine-readable claims, inputs, methods, tolerances, errors, citations and limitations are in [results.json](results.json). Source baseline: `96079ae`; locked [audit contract](../CONTRACTS.md) followed.

The owned production change is five lines in `lib/flight.ts`: treat nonfinite height samples as unknown, and reject an initially penetrated numerical surface. No UI, assessment, model identities, public data, packages, builds or offline outputs changed. Existing tests/fixtures remain intact. No app server, shared browser, Simulator, Metro, paid model or additional agents were used.

## References and reproducibility

Twelve bounded, public primary responses are frozen under [references](references/manifest.json). The manifest records requested/final URLs, retrieval UTC, HTTP status, content type, byte length, Last-Modified/ETag when supplied and SHA256. All twelve finished with HTTP 200 and pass offline checksum verification. NIST initially returned HTTP 403 to Python's default client; retry with a browser user-agent succeeded. The capture script includes that user-agent. Archive size is approximately 1.4 MB; no terrain downloads or ephemeris regeneration were needed.

- [NASA Glenn specific impulse](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/) and [ideal rocket equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/) establish standard-gravity Isp conversion, mass flow and the ideal logarithmic velocity increment. Their illustrative terrestrial examples are not lunar vehicle defaults.
- [NASA Newton's laws](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/newtons-laws-of-motion/), [vacuum free fall](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/free-falling-objects/) and [trajectory guidance](https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/) supply the mechanics framework. Closed-form central-force references below were independently derived from these laws, rather than copying RK4.
- [JPL parameters](https://ssd.jpl.nasa.gov/astro_par.html): DE440 Moon GM = 4902.800118 km³/s², or 4.902800118×10¹² m³/s². [NASA Moon facts](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html): mean radius 1737.4 km, sidereal period 655.720 h. [NIST CODATA 2022](https://physics.nist.gov/cuu/Constants/Table/allascii.txt): standard gravity 9.80665 m/s² exactly; Stefan–Boltzmann constant as represented in the app.
- [NASA-TN-D-2027, NTRS 19640005067](https://ntrs.nasa.gov/citations/19640005067) reports configuration/surface-dependent landing tests. [NASA-TN-D-6850, NTRS 19720018253](https://ntrs.nasa.gov/citations/19720018253) describes Apollo landing-gear development and qualification. Only their public API metadata/abstracts were archived; the quantitative test series were not validated or fitted here. Neither report qualifies the app's proxies.
- [NASA thermal control](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/) and [plume/surface interaction](https://www.nasa.gov/plume-surface-interaction/) establish missing physical disciplines. A citation supplies neither applicable vehicle parameters nor a measured error bound.

Reproduce from `navigator/` with installed dependencies:

```bash
python3 scripts/audit-dynamics-fetch.py --check
npx tsx scripts/audit-dynamics.ts /tmp/audit-dynamics-measurements.json
npx tsx --test tests/audit-dynamics-*.test.ts
```

`audit-dynamics.ts` reads baseline code with `git show 96079ae:navigator/lib/...`, builds only temporary isolated numerical modules and removes them. It never edits production constants. Running `python3 scripts/audit-dynamics-fetch.py` deliberately refreshes archived bytes/identities; offline verification does not fetch. See [measurements.json](measurements.json) for exact input records and raw residuals. Baseline history must remain available to rerun before/after comparisons.

## Frames, epochs and units

Flights use Moon-centred Cartesian vectors expressed in site **east/up/north**, a left-handed basis. `yM` is the Cartesian up-coordinate minus the selected reference radius; `altitudeM` is the radial norm minus that radius. They differ away from the origin. Terrain callbacks use east/north in metres and return the corresponding local numerical y-height in metres. `surfaceRadiusM` includes the supplied site elevation; the audit's base sphere is 1,737,400 m. Target distance is a sphere arc `R*atan2(hypot(east,north),R+y)`, not downrange, chord, terrain geodesic or route length.

Legacy flight omits rotation. Configured flight optionally uses constant-spin Moon-fixed axes, including both Coriolis and centrifugal terms with the left-handed cross product. The equatorial reference transforms an exact inertial circular orbit into those axes. This checks signs and units, not a dated lunar orientation solution.

Rigid-body experiments use Rapier 0.21.0 at 120 Hz, right-handed X/up/Z, with constant downward acceleration 1.62 m/s². Existing contact integration tests exercise the parent-owned north-to-south reflection and model-origin lift; no handoff code was edited. Flight point contact is a surface anchor, not finite-vehicle centre-of-mass contact.

Every audit trajectory has a **synthetic elapsed epoch t=0 seconds**. There is no implicit 2026 mission start, UTC/TDB conversion, J2000 target or validated ME/PA frame registration. SI units are m, s, kg, N, m/s, m/s², J and m³/s²; screen h/km/Wh/Mbit units remain explicit and conversion-tested. This task changes no celestial direction/ephemeris code, so Horizons was not rerun or claimed passed.

## Fixes and before/after evidence

| Case | Baseline 96079ae | After scoped fix |
| --- | --- | --- |
| Unknown terrain represented as NaN or −Infinity | Misses reference contact; still coasting after five seconds despite descending through the sphere | Finite reference contact at 0.6473710997078774 s, exactly matching null terrain |
| Terrain +Infinity | Emits a terrain-contact record with nonfinite time, position, velocity, mass and target error | Same finite reference contact; terrain remains unknown |
| Initial y=10 m, known terrain y=20 m | Returns a time-zero “terrain contact” still 10 m below the surface | Rejects with `Flight starts below the numerical surface`, matching configured flight |

The cause was legacy clearance accepting every non-null number and omitting the initial clearance guard. Tests at the actual `simulateFlight` seam reproduced the failures before fixes. [Before contact tests](before-contact-tests.txt), [initial-surface regression](before-initial-surface-tests.txt), [penetrated baseline output](before-penetrating-start.txt), [after tests](after-contact-tests.txt) and the baseline/current harness retain the evidence. Four contact regressions pass after correction. Existing finite-input reference trajectories are preserved.

Parent action: review the shared numerical/model version identity before integrating altered input/contact semantics. That identity is parent-owned; this lane did not modify it.

## Formula checks and errors

- **Force/mass and hover:** at 100 km altitude, 1000 kg, 3000 N, Isp 300 s and Δt=0.001 s, powered-minus-ballistic acceleration differs from initial F/m by 1.52957615×10⁻⁶ m/s² in both paths. The finite interval includes real modeled mass loss; the 2×10⁻⁶ tolerance allows this term. Initial thrust equal to lunar weight leaves only 3.58428×10⁻¹⁰ m/s vertical speed over that interval, within 10⁻⁸. This is a short-time limit, not sustained hover with a fixed force and falling mass.
- **Propulsion:** `mdot=F/(Isp*g0)` gives zero recorded mass residual in the short test. Fractional 0.37 s burns, exhaustion at 999.9 kg, coast mass and ideal `Isp*g0*ln(m0/m)` pass with 10⁻⁹ kg / 10⁻⁸ m/s numerical tolerances. This is available ideal impulse; gravity/steering losses are not subtracted from that reported metric.
- **Two-body orbit:** at 100 km circular altitude over 600 s, exact sine/cosine position errors are 6.61×10⁻¹⁰ m legacy and 1.11×10⁻⁷ m configured, below 10⁻⁵ m. Specific-energy residuals are below 2×10⁻⁹ J/kg and angular-momentum residuals below 2×10⁻⁶ m²/s. These errors validate the chosen central-force ODE, not an actual lunar orbit.
- **Configured contact:** a 100 m drop from rest gives exact central-force impact time 11.097203526181376 s and speed 18.022904296123084 m/s. Configured residuals are −1.35×10⁻¹¹ s, −1.83×10⁻¹¹ m/s, +2.33×10⁻¹⁰ m height and −1.55×10⁻⁶ J at 4700 kg. Tolerances are 10⁻⁶ s, 10⁻⁷ m/s, 10⁻⁷ m and .01 J, allowing lunar-scale subtraction/roundoff without claiming physical precision.
- **Rotating frame and target arc:** the independent rotating circular position and known-angle arc checks pass at 10⁻⁵ m / 10⁻⁸ m respectively; exact residuals are in measurements.
- **Screens:** independent apsis angular momentum gives the Hohmann velocities without repeating the implementation's expression. Rocket, transfer, work/energy, static tipping and 300 K blackbody limits pass. Supplied screen inputs remain assumptions. The ideal support ratio `1+a/g` is a vertical-force ratio; on a slope it is not a resolved individual normal/strut force.

## Remaining failing discrepancy

**D10 — legacy linear-interpolated contact fails the exact-event benchmark above.** The same 100 m drop reports impact **0.000667572931 s early**, **0.001084034521 m/s slow**, and **91.82325545 J below** the exact incoming kinetic energy. Both before and after the scoped guard fixes have identical errors. Height alone is zero, which conceals the event-state error.

Reducing only the legacy step .25 → .125 → .0625 s reduces time error magnitude .000667573 → .000122130 → .000043480 s and energy error 91.8233 → 16.7991 → 5.98074 J. This identifies event interpolation, separate from accurate airborne RK4 integration. The finding is retained as failing; its tolerance was not widened. Current frozen legacy tests explicitly require the old numerical contact values. Parent should authorize the compatibility change, replace only the affected physical expectations with independent event benchmarks, and refine the event using the propagated ODE state. This lane preserves those existing tests and reports the discrepancy for integration.

## Uncertain applicability and missing evidence

Assisted force-command steps .1/.05/.025/.0125 s approach similar contacts. Against the finest run, .1 s differs by .00319956 s, .01137535 m position, .00602214 m/s velocity and −.04044549 kg. Differences decrease with refinement. No qualified acceptance tolerance is assigned: self-convergence is not an independent GNC reference. The feedback commands are held between updates, so RK4 does not imply fourth-order accuracy of the entire guided control loop. Narrow terrain features between probes can remain unseen.

The 1 s rigid ballistic test has vertical velocity error −2.56348×10⁻⁵ m/s and vertical position error −.00085663 m under its disclosed constant gravity. That gravity is .00421887656 m/s² (~.260%) below central GM/R². Continuation therefore changes gravity model; it is an explicitly approximate proxy, not a physically continuous high-fidelity solution.

Breakup uses assumed padded bounding-box mass/inertia, including a 3 cm thickness floor. Detailed boxes omit mutual collision. Fragments inherit **solved post-impact** motion without an explosion impulse. The break decision estimates incoming translational energy using pre-step velocity plus a full gravity step; it is not an exact event-time kinetic energy, absorbed energy or material fracture criterion. Near-threshold decisions can vary with contact time/discretization. Existing mass, bounce, CCD and friction tests verify software behavior, not soil or landing-gear qualification.

`within-assumed-limits` means only entered speed/ideal tilt/target/energy constraints at a known point surface; it does not include footprint hazards, slope acceptance, gear stroke, structural stress or soil. Equality at breakup energy intentionally triggers failure. Unknown terrain gives unresolved unless a known entered limit already fails. Analytical screens never return unconditional pass; empty inputs stay unassessed and known violations survive other missing data. The parent-owned canonical assessment and independent qualified external-report gates remain untouched.

Parent review also needs the **tolerance contract mismatch**: shared model documentation describes 10⁻⁹ metric-unit requirement slack, while engineering screens compare most limits directly and intentionally treat the tipping/cone boundaries as failure. Do not silently generalize one tolerance across those different constraints. Clarify the scoped semantics and version identity centrally; this audit does not certify shared assessment mapping.

No applicable vehicle engine curves, mass/inertia measurements, attitude/navigation errors, actuator delays, landing-gear force/stroke data, site soil properties, plume/ejecta bounds or transient thermal validation were supplied. Historical Apollo report metadata cannot fill these gaps. The default generic vehicle/preset and NASA display mesh are not historical telemetry. Support/traverse/cone arithmetic remains supplied-budget geometry rather than an independently observed environment.

## Verification

Focused command (audit plus existing flight, configured landing, contact handoff, rigid/contact/fragments, experiments and engineering screens):

```bash
npx tsx --test tests/audit-dynamics-*.test.ts tests/flight.test.ts tests/landing-flight.test.ts tests/legacy-flight-contact.test.ts tests/engineering-screens.test.ts tests/touchdown-physics.test.ts tests/touchdown-fragments.test.ts tests/landing-contact.test.ts tests/landing-contact-terrain.test.ts tests/flight-experiments.test.ts
npm run typecheck -- --incremental false
npm run lint
```

Final counts/exit statuses are recorded in [checks.json](checks.json) with raw [focused tests](focused-tests.txt), [typecheck](typecheck.txt) and [lint](lint.txt). No existing tests were removed or rewritten. The cached established slop-scan 0.3.0 also ran: ten findings, reproduced as the same ten rule/location groups on an isolated archive of 96079ae. No new owned-code finding; scripts directory count changes 40→41. Existing empty/error-obscuring catches in scene ion loading, NASA decoding, scenario parsing, theme/branding loader and framing verifier findings are outside ownership and need parent triage; they were not edited. See slop-scan.txt and slop-scan-baseline.txt. No new quality tool was installed. Raw primary response whitespace is preserved for byte-exact checksum identity; authored files pass diff whitespace checks. A passing numerical suite cannot resolve D10 or replace missing operational validation.
