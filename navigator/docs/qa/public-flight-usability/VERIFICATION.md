# Public launch and landing usability verification

15 November 2026. Fresh browser contexts, no persisted onboarding or mission state. Actual Public controls and original NASA assets; no input injection or replacement physics. Hosting remains teammate-owned.

## Findings and corrections

The previous first Lander screen placed reset/technical-contact reports and a separate touchdown lab before the actual experiment controls. A large site-stay banner also reduced scene space. The corrected screen starts with the flight task, setup and Play. Secondary guidance/lab controls remain available in a disclosure, and stay guidance returns in other panels. At 1440×900, Play is inside the initially visible inspector without scrolling; the scene retains a visible, physical-scale lander.

Public predictions name each excessive contact-speed component, miss distance, tilt and impact-energy failure. Missing terrain remains explicit even alongside known failures. All 22 numeric controls have adjacent hover/focus/tap help explaining what they change, including acceptance-only and post-contact controls. An edit pauses/resets playback and identifies the changed variable, with previous/current calculated contact values where available. Multiple changed inputs are not presented as a controlled single-variable experiment. Public explanations do not replace the technical incoming-contact record or authorize a real landing.

## Executed checks

- Source: 790/790 tests; 8/8 focused checks after correcting two test-only ES2018 regex flags for the project's ES2017 target. TypeScript, ESLint, production and standalone builds complete. Native MathML manifest remains unchanged at 314 expressions.
- Actual responsive Next and disconnected standalone: 8 journey groups each, including original startup, initial Play visibility, nominal contact, weak-engine breakup, every numeric variable's help/edit/prediction, complete Follow playback, ascent/input persistence and reload/error checks. File transport makes zero HTTP requests.
- Complete launch/landing trajectories are sampled on both transports; see the per-frame receipts. The pre-scheduling offline run also recorded 140 assisted, 104 weak-engine and 586 ascent samples; physical scale 1×, visible and framed through completion. These are sampled software observations, not an FPS benchmark or physical qualification.
- Native 200%/small-screen stress gate: final isolated run 8/8, normal exit 0, actual HTTP/file framing through all 12 HUD/location states, all six chart-focus labels and internal inspector scrolling. Retained pre-scheduling failures: three attempts time out at the Lander click. After deferring mount, the click completes but the concurrent run times out waiting for subsequent render frames; graph focus labels and inspector scrolling pass. Final receipt and selected native screenshot are retained beside those failures. Native zoom checks use forced SwiftShader software rendering; they do not establish hardware frame rate or cold-start latency.

## Retained failures and limits

The initial source suite caught layout declarations in the colour-only theme stylesheet; they were moved to the existing layout stylesheet, with the theme assertion preserved. The first startup observer waited for a transient loader after DOMContentLoaded and missed it; the final verifier observes startup mutations from document creation. A 50× Play/Pause probe missed a completed short landing; the captured final contact state confirmed completion. Final visibility runs start at 1×, observe the running clock, then accelerate and record actual render frames through the terminal state. Failed receipts are retained; numerical/physical tolerances are unchanged.

Automated tests and an agent's first-use inspection identify friction and show the intended loop works. Enjoyment, learning outcomes and cold usability still need actual Public participants. These are illustrative flight/contact models with generic hardware/thresholds; qualified navigation, structure, soil/gear and operational evidence remain in the full TODO handoff.

Cold setup diagnostic: the original main artifact's click resolved in about 12.7 s and the pre-scheduling candidate in about 7.1 s on this host. Those are not controlled comparative benchmarks. Selection and initial canvas creation precede asset readiness; multiple 1–2 s browser tasks were recorded. The scene now schedules heavy WebGL construction after a paint opportunity, with cancellation/transfer-ownership tests. The isolated final stress run passed with unchanged action timeouts and physical assertions, separate from builds, source-physics tests and other browser journeys; failures remain attributed to their exact artifact, without declaring an unverified cause.

Text log copies normalize indentation tabs and remove trailing whitespace for repository hygiene; `checks.json` retains raw command-log hashes as well as the normalized evidence-file hashes. JSON observations and image bytes are unchanged.
