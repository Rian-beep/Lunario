# Lunario branding, reference UI and flight verification

15 November 2026. Product source: `329241f4a30e8e2475f36de72ae3b10402f72649`. Offline delivery: `b87779e`. [Exact identities and size](evidence/identity.json). Later evidence/documentation commits do not change the tested application.

The actual brand source is [Rian-beep/Lunario](https://github.com/Rian-beep/Lunario), pinned at `aeb673fff6de377e5dba0982c0c55c8b0d874ee8`. Original vendor hashes and embedding checks are in [provenance](../../../public/branding/lunario/provenance.json), [brand report](../lunario-brand.md) and its tests. This replaces the earlier SolarReach Sun icon/Lunar Window name adaptation.

## Executed checks

| Gate | Result and scope |
| --- | --- |
| Source | 784/784 full tests, zero failed/skipped; 26/26 focused brand/theme/experiment checks after final integration; TypeScript, ESLint and 314-expression native MathML check pass |
| Builds | Separate Next production build and disconnected standalone generation pass; local Geist font avoids a build-time font download |
| Exact final flight artifact | 12/12 actual Next + disconnected-file journeys: original loader/logo/reference surfaces; local Follow; play/pause/running replay/nominal contact; weak-engine breakup; ascent/input/camera persistence/variable help; session reload/no browser errors |
| Final native viewport | 8/8, including true 200% at 800×496 on HTTP and disconnected file through 12 HUD/location states, all six science-chart focus labels/final battery boundary, and internal inspector scrolling at 800 px |
| Resource/contact/playback | 50/50 over actual Next and disconnected file: 18 planning, 12 antenna-contact and 20 playback checks. The final annotation-only CSS adjustment preserves byte-identical data and application JavaScript; see the retained proof |
| Startup edges | 3/3 actual-browser cases: reduced motion, denied session storage, explicitly unavailable catalog and Retry recovery. The failed catalog is a labelled fixture, not a live provider result |
| Educator | Actual 1920×992 scene, native student/teacher HTML, separate teacher JSON, exact captured scenario, escaped title and student-answer separation pass; screenshots inspected |
| Preview promotion | The existing 1200×898 viewport and 1,265-byte mission state remain unchanged by hash. The app fills the viewport; current preview is http://127.0.0.1:4317/ |

Reports, selected screenshots and command-log identities are retained in [evidence](evidence/). These are overlapping scope checks, not a count of unique scenarios or a human usability study. Initial broad resource checks and educator downloads ran before the final unboxed-legend text correction; `css-only-finalization.json` proves identical data/application scripts. Both complete flight transports and the native viewport suite were rerun on the exact final HTML.

## Actual flight observations

The original close-up → Follow transfer reproduced a camera distance exceeding 3,100 km while the lander was selected. The corrected local transfer preserves the user's viewing offset instead of taking the celestial arc. The final sampled transfers stay below 0.2 km with the physical vehicle visible/framed and no active celestial flight. Larger Earth/Moon camera journeys remain animated.

Reference loading is explicit and replaces the example flight/hardware inputs; browsing presets and camera navigation preserve edits. Play waits for a completed-render Follow view, loaded original assets and prepared contact continuation. Cancel remains available while preparing. Replay resets the clock while already running. Editing inputs pauses/resets the experiment instead of mixing a new trajectory with an old timestamp.

At Connecting Ridge, the weak-engine reference reaches numerical contact at about 19.415 s. The final web and file executions observe 157 fragments and signed terrain clearance approximately −0.000284 m at the retained sample, inside the existing −0.05 m gate. Nominal contact and ascent also execute. Geometry/scene identity and fixed 1× scale survive input edits. These are bounded illustrative contact observations; they are not qualified fracture mechanics, soil/gear dynamics or an operational landing solution.

The six references, production-simulator synthetic-terrain tests, native equations, T/(mg), scoped upright stopping estimate, remaining ideal velocity budget and fuel/target-error explanations are documented in [flight experiments](../flight-experiments.md). Current-site results remain separate from synthetic reference evidence. A wider target radius changes a requirement, not the landing point. No universal NASA safe range is invented.

## Visual correction and retained failures

The reference is implemented through cream/peach cards, orange title strips, heavy ink edges, hard offset shadows, mint selections and yellow/chartreuse accents. Original NASA images are unchanged. Original Lunario SVGs/font/loader are imported rather than redrawn. Dark-ink chart legends sit on paper cards; the unboxed scene legend uses pale, haloed text over lunar imagery. Declared-color contrast tests and visual inspection are narrower than a global rendered contrast/WCAG audit.

Exploratory records remain in their original `/tmp/lunario-browser-*` and `/tmp/lunario-native-*` directories. The first integration exposed real defects: a native onboarding dialog hid the loader in the top layer, and the reference select lacked a concise explicit accessible label. Both were corrected. Harness corrections were distinct: variable help is an interactive dialog, a nested locator was incorrectly scoped, empty contact times must not become numeric zero, and Pause near a 50× endpoint can race the newly rendered Play action. The final verifier slows playback for inspection, preserves real bounds and has unchanged before/after script hashes. An interrupted attempt is not counted as a pass.

The first native run needed an old startup helper to wait for the new document-owned loader. A later final-artifact run timed out after a Lander click under concurrent browser work; its underlying cause remains unverified. The unchanged artifact then passed the complete isolated 8-case suite with normal exit 0. Failed receipts remain; no physical/framing assertion or numerical tolerance was relaxed. The final full source and browser receipts are green.

Slop scan: eight inspected notices, including retained validator/error-cause patterns, QA wrapper/readability notices and the exact vendor loader's guarded storage catch. The original vendor bytes were not edited to satisfy a metric; denied-storage behavior is tested.

## Remaining evidence and ownership

The new interaction loop is implemented and exercised. Whether it is enjoyable, understandable and educational still requires cold target-user studies. Actual screen-reader/touch/target-device and final-origin provider/CSP/cache testing remain separate. Qualified terrain/frame/vehicle/control/structural/station/thermal evidence and full mission trajectories are still needed for operational claims. See the [full TODOs and teammate handoff](../../IN-FLIGHT.md). Hosting remains with the teammate; no Vercel deployment was performed.
