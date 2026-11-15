# Scientific verification register

Model `planning-5`; dataset `solarreach-catalog-e5a1528cac7db5f4-terrain-20a4d4261acf15da-global-6f07f0b8edf12748`.

Verified means the stated bounded implementation/input check passed. It does not mean an arbitrary selected scenario, landing site, vehicle or operational mission is qualified. Baseline reports remain archived; this register supersedes only the listed corrected findings.

**42 verified bounded claims; 22 uncertain; 0 currently failing recorded comparisons. No operational qualification.**

| ID | Status | Claim | Scope |
|---|---|---|---|
| S01 | verified | Polar metadata uses height in metres, a 1737400 m sphere and DE421 mean-Earth frame | Primary product/GeoTIFF metadata, not an accuracy determination |
| S02 | verified | Thirteen un-clamped polar samples reproduce primary COG heights within encoding tolerance | Bounded transfer/resampling check: one 5 m patch, one 10 m patch, one 40 m patch and one 1280 m overview |
| S03 | verified | Corrected polar cutout edge samples the declared source coordinate within the original encoding tolerance | Same bounded original NASA COG stencils; source transfer/resampling only, not physical terrain accuracy |
| S04 | verified | Global height calibration and five downsampled cells match original PDS DN values | LDEM_16 V3.1, original 5760x2880 pixel-registered cylindrical grid, output 2560x1280 |
| S05 | verified | A Malapert regional slope stencil agrees with primary heights at the stated scale | lat -85.99985841143967 deg, lon 359.99670036862335 deg east; DE421 ME; source 10 m, output 23.976608187134502 m projected |
| S06 | verified | Coarse horizon reproduces analytic spherical dip under its discrete ray policy | Synthetic sphere R=1737400 m, observer 2 m, north-clockwise ENU azimuth; no epoch |
| S07 | verified | Missing coarse DEM support remains unknown | Runtime global DEM height/slope/horizon support semantics |
| S08 | verified | Observed darkness is censored at stay boundaries and unknown coverage is not darkness | Interval bookkeeping at 1 h sampling; any-limb visibility; implementation-only |
| S09 | verified | LCROSS marker agrees with original NASA-hosted impact-location paper | Centaur 2009-10-09T11:31:19.506 UTC; Mean Earth selenocentric degrees east longitude/latitude |
| S10 | verified | A missing terrain sample makes the affected produced horizon unknown | Synthetic missing-on-ray regression of the corrected producer; existing prepared masks are not wholly regenerated or field-validated |
| S11 | verified | Registered bundled asset hashes match the current evidence manifest | Cryptographic file identity only; not scientific accuracy |
| S12 | uncertain | Polar DEM effective resolution and physical error are unresolved | 5/10/40 m native pixel spacing, 80 m base with 160/1280 m overviews; output spacing differs |
| S13 | uncertain | Cross-dataset lunar orientation registration remains unquantified | Polar/global DEM DE421 ME versus catalog DE441/MEAN_ME and M3 GCS_Moon D_Moon_2000 |
| S14 | uncertain | Upstream raw data identity is incomplete despite a complete current-byte inventory | Audited scientific snapshot: 58 asset identities; 24 registered entries, all matching; additional visual assets use their own manifest. Upstream whole-source identity remains incomplete. |
| S15 | uncertain | Prepared/coarse horizons are not independently validated physical skylines | Named 1 deg horizons 0/2/10 m; nearest custom grid 3 deg at 2 m; global 2 deg rays |
| S16 | uncertain | M3 association extraction cannot be freshly reproduced from the author archive in this run | 169 published PSR representative points, 820 positive M3 detections at ~280 m sampling; no per-point observation epoch |
| S17 | uncertain | Exposure/slope ranking and ice markers do not establish safety or recoverable reserves | Regional weighted index 0–100 and resource applicability |
| S18 | verified | Runtime ice loader preserves evidence methods and counts rather than inferring resource quantity | Source/schema interpretation and error handling only; no independent physical detections |
| E01 | verified | Fresh requested inputs, response identities and decoded source values agree | 23 archived tables, 233 source rows; seven centre epochs; actual committed catalog bytes |
| E02 | verified | Decoded Sun/Earth directions satisfy the registered implementation screen | 8 sites × 2 bodies × 7 covered epochs = 112 site rows, including Rian demo and final endpoint |
| E03 | verified | Earth local-vector parallax and bounded solar far-field approximation are implemented consistently | Archived baseline scope (not newly restamped as a current-input comparison): Independent Cartesian vectors at polar, equatorial, farside, dateline sites; finite solar distance from fresh Moon-observed Sun range |
| E04 | verified | Rounded source solar semidiameter matches fresh site angular diameter within quantization bounds | Archived baseline scope (not newly restamped as a current-input comparison): 56 Sun site samples and seven Moon-centre samples |
| E05 | verified | Earth semidiameter now includes site parallax within the catalog vector model | Archived baseline scope (not newly restamped as a current-input comparison): buildSeries angular radius on reference sphere; subearth, limb, antipode and audit sites |
| E06 | verified | Corrected Moon-observed Earth range passes registered observer-range checks | 17521 hourly centre-range input rows validated/encoded; 56 independent site-range checkpoint comparisons at eight sites/seven UTC epochs |
| E07 | verified | Earth site semidiameter passes the unchanged direct observer-table limit | 56 Earth checkpoints; approximate apparent-vector model, not all possible sites/times |
| E08 | verified | Finite-disk semantics and four actual hourly setting brackets are reproduced | Archived baseline scope (not newly restamped as a current-input comparison): Sun centre/upper limb at equator; Earth centre/upper limb near north pole; June 2027; flat zero-degree reference horizon |
| E09 | uncertain | Original catalog time, raw-source and cache provenance is fully established | Archived baseline scope (not newly restamped as a current-input comparison): Original generatedUtc 2026-11-13T20:08:39Z; Python source and /tmp/lunar-src cache design; covered future UTC epochs |
| E10 | uncertain | Celestial/terrain frame and real site height registration is qualified | Archived baseline scope (not newly restamped as a current-input comparison): Reference sphere directions vs actual LOLA/landing coordinates, heights and horizons |
| E11 | uncertain | Passing this audit establishes mission-critical real-world sky/contact accuracy | Archived baseline scope (not newly restamped as a current-input comparison): All numerical checks in this lane |
| E12 | uncertain | Sun range is represented and validated as a separate catalog distance series | Archived baseline scope (not newly restamped as a current-input comparison): Actual catalog schema has angular diameter but no solar range series |
| resources-01 | verified | Constant-power storage conserves bus energy, applies efficiencies once, and reports reserve/unserved demand onset. | Implementation of specified piecewise-constant model only; W, Wh, h (1 Wh=3600 J); analytic epochs independent; no coordinate frame. |
| resources-02 | verified | Fixed-array cosine incidence and uniform local disk fraction match independent vector/area integration. | Local ENU east/north/up, azimuth clockwise from north, tilt from upward normal; degrees, W, W/m², m²; stationary analytic forcing. |
| resources-03 | verified | One-way free-space RF budget uses consistent SI, dBW, dBi, power dB and Eb/N0 conventions. | GHz→Hz, km→m, W, K, bit/s; received dBW and Eb/N0/margin dB. Far-field vacuum scalar link, epoch/frame independent. |
| resources-04 | verified | All three representative ground-antenna coordinates match JPL published Cartesian data at source epoch. | DSS-14 Goldstone, DSS-63 Madrid, DSS-43 Canberra; ITRF93 epoch 2003.0; Earth-fixed XYZ m; WGS84 ellipsoid geodetic heights, east longitude. |
| resources-05 | verified | Fresh station Horizons results agree with separately computed retained CSPICE station reference. | Current strict station parser: all 75 archived epochs / 225 components against retained CSPICE reference; fresh provider retrieval is reported separately. |
| resources-06 | verified | Plane-parallel slant attenuation and atmospheric emission noise reproduce JPL published example. | DSS-34 Canberra climatological 90% year-average Ka32GHz, elevation20deg, Azen0.384dB, TM277.5K; approximate mapping valid here10..90deg. |
| resources-07 | verified | Missing forcing and missing communication evidence remain unknown, with exact allocation-time integration and explicit inference boundaries. | Implementation/status behavior only; UTC half-open spans, h for resources, bit/s × s for data; no new physical claim. |
| resources-08 | uncertain | Date-specific irradiance and real photovoltaic generation remain unqualified. | W/m², W, m²; selected mission epochs; local ENU incidence. |
| resources-09 | uncertain | Battery capacity, efficiencies, load profile and reserve policy lack qualified hardware/environment evidence. | Wh,W,h; cold lunar operating environment and vehicle requirements. |
| resources-10 | uncertain | Reference-epoch station positions and predicted EOP do not establish dated precision station pointing. | ITRF93 epoch2003.0; requests2026-11-14..15 UTC, EOP prediction after2026-11-13. |
| resources-11 | uncertain | Earth-centre lunar visibility and positive RF margin do not prove selected-station support. | Lunar terrain-centre ray versus terrestrial station ray; bit/s,s and UTC support windows. |
| resources-12 | uncertain | Weather context does not determine frequency-dependent slant attenuation or total receiving-system noise. | Open-Meteo mm/hourly accumulation,cloud%,wind km/h versus RF dB/K; band/frequency/polarization/path dependent. |
| resources-13 | uncertain | Hourly forcing and boundary-censored runs lack a qualified continuous-time visibility or event guarantee. | Half-open UTC stay; sample-held h and model event-offset h; lunar local and station horizons. |
| resources-14 | uncertain | Finite declared-case stability is not a probability, continuous bound or qualified uncertainty result. | At most27 lower/nominal/upper cases across3 fields; canonical scenario requirements and operations held fixed. |
| D01 | verified | Reference GM, sphere radius, sidereal spin and Isp conversion constants match primary tables | Constant transcription and SI conversions only |
| D02 | verified | Both solvers reproduce force/mass acceleration and the short-time hover limit | Implementation limit at t=0..0.001 s, nonrotating E/up/N, SI |
| D03 | verified | Mass flow, fractional burn cutoff, dry-mass stop and ideal rocket delta-v use standard g0 | Propulsion arithmetic, not actual net trajectory delta-v |
| D04 | verified | Both solvers reproduce analytic circular two-body motion and invariants | Point-mass spherical Moon; nonrotating site axes; 100 km circular orbit, 600 elapsed seconds |
| D05 | verified | Configured radial contact agrees with closed-form vacuum fall time and energy | 100 m drop from rest onto synthetic y=0; nonrotating E/up/N |
| D06 | verified | Configured constant-spin terms reproduce an analytically rotated inertial circular orbit | Equatorial Moon-fixed E/up/N, left handed; 120 s; no UTC epoch |
| D07 | verified | Target distance reports a reference-sphere arc in metres | Reference sphere R=1740400 m, radial height -125 m, angular displacement .04 rad |
| D08 | verified | Nonfinite terrain cannot poison or suppress legacy reference contact after the fix | Finite/unknown height handling in the legacy solver; configured semantics retained |
| D09 | verified | Both solvers reject a state initially below known terrain after the fix | Initial local numerical surface consistency only |
| D10 | verified | Legacy surface-event solve passes the exact central-force radial fall benchmark | Synthetic100m radial drop, 4700kg, spherical or flat reference contact; not real touchdown dynamics |
| D11 | uncertain | Assisted contact tends toward a stable result as command steps shrink | Numerical self-convergence of an authored feedback demonstration; not independent guidance truth |
| D12 | verified | Incoming landing classification preserves known-failure precedence and unknown terrain | Entered preview limits only; radial velocity/tilt and reference-sphere target distance |
| D13 | verified | Rigid proxy free flight matches its disclosed constant-gravity ballistic equation | Rapier 0.21.0, 120 Hz, right-handed X/up/Z; +X horizontal; synthetic t=0 |
| D14 | uncertain | Fragment proxies constitute physical vehicle breakup and qualified contact | Bounding-box collision/inertia and assumed AABB-volume mass allocation |
| D15 | verified | Analytical touchdown/propulsion/orbit screens reproduce independent mechanics limits | Supplied scalars; SI arithmetic only |
| D16 | verified | Engineering screen success is conditional and missing/known-failing inputs retain their gates | evaluateEngineeringScreens only; parent-owned evaluateScenario is unchanged |
| D17 | uncertain | Steady-state thermal arithmetic predicts real component survival | Single-node balance and supplied optical/environment values |
| D18 | uncertain | NASA history and empirical literature qualify this generic landing/GNC/soil/plume model | Applicability boundary; no claim that editable defaults represent Apollo telemetry |
| D-EVAL-01 | verified | Three reconstructed CLPS descents reproduce hash-pinned NASA/PDS source positions and velocities | 740 sampled source states: Athena, Blue Ghost 1 and Odysseus, IAU_MOON geometric positions only |
| R-EVAL-01 | uncertain | Current live three-station provider comparison | 50 retrieved epochs; 1 station retrieval failures in this attempt |

## Important remaining limits

Terrain frame registration, effective resolution/error propagation and physical skylines are not qualified; existing prepared horizons were not recomputed from complete original polar DEMs in this audit. Actual vehicle performance, structural/soil/plume behavior, ground-station bookings, operational RF margins, real thermal survival and recoverable ice remain outside the verified evidence. Predictions and sampled reference comparisons are not flight approval.

## Corrections

- Replaced the reverse apparent range with 17521 Moon-observed Earth range rows. Same-input checkpoint maximum range residual: 252.07539019174874 m against the preregistered5km implementation screen.
- Corrected Earth angular size for site parallax; all56 checkpoints pass the original0.0001degree limit.
- Corrected terrain resampling registration; the demonstrated edge discrepancy fell from0.602m to0.0019691672628141532m within the original encoding tolerance. This is not physical2mm surface accuracy.
- A missing source stencil stays unknown in the horizon producer.
- Repaired registered asset hashes and advanced the planning model/dataset identities.
- Replaced legacy linear impact interpolation with a bracketed dynamic event solve; exact radial benchmark passes without loosening its tolerance.

Reproduce source-specific commands in each lane REPORT.md and integration receipts. `scripts/compile-scientific-verification.py` validates the recorded comparisons; fresh execution of those checks is required before updating this register.
