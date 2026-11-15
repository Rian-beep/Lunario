# Replanning refinement worker

Source: `codex/refine-replanning`, 14 November 2026. Owned paths: new `components/replanning/**`, new `lib/replanning/**`, `tests/replanning-workspace.test.ts`, this log.

## Integration

Root mounts named `ReplanningWorkspace` from `components/replanning/workspace.tsx` using the frozen `docs/CONTRACTS.md` props, as Replan in the existing comparison sheet and a header entry. `onInspect` receives the exact selected state and absolute catalog index. Root owns runtime/web/offline visual verification and all builds/generated assets. No shared contract changes requested.

## Implementation decisions

- Keep the approved warm ivory/olive design and inherited typefaces. Solid reference / dashed candidate curves and filled Sun / ring Earth preserve shape distinctions. Responsive stacked case cards, explicit axes/units, visible focus, keyboard cursor and source readouts are implemented; rendered/assistive-technology verification remains with Root.
- Use `evaluateScenario` for all verdicts and `resolveAnalysisContext` (which calls `buildSeries`) for independently resolved instrument horizons. No science/model/schema changes.
- Explicit current/saved reference and candidate choices capture independent snapshots. A reducer prevents later candidate edits, main-view inspection or saved-list changes from moving the reference. Reference ID supplies the initial capture; choosing Current scenario explicitly captures subsequent main-view inputs. Temporary controlled alternatives preserve equipment, requirements, operations and evidence bindings. Changed report bindings remain stale under the shared evaluator.
- Candidate-minus-reference reserve, unmet-demand, contact (percentage points) and observed-blackout deltas preserve nulls, with explicit warnings when requirements differ.
- Align by elapsed mission time by default; exact separate UTCs, unsupported shorter-stay cursor states and meaningful UTC overlap are explicit. No invented interpolation or terrain occluder.
- Alternative runs are explicit, bounded and cooperative, cancellable between cases. Pareto objectives are reserve margin (maximize), geometric blackout (minimize), and absolute schedule shift from the selected scan base (minimize). Incomplete or incomparable evidence remains unranked; conditional results keep their status.

## Validation

- `npx tsx --test tests/replanning-workspace.test.ts`: **28/28 passed**, zero failed/skipped/cancelled. The final full-suite run also executed all 28 focused tests after the final plot label changes.
- `npm test`: **617/617 passed**, zero failed/skipped/cancelled (7.339 s reported test duration).
- `npm run typecheck -- --incremental false`: PASS, exit 0.
- `npm run lint`: PASS, exit 0, no reported warnings.
- `git diff --check` and staged `git diff --cached --check`: PASS.
- Coverage includes real decoded catalog/audit cases, shared verdict reproduction, independent subsystem heights, stale external reports, full input differences including configured flight fields, frozen selection transitions, elapsed/UTC/no-overlap/unequal-stay cursor behavior, exact failure brackets, actual subsegment power/storage/contact arrays, initial/boundary storage, unknown gaps, schedule boundaries, logarithmic readout lookup, budget/deduplication/rejection, cooperative cancellation, conditional/unknown/cohort/tie/dominance handling, and SSR workspace/axes/tooltips/next actions.
- `slop-scan` is unavailable on PATH; existing `docs/qa/planning/slop-scan.md` was read. No tool installation. Manual inspection found no empty catches or swallowed failures in owned code.
- No ephemeris/geometry implementation changed, so Horizons revalidation was not triggered.

## Exports and integration behavior

Only public UI entry required by Root: `ReplanningWorkspace` plus exported `ReplanningWorkspaceProps`, both from `components/replanning/workspace.tsx`. Props match the frozen contract exactly. Mount inside the existing comparison sheet as Replan, with Root's header entry. The workspace provides its own opaque warm paper surface and flows vertically; the sheet must allow scrolling. It does not create an app-level overlay or modify shared styles.

- `onOpen` receives exact captured candidate inputs.
- `onInspect` receives exact captured case inputs and an **absolute catalog index**. The internal first-violation button synchronizes both mission cursors, switches to elapsed alignment if needed, and opens the corresponding embedded horizon. Separate main-view actions call Root's callback.
- `onSave` receives exact captured inputs and the entered trimmed name. Root owns actual persistence and saved-list updates.
- Optional Calendar and Close actions call the supplied callbacks.
- Existing `GlobalMap` and `HorizonGraph` provide spatial/horizon context. Replanning curves reuse `resourcePoints`, `numericDomain`, `linePath`, and `formatChartValue`; forcing is never recomputed by a second physics path.

## Limits / remaining Root verification

No server, shared browser, build, generated offline HTML, dependency/package change, push or merge was run. The prescribed Root-only preview was unavailable to this worker. Node SSR checks semantics/content only; actual browser visuals, 200% reflow, contrast, keyboard traversal, real screen-reader behavior, Root callback wiring, preserved scene assets and disconnected final-artifact operation remain for Root. No user/creative/operational acceptance is claimed.

Each synchronous `evaluateScenario` finishes before cancellation is observed; the scanner yields/checks cancellation between cases. Each run is at most 48 cases and 150,000 forcing intervals, with no render-time scan. Plans exceeding the budget are explicitly rejected rather than silently truncated. Cancelled runs retain only completed cases. Unmount or candidate replacement aborts and discards stale callbacks.

Pareto ranking is limited to the tested grid and matching requirement/evidence cohorts. Unknown numeric/required evidence prevents ranking; conditional model evidence never becomes a pass. Outages are observed within each stay, with boundary-censored values prefixed ≥. No probability/stability bound, named terrain occluder, station allocation or landing approval is inferred.

Delivery is one conventional commit containing exactly the owned files below; its immutable hash is reported in the worker's final handoff.

```text
components/replanning/alternatives.tsx
components/replanning/case-panel.tsx
components/replanning/curves.tsx
components/replanning/inputs.tsx
components/replanning/spatial-context.tsx
components/replanning/workspace.module.css
components/replanning/workspace.tsx
lib/replanning/curves.ts
lib/replanning/model.ts
lib/replanning/scan.ts
lib/replanning/selection.ts
tests/replanning-workspace.test.ts
docs/agent-log/refine-replanning.md
```
