# Published mission trajectory coverage

Worker delivery, 15 November 2026, base `96079ae`. This catalogue is deliberately bounded. It does **not** claim that all historic launch, ascent and descent trajectories have been found. No confirmed as-flown lander trajectory is certified by this delivery. A numeric reference descent and a reconstructed command-module orbit are available for honest, separately labeled playback.

## Available numeric paths

| Dataset | Classification and vehicle | Bounded coverage | What it establishes |
| --- | --- | --- | --- |
| `chandrayaan-3-descent-reference` | **Reference**; Vikram lander, Horizons `-158` | 2023-08-23 12:16:00–12:34:00 **TDB**, 109 samples at 10 s | A published numeric descent-shaped ephemeris from ISRO/JPLNAV through JPL Horizons. Header source `chandrayaan-3_lander_mer`; revision 2023-Aug-23. The metadata does not establish a final descent tracking fit, covariance or as-flown accuracy. Never label this confirmed flown telemetry. |
| `apollo-15-csm-orbit-reconstructed` | **Reconstructed orbit**; CSM `-915`, **not LM** | 1971-07-30 18:00:00–18:30:00 **TDB**, 181 samples at 10 s | Actual archived numerical reconstruction of the CSM orbit for camera support. No landing, surface ascent, launch or attitude data. |

The [exact bounded Horizons request](../public/data/trajectories/chandrayaan-3-descent-reference.json) and [structured source vectors](../public/data/trajectories/ch3-source-vectors.json) are archived locally. Raw responses remain in `/tmp/lunario-trajectory-sources/`, with their hashes recorded in the datasets. The [Apollo kernel comments](https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/apollo15-1.cmt) identify the CSM reconstruction, J2000 assumption and its limitations. The associated [Apollo JSON](../public/data/trajectories/apollo-15-csm-orbit-reconstructed.json) records the exact kernel hash. Raw kernels remain under `/tmp/lunario-trajectory-sources/`.

Every existing `LANDING_SITES` ID is represented in `MISSION_TRAJECTORY_COVERAGE`. Apollo 11/12/14/16/17 and SLIM have no validated lander path here. Apollo 15 has orbital context only. Chandrayaan‑3 has reference descent only. Other pins explicitly say **not reviewed** rather than implying a completed unsuccessful search. All sites retain an independent educational simulation option through the parent callback.

## Taxonomy and evidence

- **Flown:** a time-tagged path explicitly documented as the flight record; no datasets in this delivery meet that threshold. A mission having landed does not make every ephemeris for it flown.
- **Reconstructed:** postflight estimation documented by the producer; retains uncertainty and missing phases. Apollo 15 CSM qualifies, separately from its LM.
- **Planned:** a stated preflight mission design; do not relabel it after launch.
- **Reference:** published representative/navigation ephemeris whose exact as-flown fidelity is not established for this interval. This is the conservative Chandrayaan‑3 classification.
- **Educational simulation:** editable model output, independent of historic replay; never mixed into published samples to fill missing phases.

A landing coordinate, map, video, single orbital element set, or phase diagram cannot establish a sampled flown path. [Horizons explicitly warns that spacecraft ephemerides can mix tracking fits and predictions and are not live telemetry](https://ssd.jpl.nasa.gov/horizons/manual.html#spacecraft-trajectories-in-horizons).

## Source investigation and gaps

The [source-attempt ledger](qa/trajectories/source-attempts.json) records primary URLs, response identities, hashes, retrieval outcomes and findings. The initial bounded queries targeted Apollo NAIF SPK, PDS Apollo ephemeris, Apollo 11 descent/BET reports, JAXA SLIM data and ISRO Chandrayaan‑3 descent products. No authentication was bypassed and no contact/request was sent to an agency.

| Primary source | Finding and boundary |
| --- | --- |
| [NASA SVS 14959](https://svs.gsfc.nasa.gov/14959/) | Moon visualization models, not trajectories. |
| [NASA SVS 5632](https://svs.gsfc.nasa.gov/5632/) | Flight-derived Artemis II flyby visualization, with a further numeric ephemeris link. Not a lunar landing. Browser fetch timed out; direct HTTPS retrieval succeeded and is hashed in the ledger. Numeric flyby data was not imported in this bounded delivery. |
| [NASA SVS 5610](https://svs.gsfc.nasa.gov/5610/) | Nominal/reference Artemis II flyby. Keep separate from 5632 and landing histories. |
| [NASA SVS 5535](https://svs.gsfc.nasa.gov/5535/) | CSM orbit visualizations derived from mission-report elements. The source discusses interpretation errors and frame changes. It supplies no LM descent/ascent time-series. |
| [NAIF Apollo SPK index](https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/) | Apollo 15 CSM and Apollo 16 subsatellite. The latter is a non-propulsive orbiter with documented segment discontinuities; it is not a landing. |
| [PDS Apollo](https://pds-geosciences.wustl.edu/missions/apollo/) | Apollo 15/16/17 photographic support ephemerides refer to cameras in lunar orbit. They are a further orbital-data lead, not a lander replay. [Apollo image ephemeris site](https://apollo.im-ldi.com/EPHEMERIS/) returned an explicit temporary-unavailability page despite HTTP 200. |
| [Apollo 11 reconstruction, 1970](https://ntrs.nasa.gov/citations/19700014995) | Volume I foreword, printed p. iii, identifies the NAT/BET listing as Volume II, not generally distributed and available by request at publication. No Volume II listing was obtained. The old Flight Journal PDF link returned 404; the verified NTRS download succeeded. This does not establish present-day request availability. |
| [Apollo 11 final descent reconstruction, 2022](https://ntrs.nasa.gov/citations/20220007267) | Digitizes sparse graphics and estimates planar range/altitude using simplified models. It is useful reconstruction evidence, but no global time-tagged 3D numeric attachment was found here. No plot points were invented or silently geolocated. |
| [JAXA DARTS SLIM](https://darts.isas.jaxa.jp/en/missions/slim) | Dataset list says “in preparation.” No numeric descent data obtained from this page. This is not a claim that none exist elsewhere. |
| [ISRO Chandrayaan‑3](https://www.isro.gov.in/Chandrayaan3_Details.html), [Government of India STSC presentation](https://www.unoosa.org/documents/pdf/copuos/stsc/2024/ListTechnicalPresentations/2024_STSC_technical_presentations_slides/9_26_--_4_INDIA_Chandrayaan3.pdf), [ISDA](https://pradan.issdc.gov.in/ch3/) | Primary-country sources for capabilities, phases and archive status. Web retrieval of the details page succeeded; direct Python requests to details/brochure returned 403 and are retained as such. The search-indexed brochure also failed a web open; the cited India/UNOOSA presentation downloaded successfully and slide 10 was visually inspected. Payload archives do not alone establish final-descent tracking-fit provenance. |

No individually verified landing time-series search is claimed for Surveyor, Luna, Chang’e, Beresheet, Chandrayaan‑2, HAKUTO-R, Odysseus, Blue Ghost or Athena. Those remain explicit catalogue gaps, not fabricated successes or proof of unavailability. Obtaining authoritative lander BET/state data, resolving precise frame equivalence and licensing of any additional agency payload are follow-up gates.

## Frames, times, bounds and uncertainty

Source positions/velocities are Moon-centered ICRF/J2000 in km and km/s, geometric (`NONE`, no apparent/light-time path). Preparation uses CSPICE `sxform('J2000','IAU_MOON',et)` on the **full six-component state**, including frame-rotation velocity terms. Exact SHA256s for `apollo15-1.bsp`, `naif0012.tls`, and `pck00011.tpc`, toolkit/package versions and SPK coverage intervals are in [conversion.json](qa/trajectories/conversion.json). No planetary SPK is needed: the Apollo segment is evaluated directly relative to center 301 and Horizons already returns center 301 vectors.

`IAU_MOON` from the text PCK is **not** declared equivalent to the map’s ME frame. This transformation is a documented display-frame choice, not upgraded historical geodesy. `trajectorySceneKm([x,y,z])` only changes axis convention to `[x,z,-y]`. Parent must retain the frame warning, resolve registration before terrain-contact claims, and never snap the endpoint to the selected pin or rotate the route to make it fit.

Epoch `calendar` has no `Z` because its `scale` is explicit. TDB is not UTC. The separately computed `utc` is a display aid from CSPICE/LSK. For example, the descent extract begins at 12:16:00 TDB = 12:14:50.817 UTC. Playback uses elapsed mission seconds, never JavaScript parsing of a TDB label as UTC.

Only linear Cartesian display interpolation is implemented. Exact endpoints are allowed. Out-of-range, nonfinite and oversized-gap lookups return `null`; there is no extrapolation. Interpolated velocity is a displayed interpolation of supplied velocities, not a new force solution or necessarily the derivative of the position chord. Attitude is always `null`. No orientation, engine plume, throttle, burn boundary or contact is inferred from path tangents.

Fresh midpoint comparisons against source evaluation gave maximum position discrepancies **35.991 m** over 108 descent segment midpoints and **20.171 m** over 180 CSM segment midpoints; see [interpolation.json](qa/trajectories/interpolation.json). These are sampled display discrepancies, not continuous error bounds, tracking accuracy, terrain clearance, or covariance. The source does not provide physical uncertainty estimates. Do not use these paths to certify navigation or landing readiness.

## Documented rationale and editable variables

`MISSION_TRAJECTORY_REASONS` contains cited goals, phase-specific explanations and relevant variables. The component visibly distinguishes **documented rationale**, **display design choice** and **unresolved evidence**. Citations include locators; tests reject uncited source-derived reasons.

- Apollo lighting dates: [SVS 5535](https://svs.gsfc.nasa.gov/5535/) connects early-morning arrival with useful shadows and moderated temperatures. Site longitude and date affect that choice.
- Apollo 11 translunar coast: [NASA mission overview](https://www.nasa.gov/missions/apollo/apollo-11-mission-overview/) explains the pre-insertion free-return abort option. Injection state and corrections affect the coast; it is not a line to a surface pin.
- Apollo 11 descent: [Mission Report](https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf), §5.1, explains the lowered perilune, propellant-efficient braking and visible final approach under navigation, radar and terrain constraints. The linked NASA mission overview identifies the descent-orbit burn as retrograde. §5.3 documents manual crater avoidance and increased range. §5.6 explains initial ascent clearance, launch azimuth and orbit insertion for rendezvous; §5.7 explains rendezvous. These rationales do not supply missing replay samples.
- Apollo 12: [NASA TN D‑6846](https://ntrs.nasa.gov/citations/19720018205) documents the Apollo 11-derived navigation correction used for the precision landing.
- Chandrayaan‑3: [ISRO capabilities](https://www.isro.gov.in/Chandrayaan3_Details.html) and India’s STSC presentation (slide 10) explain braking, sensing and hazard-avoidance roles. They do not establish every flown control input. The Horizons header’s apparent “120 degrees” slope typo is not used; ISRO specifies 12 degrees.

Changing mass, thrust, throttle, initial state, site or timing belongs to the separate idealized simulation. It does not edit the historical dataset. There is no claim that NASA uses a generic 300 m starting preset.

## Parent integration contract

Import `MissionTrajectorySelector` from `components/mission-trajectories/selector.tsx`. Pass `site`, controlled `selection`, `onSelect`, and optional `onClose`. The selection union is `{mode:'published', siteId, trajectoryId}` or `{mode:'educational-simulation',siteId}`. The panel neither starts a renderer nor fetches anything. The parent must clear stale site selections; the panel also prevents stale selection highlighting.

Use `missionTrajectoriesForSite(site.id)` / `MISSION_TRAJECTORIES` to obtain validated source-bound data. For untrusted external bytes, verify the trusted artifact SHA256 with `verifyTrajectoryBytes`, decode JSON, then call `parseMissionTrajectory` with a trusted `TrajectoryIdentity`. Structural parsing alone is not provenance authentication. `parseMissionHorizonsVectors` validates bounded VEC_TABLE=2 text without silently converting its time/frame.

On published selection, pause, clear the previous replay, reset seconds to zero and establish a new monotonic `performance.now()` anchor when the user presses play. `missionReplayClock(data, anchorSeconds, anchorPerfMs, nowPerfMs)` implements **1 wall second = 1 mission second**, clamps at the endpoint and signals `ended`; invalid anchors return `null`. Re-anchor on resume/scrub, pause on tab invisibility if desired, and stop when ended. Use `missionTrajectoryState(data, seconds)` for bounded positions. This clock is independent of the planning clock, launch date search and existing flight solver.

Parent owns the camera and should reuse its existing smooth selected-site transition, respecting reduced motion. Keep path coordinates unchanged; camera easing is viewpoint motion only. The component intentionally supplies no flight-attitude fiction. There is no playback UI or camera integration claimed in this worker lane. Parent must wire the selector/clock, preserve data in its offline build, and verify the complete application. Static JSON imports make these datasets available to either bundle without network fetches.

## Credits and reuse

Numeric trajectory sources: NASA/JPL NAIF; JPL Solar System Dynamics/Horizons; ISRO/JPLNAV for Chandrayaan‑3. Apollo 15 orbit producer: Alex Konopliv/JPL; kernel packaging/comments: NAIF/JPL, Chuck Acton. Frame/time models: NAIF generic kernels. Rationale: NASA Mission Reports, NASA Technical Reports Server, NASA Goddard Scientific Visualization Studio and ISRO; SLIM archive status: ISAS/JAXA. Preserve these credits with any extract.

Only numerical ephemeris facts served publicly by JPL and our bounded derived numeric output are bundled. ISRO/JAXA imagery, text, logos and PDFs are linked, not republished; no blanket public-domain license is claimed for non-US agency material. ISDA’s page carries an ISTRAC copyright notice. NASA/JPL distribution does not establish rights to every agency’s underlying images or future downloaded payload. No NASA endorsement or operational authority is implied.

## Reproduction and verification

```sh
uv run --python 3.12 --with spiceypy scripts/prepare-mission-trajectories.py
python3 scripts/prepare-mission-trajectories-review.py
npx tsx --test tests/mission-trajectories.test.ts
node scripts/prepare-mission-trajectories-browser.mjs
npm run typecheck -- --incremental false
npm run lint
```

Kernel downloads and the reproducibility cache remain in `/tmp`; no package or lockfile changes. The cached raw Horizons response has a retrieval timestamp, so a fresh download changes its byte hash even when vector values match. A refresh therefore requires explicit provenance/hash review and corresponding trusted identity updates. Preparation does not silently turn a source refresh into approval of new data.

[Browser evidence](qa/trajectories/browser.json) covers this isolated selector: callbacks, keyboard selection, source inspection, dismissal, zero network requests, 390 px reflow and 200% CSS zoom. [Desktop](qa/trajectories/selector-desktop.png) and [mobile](qa/trajectories/selector-mobile.png) proofs were visually inspected. This is not a full-app camera/playback, accessibility or scientific acceptance claim. No app server or shared browser/profile was used. Durable investigation decisions and unresolved gates are retained in this document and the owned QA ledger; shared vault files were not edited under strict lane ownership.
