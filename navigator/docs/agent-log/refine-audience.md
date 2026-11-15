# refine-audience

14 November 2026. Worktree `refine-audience`, branch `codex/refine-audience`.

## Integration request

Root must mount `AudienceTaskStrip` in the wrapping header and `TeachingStudio` as a full-size modal with the frozen props from `docs/CONTRACTS.md`. Keep the studio mounted while temporarily hidden (or let its compatible persisted draft restore on reopening). Root owns dialog focus trapping/return, Escape dismissal, preview/browser/reflow/200% zoom/screen-reader checks and generated offline integration. No shared files or math registry changes are required: existing NativeMath plus lane-owned static native MathML are used. No worker preview/build/server is authorized.

## Implementation decisions

- Preserve approved warm ivory/olive design. A compact dismissible strip uses actual assessment timelines, constraint rows and sampled event brackets; no second verdict authority.
- Full-width teaching surface uses captured immutable selected scenarios, existing six controlled experiments, common notebook storage/API, authority-recomputed plots and a separately labelled irradiance relation laboratory.
- Structured audience evidence starts empty, distinguishes human/agent/self-reported, and exports local-only records with objective answer checks and exact scenario/model identity. No participant count is invented.

## Validation

Final source checks on 14 November 2026:

- `npx tsx --test tests/audience-workspaces.test.ts tests/teaching.test.ts tests/audience-context.test.ts`: **25/25 pass**, zero failed/skipped; **15 new lane regressions**. Covers actual assessment control/response identity, current fixed orientation/efficiency/loss/deployment, derivative value/units/zero irradiance/unknowns, exact sampled UTC event bounds, actual requirement counts, unchanged physics, legacy draft/records/reset retention, corrupt/quota storage, participant evidence types, objective scoring and real component/native MathML SSR. SSR uses isolated in-memory esbuild compilation, no app build/output/server/browser.
- `npm test`: **604/604 pass**, zero failed/skipped (6.288 seconds in final run).
- `npm run typecheck -- --incremental false`: **PASS**.
- `npm run lint`: **PASS**, repository-wide.
- `git diff --check` and explicit staged `git diff --cached --check`: **PASS** before commit.

Delivery is a conventional `feat(audience)` commit containing this log and the exact owned sources/tests. Its immutable hash is returned in the worker handoff; no source files require further worker changes.

## Frozen exports and wiring details

- `components/audience/task-strip.tsx`: named `AudienceTaskStrip`, exact frozen contract props. `playhead` is an **absolute catalog sample index**, including fractional playback positions. Mount in the header; it is not a map overlay. Dismissal leaves a restore button. Current visibility uses the array/antenna assessment timelines, not display observer height. Whole-stay percentages count equal sampled intervals; any unknown makes that percentage unavailable. Timed failures compete with next sun/contact transitions by actual UTC bound; no precise sub-hour event claim is made.
- `components/audience/teaching-studio.tsx`: named `TeachingStudio`, exact frozen contract props. Modal wrapper should give the studio its full width and a single natural vertical scrolling surface; do not nest it in Inspector. Root supplies focus trap, Escape and focus return via `onClose`. `onChange` applies only an explicitly requested candidate; `onCompare` receives cloned exact baseline/candidate states. No audience/mode switch mutates physics.
- Replace/hide the old mounted `TeachingWorkbench` while this studio owns the notebook, so two autosaving copies do not write the same key concurrently. Shared existing keys are `solarreach-teaching-v1` and `solarreach-teaching-v1-draft`; existing record schema and capture/record/worksheet APIs are reused. Old six-experiment records/drafts restore; control reset preserves records. Malformed/stale storage is preserved with an export action rather than overwritten. Quota/access failures are surfaced. Source/catalog changes do not overwrite a draft before restoration succeeds.
- Existing `NativeMath` supplies six experiment relations and symbol/unit keys. Two closed, authored MathML relations in lane components supply finite response rates and partial irradiance derivatives; no runtime TeX, network font, shared registry edit or `equations-request.json` is needed.
- Each controlled input curve uses at most five whole-stay trials plus the exact candidate, all through `evaluateScenario`. Discrete heights/categories are points only. Finite response rates have explicit response/input units and are never promoted to smooth physical height derivatives. Battery plots show up to96 real interval-end samples around one shared selected interval, separately for terrain and sphere; the table uses the complete stay. Initial energy and operation-boundary limitations are explicit.
- Irradiance lab starts with explicitly illustrative 4m²/0.30/0.15/full disk/normal incidence constants (1020W at1000W/m²). “Populate from captured scenario” explicitly selects the captured baseline, never silently changes it. Selected interval power is recomputed at each irradiance trial; its derivative is computed by the same evaluator at unit irradiance, with current fixed/tracking geometry and deployed interval fraction. Native interval-mean equation includes that deployment fraction. Derivative units are m² = W/(W/m²), not W/h. Unknowns remain unknown; a zero current irradiance does not cause division by zero. The existing synthetic outage-ordering lesson is preserved as an explicitly separate illustrative extension.
- `StudyCapture` is available inside the studio for all three audience task sets. It begins with zero records, distinguishes observed human/agent/self-reported sessions, snapshots scenario/dataset/model and objective answer keys, separates comprehension score from observed task completion, requires written evidence for completed tasks, and records before/after confidence and optional observed duration. Data stay local; no request, analytics, participant seed or invented completion is generated. JSON export and per-record explicit deletion are available. Recorder-supplied human labels are not independently verified. Saved study records restore from `solarreach-audience-study-v1`; malformed evidence cannot silently replace the stored original.

## Limits and remaining integrator checks

No shared file, dependency, dataset, ephemeris, geometry, assessment contract, package/lock file or offline artifact changed. No server, browser session, production build, push or merge was run. Root retains real browser interaction, web/disconnected workflow checks, final wrapping/reflow at800px/375px, contrast/200% zoom, font/native-math appearance and screen-reader validation. The lane's responsive CSS, SVG descriptions, exact-value tables, native fields and focus styles are implementation evidence, not human accessibility acceptance. Graphs keep readable intrinsic widths and scroll locally on narrow screens; the studio stacks below1200px. Computation is bounded by trial count but each canonical full-stay assessment is synchronous; no universal latency claim is made. Unsaved study form answers are transient; saved results and notebook drafts persist. Human audience studies remain unperformed.

`slop-scan` is not installed on PATH or in the shared local binaries; historical `docs/qa/planning/slop-scan.md` was inspected, not claimed as a fresh scan. New error paths report their cause; no empty catches, suppressed errors or weakened fixtures were introduced. Horizons was not rerun because no ephemeris or geometry code changed.
