# SolarReach refinement contracts

Locked14November2026 for the post-audit implementation. This supersedes the earlier scene/desktop/scientific-UX ownership table. Baseline: audience audit85de093, source release f6aa864, offline R7 d7d38c5a. Root is the merge sheriff and owns integration, runtime preview, generated assets, shared science contracts and release checks. Four Clevo Sol workers plus Root: maximum five active agents.

## Delivery sequence and gates

1. Correct selected-model explanations and unobstructed camera framing; Root corrects comparison readability.
2. Integrate synchronized replanning and audience workspaces. Engineering modules remain isolated until their independently verified calculation/provider contracts pass.
3. Exercise actual web and disconnected final-artifact workflows, including new functions, framing/model copy, preserved state, no baseline asset reload and full Follow/contact. No merge until final green evidence.
4. Publish private Git source/offline output. Teammate owns hosting. Human audience/screen-reader acceptance and unavailable qualified mission evidence remain explicit; never claim fabricated human or operational validation.

## Exclusive ownership

| Lane | Write ownership | Required result |
|---|---|---|
| refine-corrections | components/workbench/science-charts.tsx; components/workbench/scene.tsx; components/workbench/scene/runtime.ts; new lib/camera-framing.ts; new tests/refine-corrections.test.ts and components/workbench/scene/refine-framing.test.ts; docs/agent-log/refine-corrections.md | Guided/manual descriptions, graph gradients and frame labels match selected solver; camera frames actual vehicle bounds in unoccluded canvas with panels/HUD; preserve COM Follow and persistent renderer |
| refine-replanning | new components/replanning/**; new lib/replanning/**; new tests/replanning-workspace.test.ts; docs/agent-log/refine-replanning.md | Complete synchronized reference/candidate workspace, actual shared assessments, changed inputs/held assumptions, failure-window inspection, actual curves, spatial context, non-dominated tested options; bounded/cancellable calculations |
| refine-audience | new components/audience/**; new lib/audience/**; new tests/audience-workspaces.test.ts; docs/agent-log/refine-audience.md | Compact task/outcome strip and full teaching studio connecting actual selected scenario, controlled input, native equations/derivative units, plots, prediction/notebook, educator guidance and structured audience study capture |
| refine-engineering | new components/engineering/**; new lib/engineering-evidence/**; new tests/engineering-evidence.test.ts; new scripts/verify-engineering-evidence.mts; new public/data/engineering-evidence/**; docs/agent-log/refine-engineering.md | Bounded uncertainty/stability analysis and dated station geometry→mask→link→rate/allocation→delivered-data chain, independent source fixtures and explicit unknowns/provenance |
| Root | components/navigator.tsx; app/globals.css; shared lib/assessment.ts/planning-types.ts/scenario.ts/math registries; scripts/build-standalone.mjs; docs except lane logs; all generated final files | Integration, shared interfaces, offline assets, final browser/science gates, Git delivery |

No worker edits another lane, package/lock files, core assessment/physics/data sources or generated offline HTML. You are not alone: preserve others' changes and report needs across boundaries. New tests have unique names. No Simulator/Metro, live preview, shared browser or server. Workers may use their own headless test browser against Root-published URLs/artifacts after notification. No dependency installation, except engineering may prepare an isolated /tmp Python venv for independent reference calculations without changing the project.

## Frozen integration APIs

All components are named exports. Existing modes are `public | teach | plan`. Reuse Catalog, ScenarioState, EvidenceManifest and AssessmentResult from existing modules. Do not change the scenario schema/model identity or invent a second assessment authority. `evaluateScenario` is the sole source of mission verdicts; derived displays/uncertainty screens never silently approve a mission.

### Replanning

`components/replanning/workspace.tsx` exports `ReplanningWorkspace` with props:

- catalog: Catalog; manifest: EvidenceManifest; current: ScenarioState
- scenarios: readonly {id:string;name:string;state:ScenarioState}[]; referenceId?:string
- onOpen(state:ScenarioState):void
- onInspect(state:ScenarioState,index:number):void — index is absolute catalog index; Root opens the exact state, positions its playhead and horizon analysis without altering hardware.
- onSave(state:ScenarioState,name:string):void
- onCalendar?():void; onClose?():void

The workspace owns temporary reference/candidate selection and its synchronized cursor. Root mounts it as a fourth mode inside the existing comparison surface and provides a clear header entry. Align different dates by elapsed mission time with each exact UTC shown; offer absolute UTC overlap only when meaningful. Never silently pretend two different epochs are identical. Keep source resolution, unknown samples, case identity and conditional outcomes visible. Use measured curves only; never invent smooth uncertainty or unqualified terrain occluders.

### Audience

`components/audience/task-strip.tsx` exports `AudienceTaskStrip`:

- mode:'public'|'teach'|'plan'; catalog:Catalog; manifest:EvidenceManifest; state:ScenarioState; assessment:AssessmentResult; playhead:number; siteName:string
- onInspect():void; onReplan():void; onTeach():void

A compact dismissible header strip, not another floating map obstruction. Public gives a current/whole-stay distinction, simple failure/unknown interpretation and next action; technical modes expose actual counts/scope without hiding unassessed disciplines.

`components/audience/teaching-studio.tsx` exports `TeachingStudio`:

- catalog:Catalog; manifest:EvidenceManifest; state:ScenarioState
- onChange(state:ScenarioState):void; onCompare(baseline:ScenarioState,candidate:ScenarioState):void; onClose():void

Root mounts a full-size modal through a header button. Preserve the existing notebook storage/API by reuse or compatibility. Separate explicit illustrative constants from the current scenario; switching modes never changes physics inputs. Real controlled experiment plots, named axes/symbols/units, derivative interpretation and teacher guidance must be usable. Reuse native math helpers; send any registry additions to Root as a lane-owned equations-request.json rather than editing shared math files. Structured study tasks/results must identify human/agent/self-reported evidence and never invent participant data.

### Engineering

`components/engineering/evidence-workspace.tsx` exports `EngineeringEvidenceWorkspace`:

- catalog:Catalog; manifest:EvidenceManifest; state:ScenarioState; assessment:AssessmentResult
- onInspect(index:number):void; onClose?():void

Root mounts a full-size modal from Planner's header/task surface. New typed evidence envelopes are module-owned and export/import separately; do not mutate canonical ScenarioState. Bounded sample runs use evaluateScenario, hold requirements constant, preserve case identities and separate assumed ranges from qualified uncertainty. Absence of defensible uncertainty remains “unquantified,” not zero.

Station geometry must come from a traceable, independently checked reference or an explicit dated source adapter. No invented Earth rotation transform, station horizon, weather loss, booking, rate or source qualification. Provide conditional calculations only over full common coverage. Missing required station elevation, horizon, weather/band losses, allocation or rate prevents a delivered-data adequacy conclusion. Explicit user assumptions may be calculated but are labelled; observations never become forecasts. DSN locations are ground complexes, not satellites. On-demand bounded fetch/import and export must work with a fully disconnected mode; no silent polling.

## Validation and handoff

Every lane: focused meaningful regression tests, full `npm test`, `npm run typecheck -- --incremental false`, `npm run lint`, `git diff --check`. Commit explicit owned files conventionally. Never push or merge. Log exact green commands/counts and final commit(s), implementation limitations and integration requirements. Existing tests that fail must be reproduced on the untouched common baseline before blame is assigned. Do not weaken evidence gates or snapshot fixtures to make tests green.

Root compiles requested equations, independently verifies every delivery, builds isolated web/offline candidates and publishes immutable hashes/URLs for browser checks. Never rebuild the directory of the running preview. Approved warm ivory/olive glass design, dismissibility, native math, NASA texture quality, full-pole navigation and persistent 3D/Follow are interaction contracts.

## Independent verification phase

The four implementation lanes have returned their owned commits and are idle. Root authorizes three independent Clevo Sol verification lanes from the integrated checkpoint. No source ownership overlaps: `refine-workflow-qa` owns only `scripts/verify-refinement.mjs` and `docs/qa/refinement/workflows.md`; `refine-visual-qa` owns only `scripts/verify-refinement-framing.mjs` and `docs/qa/refinement/framing.md`. They exercise Root-published immutable candidates with isolated browsers and report defects; Root fixes application code. No fixture weakening, forced clicks, DOM/state injection, numerical-engine imports, copied app helpers or shared browsers/servers. Actual imported files through production UI and explicitly labelled transport-failure mocks are permitted. Reports distinguish exact artifact/source, actual network results, agent evidence and missing human acceptance. Root plus three QA agents stays under five. `refine-science-review` owns only `tests/refinement-scientific-review.test.ts` and `docs/qa/refinement/scientific-review.md`; its independent scientific unit tests may import model modules, unlike the two black-box browser lanes. It makes no product or fixture edits.

After the independent RED review, Root transferred exclusive ownership of `lib/engineering-evidence/horizons.ts`, `lib/engineering-evidence/communications.ts` and `lib/replanning/scan.ts` to the same scientific worker for S1–S3 corrections. Its 36 review tests and 719-worker/721-integrated tests passed before artifact publication. The original 19 adversarial test bodies remain unchanged. This bounded transfer ended on delivery; browser lanes still own only their scripts/reports.
