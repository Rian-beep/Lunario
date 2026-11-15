# Flight experiments worker handoff

Scope: the FlightPanel portion and import in `components/workbench/panels.tsx`, new `components/workbench/flight-experiments.tsx`, `lib/flight-experiments.ts`, `tests/flight-experiments.test.ts`, and this note. Base `5049879`, isolated `codex/lunario-flight`. No physics coefficients, scene, Navigator, shared CSS, package, planning identity, NASA assets or offline builder changes.

## Interaction contract

Existing `FlightPanel` required props are unchanged. Optional `onPlay`, `onPause`, `onReplay`, `onFollow` are zero-argument callbacks; `playing?: boolean` defaults to false. The panel forwards them unchanged. Labels are **Play experiment**, **Pause experiment**, **Replay experiment**, **Follow vehicle**. Missing callbacks disable their buttons and explain why. There is no internal clock, autoplay, camera mutation or live throttle controller.

Root must connect these to actual flight playback/camera state, reset or pause the clock when explicit input/reference changes require it, and verify replay after flight/contact completion. Playback/camera connection and end-to-end browser proof remain root work. Selecting a reference only changes the card; **Load reference** explicitly replaces inputs including example hardware. It does not play or follow automatically. The existing **Reset 300 m approach** remains a distinct explicit reset that preserves entered hardware. No effect depends on site, camera or value, so this component cannot reset edits during a site/camera update. Parent remount/state behavior remains an integration responsibility.

## References and numerical evidence

Every reference is a fresh `DEFAULT_FLIGHT` copy, with terminal cases built through `createLandingFlight` and its existing landing contract. No engine or limits are changed to manufacture a favorable result. All cases use the production `simulateFlight` solver in tests with explicitly synthetic zero-height numerical terrain. Values below are reproducible example outputs, **not lunar terrain measurements or NASA criteria**:

| Reference | Synthetic result |
| --- | --- |
| Assisted 300 m | Within entered incoming limits; vertical about −0.559 m/s, sideways 0.710 m/s, target arc 8.412 m |
| Manual powered descent | 100 m start, −8 m/s, upright 10,000 N for 12 s; vertical about −11.644 m/s at contact after cutoff; outside limits |
| Ascent | Existing ascent defaults; maximum radial altitude about 83.447 km; no orbit/transfer claim |
| Underpowered | Assisted approach with thrust alone reduced to 4,000 N; vertical about −22.982 m/s; outside limits without fuel exhaustion |
| Sideways / overshoot | Assisted approach with initial horizontal speed alone raised to 100 m/s; sideways about 23.947 m/s and target arc 1,212.508 m; outside limits |
| Bounce / contact | Unpowered 3 m drop, −1 m/s, restitution 0.65; incoming vertical about −3.278 m/s and energy 25,251 J, below the unchanged 100,000 J breakup threshold but outside the 2 m/s vertical limit |

The last row is an incoming contact experiment, not a claimed safe landing or proof of rebound. Restitution changes the downstream existing contact continuation, not the airborne path: tests verify identical incoming points/contact at restitution 0.65 and 0.1. Root must observe the actual contact continuation for bounce/settling and preserve its unsupported/unknown states. No separate physical matrix or end-to-end script was run; the required npm test includes its existing contact regressions.

Single-variable production tests verify: reduced manual burn from 12 s to 8 s worsens incoming vertical speed; increased ascent final pitch from 35° to 60° increases maximum height; insufficient thrust worsens descent; excessive sideways speed worsens sideways contact and target error. Unknown terrain retains reference-sphere contact and an unresolved verdict; the nominal case also passes its entered limits with the existing south-polar rotating frame.

## Diagnostics and teaching limits

Current-result observations use supplied integrated incoming radial/sideways speeds, contact target arc, last airborne mass and actual depletion/cutoff status. Current data never inherit the synthetic reference's result. AudienceContext adds controlled-variable interpretation for Educator and decision/evidence depth for Planner; Public uses plain language. Existing Info supplies hover/focus/tap help. Compact native disclosures hold extra reference evidence and engineering explanations; existing editable fields and contact controls remain available below.

- Initial thrust / lunar weight uses actual first-point body-centred radius and the engine's lunar gravity parameter. The displayed upright net acceleration is full configured thrust divided by wet mass minus central gravity. This is potential upright acceleration, not the commanded assisted/manual vertical acceleration; rotation terms are omitted in this scalar estimate.
- Ideal stopping distance uses actual initial negative radial speed squared divided by twice the positive upright net acceleration, at frozen mass/gravity with immediate upright thrust. It is unavailable for upward/rest starts, nonpositive net braking, no thrust, no burn time, absent propellant or invalid/missing inputs. Finite burn time, fuel, sideways braking and terrain clearance still constrain the integrated result. A finite distance **does not prove closed-loop feasibility**.
- Ideal remaining velocity-change budget is specific impulse × standard gravity × log(last airborne mass / dry mass). It is unavailable for invalid masses or missing result; zero at dry mass. It is not a mission reserve margin or usable post-contact capability. Tests check consumed plus remaining ideal budget against the full rocket-equation budget.
- Equations use the existing trusted NativeMath registry and font infrastructure; no TeX is displayed or new registry entries required. Standard gravity for specific impulse is 9.80665 m/s², separate from computed lunar gravity. Input suggestions are vehicle-relative comparisons, not invented universal critical ranges.

## Verification and remaining integration

Focused tests cover factories, immutability, actual production outcomes, single-variable direction, unknown terrain, diagnostic equations and unavailable branches, fuel reasons, SSR in all audiences, native MathML, controlled callback forwarding and disabled unconnected controls. Existing landing-panel tests remain green.

Root retains rendered browser review, narrow/200% reflow, actual keyboard/popover use, scene play/pause/replay/follow and post-contact behavior, site/camera edit persistence through Navigator, final builds and disconnected HTML verification. SSR is not visual or user acceptance. No app server, browser, Simulator, Metro, dependency installation, push or merge was used. No ephemeris/geometry changes warrant Horizons revalidation in this lane.

Fresh worker gates, 15 November 2026: `npm test` **773 passed, zero failed/skipped** (includes 11 new experiment tests); `npm run typecheck -- --incremental false` **PASS**; `npm run lint` **PASS**; `npm run math:check` **PASS**, 314 authored expressions; owned `git diff --check` **PASS**. `slop-scan` is not installed/configured; no scan claim. Test counts describe this run, including concurrent disjoint repository edits, rather than a permanent baseline.
