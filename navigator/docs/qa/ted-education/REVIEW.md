# Ted lunar ice education integration review

Reviewed 15 November 2026 on Clevo, branch `codex/ted-education-reviewed`.
Exact authored base: Rian-beep/Lunario PR16 HEAD `58dd4e26fedc9f5abccb83c5e957fc34c2b502fc`.
Review comparison: `b250770..58dd4e2`; all eight original Ted commits retained unchanged.
Code/test fixes: `5b56787742bfdbd856042dd48216e898958881d0`.

## Standards review

- Canonical assessment preserved: worksheets call `evaluateScenario`; resource cards only describe its supplied `mission` and `sphereMission`. No ice numerical model, map ice catalogue, terrain solver, coordinates, asset, ephemeris, model identity or mission constraint changed.
- Fixed mutable resource source references: captured questions and source objects are deep copies. Options are copied too. Later source edits, controls and Navigator edits cannot alter a captured export; replacement requires explicit capture.
- Fixed nonfinite display values: `NaN` and infinities display as unavailable, with known zero still displaying as zero.
- Worksheet title now uses the existing Input primitive. Existing theme variables, focus styling, wrapping, horizontal table scrolling and local native MathML remain. No dependencies added.
- No changes to integrator-owned Navigator, globals, root/workflow files or generated standalone artifact after the exact PR16 base. The bundle necessarily retains Ted's original changes to those files; they were reviewed read-only.

## Requirements review

- Preserved Ted's three lessons, source links, contextual site questions, Learn entry, Teaching Studio disclosure and saved-scenario comparison.
- Added an always-visible educational boundary to cards/comparisons and resource worksheet givens: shadow, cold ground and hydrogen signals do not confirm ice; local ice and yield are not measured here; no landing/mining approval follows.
- Tightened the existing LCROSS wording to the observed excavated material at Cabeus, explicitly excluding all other shadowed regions and the selected site. The 5.6 ± 2.9% estimate is explanatory text only, never a selected-site numerical input or global abundance.
- Identified LUWEX as a thermal-vacuum experiment using icy soil simulants, not local lunar extraction performance. Preserved the source-specific capture bottleneck lesson.
- Added useful teacher marking criteria: distinguish preservation clues from detections; sample depth/concentration/form at multiple locations; assess a route rather than distance alone; distinguish stationary Earth contact from route communication; do not turn generated kWh into water yield or available extraction energy after existing loads.
- Added guided/advanced worksheet controls. Both student and teacher files receive the selected prompt level. Student hints can be omitted; teacher keys always retain hints and answers. Title/topics/options take effect on explicit capture, while question/hint edits affect the current captured files. Legacy version-1 sheets without options use guided prompts/hints defaults when exported.
- Resource cards remain in normal document flow inside the existing Learn dialog, Teaching Studio disclosure and collapsed comparison disclosure. They add no fixed/absolute map overlay or renderer. Public technical details are collapsed, Educator adds discussion questions, Planner expands technical/assessment metadata. Rendered map obstruction, responsive geometry and print pagination remain integrator checks: no browser or server was used here.

## Source meaning audit

Primary sources opened on 15 November 2026; no remote data feed is needed to use the lesson text or print files. Following a research link requires a connection.

| Source | Verified support and retained boundary |
| --- | --- |
| [Colaprete et al., 2010](https://doi.org/10.1126/science.1186986), verified through the [author institution's abstract](https://experts.arizona.edu/en/publications/detection-of-water-in-the-lcross-ejecta-plume/) | The estimate concerns observable material excavated at the Cabeus impact. It does not supply a concentration for another pin. DOI retrieval itself failed in the browser tool; the institutional record supplies the matching abstract and DOI. |
| [NASA SMD-LUN-102, revision A, 2025](https://ntrs.nasa.gov/api/citations/20250006445/downloads/SMD-LUN-102_RevA_authors.pdf), section 4.1 | Distinguishes hydrogen/volatile observations, patchy surface detections and uncertain physical form. Supports teaching the difference between an indicator and a local inventory; this lane imports no abundance extrapolation. Added as a source for the explicit proxy boundary. |
| [NASA VIPER](https://science.nasa.gov/mission/viper/) | Science goals address distribution, state and composition. Used for prospecting questions only; no mission schedule, success or deployment claim. |
| [Kiewiet et al., LUWEX, 2026](https://elib.dlr.de/215814/), full paper sections 4–6 | Capture capacity constrained recovered water in the tested configuration. This supports a bottleneck investigation, not a universal conversion factor or site output forecast. |
| [NASA PDS Athena context record](https://pds.nasa.gov/ds-view/pds/viewContext.jsp?identifier=urn:nasa:pds:context:instrument_host:spacecraft.clps_to_prime1_athena&version=1.0) | Records that the lander's orientation prevented TRIDENT from reaching the surface. Card labels this a historical example; it is neither a new drill measurement nor a local success claim. Custom points do not inherit this attribution. |
| [LOLA PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) | Supplies topography and derived terrain products, not local ice confirmation, rover-scale qualification or landing approval. |
| [NASA lunar south pole environment](https://www.nasa.gov/reference/moonbase-environment/) | Supports questions about lighting, rugged terrain and operations. No general mission-readiness verdict is imported. |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Existing celestial geometry provenance only; neither a thermal/extraction model nor an ice detector. |

## Verification

Run from `navigator/`; all gates passed before the code/test commit.

| Check | Fresh result | Log |
| --- | --- | --- |
| `npm test` | 822 passed; 0 failed, skipped or cancelled | `/tmp/lunario-ted-education-npm-test.log` |
| `npx tsx --test tests/ted-education/*.test.ts` | 24 passed: 11 resource/public-copy cases, 11 worksheet/export cases, 2 real component callback cases; 0 failed/skipped/cancelled | `/tmp/lunario-ted-education-focused.log` |
| `npm run typecheck -- --incremental false` | Passed | `/tmp/lunario-ted-education-typecheck.log` |
| `npm run lint` | Passed | `/tmp/lunario-ted-education-lint.log` |
| `npm run math:check` | 314 native MathML expressions verified | `/tmp/lunario-ted-education-math.log` |
| `git diff --check` and staged check | Passed | Git output |
| Cached `slop-scan` 0.3.0 | Completed; 9 findings outside changed files, including directory diagnostics; no changed-file finding | `/tmp/lunario-ted-education-slop-scan.json` |

Total separately executed test cases: 846. The focused suite checks actual canonical numbers, null/zero boundaries, source isolation, per-audience server-rendered markup, teacher/student separation, escaping, native subscripts and option-driven HTML. Its in-memory callback harness invokes the actual MaterialBuilder callbacks with deterministic hook state and intercepted downloads; it does not mount a browser DOM. Existing tests still run independently.

An initial test-only ES2018 regular-expression flag failed this project's ES2017 TypeScript target; corrected to an equivalent compatible pattern and reran successfully. No failing check is labelled pre-existing.

Horizons verification was not rerun: no ephemeris parsing or geometry changed. No server, browser, Simulator, Metro, dependency install, push, production/offline rebuild, or subagent work occurred. Actual screen-reader use, viewport/reflow/focus and native print/PDF acceptance remain unverified in this worker lane. Agent verification is not user acceptance.

## Parent integration and read-only shared-file risks

Parent inspected: `/home/luke/Storage/lunario-map-20261115`, `codex/stream-base`, HEAD `06904f4c992d4dff44a7f5290bec8c4df3e9da0c`; parent working tree was clean.

`git merge-tree --write-tree --messages 06904f4c992d4dff44a7f5290bec8c4df3e9da0c 5b56787742bfdbd856042dd48216e898958881d0` returned exit 0, tree `bb4e645a269d4be7287c2d233bdbc934ec21fe57`. **No textual parent merge conflicts.** Git auto-merged `navigator/components/navigator.tsx`; the merged diff against the parent is precisely the one LearningDialog call adding `scenario={{catalog,state,assessment:planning.result}}` (parent line 827). The parent's lazy startup, ice catalogue and renderer work remain in the merged tree. No live worktree merge was performed.

A separate dry merge against `codex/map-ui` at `f7c4a60697bbdaa3c85e6df1924103a56310f485` also returned exit 0, tree `00738263f315a0b8bd7657da3bb02d41d5762508`, with only the same Navigator auto-merge message. Log: `/tmp/lunario-ted-education-map-ui-merge.txt`. These results describe those exact parent refs, not later concurrent commits.

Integrator actions and cautions:

1. Merge the bundle history; do not replace the parent's entire Navigator with the older PR copy. Preserve the existing `learnOpen && !focusMode` gate and canonical synchronous `planning.result` binding. The contextual prop is needed for the ice topic; absent props intentionally leave the original reference operational.
2. Ted's `app/globals.css` append (49 lines, starting PR16 line 3060) supplies the active `.resource-evidence*` classes. The similarly named CSS module is unused. Keep the global rules for this integration; deleting them because the module exists leaves cards unstyled. A future scoped-style migration must also account for direct Node SSR tests importing PhysicsReference and Comparison. This lane did not move CSS imports back into those modules.
3. `.github/workflows/verify-navigator.yml` runs the top-level npm test glob, which does **not** execute `tests/ted-education/*.test.ts`. Integrator must add that explicit focused command to CI/the owned test runner. The same omission affects the separate map-ice nested tests; do not interpret 822 as all lane tests. Workflow has read-only contents permission, no stored checkout credentials and builds/uploads the standalone. Current official repositories confirm the three `actions/*@v7` references exist; no unsupported-version failure is asserted. Standalone generation/upload alone does not prove disconnected interaction or visual quality.
4. Regenerate the offline HTML after integration, verify theme rules and native MathML in both hosted and disconnected builds, check Learn/Teaching Studio/Compare close and reflow behavior, and print both hint settings and both learning levels. This worker did not generate or edit the shared offline artifact.
5. Keep educational evidence separate from `lib/ice`, the map source catalogue and Cesium. This patch reads no ice-layer coverage or map colour as a measured deposit, and creates no second mission assessment path.

Bundle delivery: `/tmp/lunario-ted-education.bundle`, built as `git bundle create /tmp/lunario-ted-education.bundle HEAD ^b250770`. It contains Ted's eight original commits plus review fixes/documentation; prerequisite `b250770` is excluded. Final HEAD, bundle verification and SHA-256 are recorded in `/tmp/lunario-ted-education-result.txt`.
