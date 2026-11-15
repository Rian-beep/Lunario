# End-to-end and audience usefulness audit

14 November 2026. Tested source/delivery: `f6aa864d3cf202631ccd6f4d7f0f9e7027f8ec59`. Final offline SHA-256: `d7d38c5ae28fbb8f69244aeae2fd5be526f3750103158173dc110ab8473a44ce`. No application code was changed during this audit.

## Verdict

The app is useful today for guided learning and preliminary lunar resource/site-date screening. It implements most of the challenge's functional objectives. It has **not established the strongest possible audience experience**, and it is **not a mission-qualified planning system**. Those are different conclusions: the challenge does not require operational certification, but it explicitly values rapid, intuitive interpretation. More datasets or models alone will not close the remaining usability and scientific-evidence gaps.

This is an observed browser/task review, not research with representative members of the public, professors or mission engineers. Passing workflows demonstrate working software, not comprehension, scientific qualification or adoption.

## Fresh end-to-end results

- Web production app: 9/9 planning workflows passed.
- Fully disconnected final HTML: 9/9 planning workflows passed; zero HTTP requests and uncaught page errors.
- Communication consistency: 6/6 web and 6/6 offline checks passed. Public figures, horizon windows, forecast, comparison and exported assessment agree at0° and2° antenna cutoffs. Raw terrain-only visibility remains separately labelled.
- Fresh isolated audience walkthrough: Public/Educator/Planner onboarding, default workspace, delayed-arrival failure, controlled comparison, expanded explanation/equation and horizon navigation completed without uncaught errors. Viewport 1728×1000; no shared user profile was changed.
- Full final-artifact flight/navigation/contact run: **88/88 passed** on the exact final R7 HTML over HTTP and disconnected file contexts at1280/1728/800px. This includes real pointer navigation, NASA equipment, named station choices, custom pins, full selected-flight Follow, physical COM/HUD/mass/clearance, nominal landing, low-thrust breakup, fuel exhaustion, target miss, bounce/tumble, pause/scrub/reset, rendered-frame counters and immutable artifact identity. See `final-artifact-flight.json`.

The nine planning workflows cover initialization, requirement inputs, 31-day calendar/controlled slip, saved comparison/open-exact behavior, decision export/recomputed import, finite sensitivity/invalid/cancel, teaching-record retention/audience state preservation, NASA runtime loading and historical missing-evidence handling. See the five JSON files alongside this report. Prior 589 unit tests, production builds, scientific checks and automated accessibility measurements remain separately recorded release evidence; they were not all rerun as part of this browser audit.

Fresh total: **118 passing automated checks** (18 planning,12 contact,88 final-artifact flight/navigation checks). This count does not mean118 independent user studies or118 scientific qualification tests. Separate manual inspection identified the content/framing/readability gaps below despite those green functional checks.

Environment: Google Chrome157.0.8103.52 on macOS for web/offline planning and audience screenshots. Clevo Chrome149/SwiftShader for the full flight run; its actual hardware, browser flags and software rendering backend are recorded in the report. No60fps or universal latency claim follows.

## Challenge coverage

Reference: [Lunar Landing Site Navigator brief](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/). Reviewed against the retained same-day full brief at `lunar-navigator-research/challenge-content.html`; the current public HTML shell was reachable, while the browsing extractor could not retrieve its complete dynamic body.

| Brief outcome | Observed coverage | Remaining difference from an exceptional solution |
|---|---|---|
| Rapid site/date comparison | Controlled comparisons, calendar, searches and saved scenarios work | Decision narrative and map-linked differences take too much navigation; dense tables compete visually with background content |
| Sun/Earth against local horizon | Horizon analysis, terrain/smooth references, timeline and sampled event brackets exist | A direct spatial explanation of the actual occluder is not established; actual imagery lighting can differ from selected-time calculations |
| Power/contact evaluation | Whole-stay energy, reserve, unmet demand, geometric contact and editable assumptions work | Passing resource checks do not establish station availability, real link delivery, thermal survival or landing safety |
| Custom and historical locations | Supported, with explicit prepared/coarse/unknown distinctions | Users need an immediately visible sense of spatial resolution and whether a small coordinate change exceeds the model's resolving power |
| Multiple representations/time animation | 2D,3D, split view, dated playback and physical preview exist | The principal question and selected-time state should be easier to track while moving between representations |
| Public/educator/planner access | Distinct onboarding, public explanations, native equations/notebook and planning margins exist | Different information is implemented, but discoverability and task-specific workspace structure need improvement |

Documented NASA data usage is substantive: prepared JPL geometry, numerical LOLA terrain and LROC imagery contribute to results/context. QuickMap is a reference viewer and CSA material provides education context; neither should be described as a numerical dataset ingested merely because it appears in the resource list. The brief's central contribution is understandable comparison, not collecting every available file.

## Audience usefulness

| Audience | Useful now | Where it falls short | Acceptance target for the next iteration |
|---|---|---|---|
| Public | Explore places, see sunlight/contact windows, understand an explicitly failed energy case | Fresh Public landing after dismissal exposes the map but hides headline answers behind “Inspector”; the failure panel still includes Wh reserve terminology, masks and source caveats that require interpretation | An unfamiliar user can explain whether the chosen stay has a power problem, when the next relevant change occurs, and one sensible alternative without being coached through menus |
| Educator/professor | Native equations, symbol/unit definitions, example behavior plots, predictions and saved experiment records | The expanded equation starts inside a short scrolling inspector; the observed power example uses separate teaching constants, so the relationship to the current scenario requires another explanation | A complete learning sequence connects prediction, one changed input, synchronized observed result, derivative/units and a saved conclusion; a professor can expand the scientific assumptions and derivation |
| Planner | Meaningful preliminary comparison: date delay causes reserve failure; alternate site restores modeled energy while contact remains limited | Many fields/disclosures and repeated status text; “0 required unknowns” can be over-read when many disciplines are not required; source-frame and uncertainty qualifications remain unresolved | A planner can identify the violated constraint, first event interval, best tested controlled alternative, governing assumptions and all unassessed disciplines in one reviewable decision view |

The real delayed-arrival case is useful: unchanged equipment/stay produces a modeled reserve violation, about 52.10 kWh of unserved demand and a first crossing bracket. The alternative restores assessed energy conditions while retaining a 168 h geometric outage. This is considerably more useful than comparing illumination percentages alone. The next product improvement is making this reasoning the default journey.

## Reproducible usability findings

### U1 — Public headline answers are hidden on initial entry (medium)

Fresh browser → Public introduction → dismiss. The view contains location/map/compact time controls but no visible headline sunlight/contact result or explanation of the next useful action. Repeated by closing the inspector after returning to Public. The panel is available and functional; this is a discovery gap, not missing calculation. Evidence: `public-default.png`, repeated in `public-discovery-recheck.png`.

### U2 — Comparison text competes with underlying inspector text (medium)

Planner → expand a requirements/engineering section → load the real delay demonstration → open saved comparisons. The translucent comparison surface leaves underlying headings and fields visible through the table; the screenshot also shows a dismissible notification over rows. Background bleed is a readability observation, not a measured WCAG failure. Evidence: `comparison.png` and `comparison-recheck.png`; underlying field text still shows through on the repeated view.

### U3 — Educational depth is present but buried in nested scrolling (medium)

Educator → expand the first “Understand this relation” card. Standard form, symbol dictionary, assumptions, illustrative graph and table exist, but extend below a short inspector. The first expanded viewport barely reaches “Standard form.” Widening/resizing is available, so this is default task presentation rather than missing content. Evidence: `educator.png` and captured DOM text. A generic “Response (W)” y-axis is less instructive here than naming solar generation and its symbol explicitly.

### U4 — Lander focus centres the vehicle behind the inspector (medium)

Fresh Planner at1280×1000 → Lander → wait until NASA Moon assets are ready and another8seconds for camera settling. The inspector begins around x577 and extends to1257; the vehicle is centred near the middle of the full canvas, leaving most of it under the panel. Reproduced on Mac Chrome157 in the production app and Clevo Chrome149 in the offline run. Closing the inspector exposes the vehicle. The existing camera test verifies physical target/COM agreement but does not verify the unobstructed screen area. Evidence: `lander-framing.png`, `offline-lander-framing.png`; `offline-touchdown.png` shows the vehicle after the verifier closes the inspector. This is a framing defect, not a failed camera target or missing NASA asset.

### U5 — Guided preview retains an incompatible legacy solver description (high content priority)

In that configured guided-descent view, the visible document text still states “lunar rotation neglected” and describes force steps of at most0.25seconds. `docs/MODELS.md` separately specifies legacy manual0.25s/nonrotating flight and configured terminal ≤0.1s integration with site-latitude rotating-frame terms and numerical-terrain contact. The captured default includes target-landing guidance. This is a contradiction between the selected-mode explanation and documented model, not evidence that the physical solver itself failed. Evidence: `guided-model-description.png` and `lander-panel.txt`, terminal paragraph beginning “Seconds elapsed from preview start”; the same initial view is repeated in the offline capture. Equations, chart captions, frame labels, model identity and tolerances must all describe the selected computation.

No blocking runtime failure was found in the completed journeys. The framing and model-description findings demonstrate gaps in the current automated acceptance coverage. One readability recheck initially tried the covered Compare toggle while the sheet was already open; the explicit Close control is the intended interaction. That locator timeout is not reported as a broken comparison feature. The first new flight run had an incomplete ready-marker provenance field, corrected before the definitive run; this was verifier setup, not an application error.

## Immediate fixes before expansion

- Bind flight explanations/captions to the actual selected model and independently assert the guided/manual descriptions in browser tests.
- Frame the vehicle in the available unobstructed rectangle when panels are open; test projected vehicle bounds against panel/HUD rectangles, not just the camera target.
- Give data-dense comparison surfaces enough opacity/backdrop treatment to prevent underlying controls competing with results, while preserving the warm glass design.

## Highest-value improvements, in order

1. **Make each mode a task-led workspace.** Keep the clean map and dismissible panels, but put a compact outcome and next-action strip in the header: Public “What can happen here?”, Educator “What prediction are we testing?”, Planner “Which requirement fails, and what should we compare next?” Surface existing answers instead of adding another panel.
2. **Make the existing comparisons causal and spatial.** Reference/candidate views should share time, show changed inputs and resulting energy/contact deltas, and link the failure interval to the relevant plot and horizon. Add a map-linked terrain occluder only when retained ray-march/source provenance supports it; do not name a ridge from the visual mesh. Show the model resolution and held-constant assumptions. Highlight non-dominated tested options across reserve, blackout and schedule slip instead of presenting a single unexplained best score.
3. **Turn scientific uncertainty into a planning output.** Resolve the documented frame convention and validate terrain horizons independently. Propagate justified location/height/DEM/time uncertainties into intervals or stability results. Report “unquantified” where no defensible bound exists. Existing finite sensitivity sweeps are useful, but are not probability estimates or a complete robustness analysis.
4. **Build operational communication only through a qualified chain.** Selected station visibility/elevation → antenna/band/noise/pointing and weather losses → link margin/rate → available time/allocation → delivered data or critical-contact requirement. Existing Earth focus, weather context and scalar free-space budget do not establish that chain. The DSN locations are ground complexes, not satellites. Use official JPL interface/propagation documents and keep forecast horizon/unknown future conditions explicit.
5. **Connect the existing lessons to the selected experiment.** Offer a larger teaching workspace, live controlled parameters, synchronized real-scenario plots and an explicit derivative display. For the power example, with other factors fixed, dP☉/dS=Aη(1−ℓ)F☉g has units m²: it tells how many watts of power change for each additional W/m² of irradiance. Keep illustrative examples clearly separate, with an explicit option to populate their constants from the current scenario. Add educator answer guidance and test actual comprehension with learners.
6. **Validate the product with its audiences.** Use observed tasks with interested non-specialists, teachers and mission analysts. Measure successful explanations, comparison errors, task completion and confidence calibration, alongside keyboard/screen-reader checks. Automated passes cannot supply this evidence. Fix opaque comparison readability before adding more information density.

Items 1–2 are the strongest fit to the challenge's distinctive requirement: quick, understandable responses to changed dates/sites. Items 3–4 provide engineering credibility and require qualified evidence. Full structural crash fidelity, new spacecraft models or broader asset collections are lower priority for this brief than these decision and comprehension improvements.

## Primary references for proposed scientific extensions

- [NASA DSN complex locations](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/dsn-complexes/).
- [JPL DSN Telecommunications Link Design Handbook 810-005](https://deepspace.jpl.nasa.gov/dsndocs/810-005/downloads/): station interfaces and propagation/link modeling must use the relevant modules and revisions.
- [NAIF lunar/terrestrial frames tutorial](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/Tutorials/pdf/individual_docs/23_lunar-earth_pck-fk.pdf): the documented lunar frame/orientation question needs an explicit, independently validated resolution.

No recommendation in this report is represented as implemented. Human usability, assistive technology and qualified mission acceptance remain open.

Text transcripts normalize end-of-line whitespace only; captured values and wording are preserved. Screenshots and JSON reports retain their original bytes.
