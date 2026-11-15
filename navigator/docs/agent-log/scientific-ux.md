# Scientific UX worker — 14 November 2026

Workspace: `codex/scientific-ux`. Scope restricted to chart, glossary, info component, their tests and this log. Design/CONTRACTS read; instruction parity passed. No browser, server, installs, builds or equation/data changes. Shared memory retrieval tool was approval-blocked; vault fallback search found the older unrelated solar-sales SolarReach project, not a lunar hub. This scoped log is the durable record for parent to incorporate; no other-project writes were authorized.

## Decisions

- Visible horizontal/vertical axis titles retain units and local reference/time origin in all three audiences. UTC sample dates are distinct from elapsed flight seconds. Flight radial altitude is explicitly **not terrain clearance**.
- Native LOLA mask vertices retain missing samples; isolated known samples are visible as points; no one-degree resampling or data decimation is used for hover claims. Sun is filled amber and Earth a blue ring with distinct strokes. Horizon direction readouts identify independent hourly samples and do not imply simultaneity or an unavailable epoch.
- Every plot supports actual-sample keyboard traversal (arrows, Shift ×10, Home/End), previous/next buttons and persistent text values. Hover and tap use actual points, including unknowns. Readouts are in document flow, outside the SVG, so they do not cover axes or clip in drawers.
- Power is plotted as hourly interval segments. Battery points use **interval-end** timestamps, matching `evaluateMission`; they do not fabricate the unavailable initial state or recover after an unknown. Unknown means a gap, never zero. Reserve and 0° sphere lines are explicitly constant references.
- Help portal uses nonmodal dialog semantics because its long explanation can receive keyboard focus for scrolling. It measures rendered content, repositions on drawer/window/visual-viewport scroll and resize, allows ↓ from the help button to focus/scroll the explanation (scroll keys cannot trigger playback), supports hover, focus, tap-to-pin, outside dismissal and Escape/Tab return. The first focus/tap does not toggle itself closed.
- Glossary audited against `astro`, `mission`, `flight`: fixed flux; centre-direction incidence times visible-disk fraction; initial wet mass/radius/gravity; antenna mask; aggregate unknowns and visibility-score denominator; mission-specific reserve/slope/speed/link margin. No universal safe thresholds or certification claims.

## Integration requests (root-owned markup)

1. Pass `sphereResult={sphere}` to `<ResourceGraphs>` in `components/navigator.tsx`. New prop is optional and backward compatible; without it charts explicitly say sphere curves were not supplied and direct readers to paired metrics. With it, terrain solid and sphere dashed curves use the already computed results.
2. Radio result markup in `components/workbench/panels.tsx` combines free-space loss and margin into one string with no adjacent help. Split into labelled spans with `<Info label="Free-space loss" />` and `<Info label="Link margin" />`. Glossary entries are implemented.
3. Initial thrust/weight currently uses hard-coded mean-radius gravity in `panels.tsx`, not initial radius/site gravity. Parent should align display with the actual initial flight radius and use `<Info label="Initial thrust / weight" />`; ensure it is labelled approximate if retained. Formula is F/[m₀ μ/(site radius + initial altitude)²]. Worker did not edit equations.
4. Place `<Info label="Ideal engine Δv" />` and `<Info label="Maximum altitude" />` next to the unadorned flight results. Entries explain consumed-propellant Δv and why altitude is not orbit success.
5. Root telemetry label should say **Radial altitude**, rather than generic Altitude. Existing `Info label="Height above surface (km)"` remains supported, with corrected reference-sphere semantics.
6. Add help next to custom Latitude/Longitude fields and Stay/date labels where appropriate: entries `Latitude`, `Longitude`, `Stay length`, `Time (UTC)` exist. Every existing NumberField/Metric and dynamic comparison/radio input label is covered by tests.
7. The source slope uses central differences at ±40 m (80 m stencil), not a 40 m difference baseline; glossary now states this accurately. Parent should clarify the root label “Slope / 40 m” as “Slope (40 m DEM)” with the stencil detail in help.

## CSS coordination (desktop-quality owns global styles)

- Existing `.science-figure`, `.chart-axis-heading`, `.chart-x-label`, `.chart-tick`, `.chart-legend`, `.chart-note`, `.variable-tooltip`, `.info-button` retained. Full axis wording is deliberately visible and must wrap, not truncate. Ensure body-size axes/legends/notes and a clear focus outline; 10–11px rules were too small. At narrow widths, `.chart-axis-heading span` should wrap naturally.
- New `.chart-sample-controls`: wrapping row of shadcn buttons, minimum readable/tappable sizing, spacing above readout.
- New `.chart-sample-readout`: static text block (NOT absolute `.chart-readout`), wrapping line/word content; list of named series with explicit values, units, and each sample coordinate/interval. Include compact but readable list spacing and tabular figures. It must remain selectable and flow in the drawer.
- `.variable-tooltip` remains fixed in a body portal. Runtime sets width/position/max-height based on actual viewport and rendered content; allow keyboard focus outline and overflow-y scrolling. `.info-button` needs a usable focus/tap target. No CSS changes made by this worker.

## Verification

Dependencies ready marker present before validation. Final `npm run typecheck` passed. Exact `npm test` command is sandbox-blocked by `tsx` IPC socket `listen EPERM`. Unbounded fallback test runner and npm lint also encountered process aborts; reduced Node/UV/Go pool sizes and serial tests resolved those aborts. Full Node-loader serial suite passed (7 test files); direct Node-loader execution of the same test modules exposed all individual assertions: **44 tests passed, zero failures** (18 chart/glossary checks). Lint exits zero with 8 warnings in root-owned `components/navigator.tsx`; the same 8 warnings reproduced on isolated base revision `1c2ae8d` in `/tmp/solarreach-science-base.y1KryW`. No owned-file lint warnings. Actual static HTML from all four chart exports is checked for visible axis wording, units, adjacent help and keyboard/text controls in Public/Educator/Planner, using the committed catalogue. The SSR test temporarily supplies/restores the classic JSX React global required by tsx with the repository’s `jsx: preserve`; no project configuration is changed.

Parent owns visual/interaction QA, contrast/200% zoom, narrow layouts, tooltip edge/scroll/touch and screen-reader assessment. No accessibility conformance or creative acceptance is claimed.

Final alternative test command (avoids the sandbox-blocked tsx CLI IPC socket; uses existing dependencies only):

```bash
UV_THREADPOOL_SIZE=1 NODE_OPTIONS=--v8-pool-size=1 GOMAXPROCS=1 node --import tsx --input-type=module -e 'import { readdirSync } from "node:fs"; for (const file of readdirSync("./tests").filter((f) => f.endsWith(".test.ts"))) await import(`./tests/${file}`);'
```

Formatting used an already cached Prettier binary, no package installation or manifest/lock change. Global-vault memory was not written because the worker was explicitly limited to owned files and no other-project writes; decisions and required integration are saved in this log for parent handoff.


## Commit delivery

Staging in this worktree is blocked by the filesystem sandbox: `git add` cannot create `/home/luke/Storage/solarreach-navigator-20261114/.git/worktrees/scientific-ux/index.lock` because that git directory is read-only. No index or branch update occurred. A genuine conventional commit is prepared in a temporary bare repository under `/tmp`, with base `1c2ae8d` as parent and ONLY the seven owned files staged. A prerequisite bundle allows parent to fetch/cherry-pick the commit without including the concurrently modified terrain or imagery files. Bundle path and commit hash are returned in the final worker handoff. The worktree branch itself remains unchanged; no push occurred.
