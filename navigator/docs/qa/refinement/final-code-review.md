# Independent final code review — refinement

14 November 2026. **No new blocking code defect found in the reviewed diff.** One nonblocking stale handoff status needs Root's documentation reconciliation. Fresh source checks pass. This review does not establish browser, human, accessibility or operational acceptance.

## Identity and scope

- Worktree: `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-final-review`; branch `codex/refine-final-review`.
- Exact reviewed source: `6c9227a03597c33169dd05433aec79adc7048a48`.
- Comparison: `git diff a45f5e5..6c9227a03597c33169dd05433aec79adc7048a48`, 27 files. Read `AGENTS.md`, `docs/CONTRACTS.md`, `docs/REFINEMENT-PLAN.md`, current handoff and correction/scientific-review records.
- Independent reviewer owns only this report. No application, tests, fixtures, other reports, dependencies, assets or offline HTML were edited. No child agents, build, server, browser, provider requests, pushes or merges were run.
- Applied the review skill's Standards and Spec axes directly; explicit no-child instructions supersede its parallel-agent procedure.

## Standards

No blocking standards violation found. The changes retain the canonical assessment authority, existing component primitives, warm palette, independent terrain/sphere results, explicit source identities and unknown states. No secrets, dependencies, generated assets or renderer-quality settings were added or changed in this diff. Read the existing five-finding slop-scan triage and inspected the touched error paths; no additional scan was run or installed.

**D1 — nonblocking documentation follow-up:** `docs/IN-FLIGHT.md:25`, `:28` and `:37` still describe S1–S3 correction/retest as pending. Commit `ae306b9` and the superseding resolution in `docs/qa/refinement/scientific-review.md` record their completion; this review independently passes the resulting tests. Root should update the current ownership/checklist status with the fix/check evidence when reconciling final delivery. Preserve the original RED history. Published to `/tmp/refine-final-review-findings.txt` during review. This does not reopen S1–S3 or imply a runtime blocker.

## Spec and implementation inspection

No new blocking mismatch found in the reviewed changes. Specific checks beyond the green suite:

| Area | Inspected behavior and proof | Remaining evidence owner |
| --- | --- | --- |
| Retained camera priority | `configureNavigation` captures starting mode/reset; site completion uses the latest settings. Vehicle, Follow, Earth and Sun remain requested even if selected before navigation. A newer mode/reset also survives. Completion cancels navigation and invalidates `lastReset`, so the next non-navigation frame applies the requested preset. Unchanged ordinary globe/orbit approaches still finish in local Orbit. No renderer remount or numerical-flight change was introduced. The two added priority tests are included in the full run. | Independent framing lane must replay the exact imported custom/polar roundtrip and late Lander/Follow requests against the final artifact. Helper tests alone are not runtime proof. |
| WorkspaceDialog lifecycle | Layout cleanup closes the native modal before host detachment and restores its still-connected opener. The `open=false` path closes the persistent Engineering dialog without unmounting its evidence workspace; Teaching unmounts on dismissal. Escape remains prevented and routed through the parent state callback. The effect does not rerun merely because children or callback identities change. | Exact artifact Escape/Close, child-control focus and reopen replay belongs to workflow QA. |
| Paint containment | The inspector has an opaque warm surface without backdrop blur. The actual `.inspector-scroll` has `contain:paint` and isolation; this is an applied selector, not an unused rule. `Info` explanations portal outside the inspector to `document.body`, so this boundary does not clip those inspector explanations. No WebGL hiding, text-shadow workaround or closed-disclosure experiment remains in the diff. | Actual glyph pixels, contrast, clipping, zoom and reflow require the visual lane's final rendered evidence. |
| Response-plot geometry | A single `left=150`, `right=715` mapping now drives paths, both point shapes, gridlines, axes and x labels; the x title uses their midpoint and the viewBox expands to 760. Y scaling, source values, unknown-gap handling and exact-value tables are unchanged. | Final axis/title boxes and narrow/200% rendering belong to visual QA. |
| Candidate controls and persistence | Candidate edits clone the captured state, retain stay length and pass the existing strict scenario parser. Invalid cadence/site/date changes throw before `onChange`; previous state remains intact. Reference selection and active mission are independent; opening/saving still uses the existing explicit callbacks. No storage implementation or schema changed. The initial curve is stored energy/reserve, with the other real curves selectable and horizons expandable. | Browser task/edit/import/export and actual persisted reopen evidence belongs to workflow QA. |
| Supplemental provenance and ranking | Raw UTC/apparent column semantics and declared request settings are checked separately before communication evaluation. Imported numeric columns still must match reparsed archived bytes. Ranking cohorts now bind effective required limits, reserve objective, contact cutoff, required radio threshold and required analytical inputs; unknown objectives remain unranked. These are the disclosed S1–S3 corrections, not an undisclosed canonical model change. | Existing independent scientific report supplies the source-reference history; no repeated provider call was needed here. |

Public guidance reuses the existing plain-language assessment cause and preserves terrain/sphere percentages. The curve disclosure and label changes do not alter the underlying values. No newly swallowed failure, stale asynchronous publication or silent unknown/source promotion was identified in the changed paths.

## Scientific history and unchanged authorities

Compared Git blob identities against `a45f5e5`: `lib/assessment.ts`, `lib/mission.ts`, `lib/planning-types.ts`, `lib/scenario.ts`, `lib/astro.ts`, `lib/flight.ts`, `lib/touchdown-physics.ts`, `pipeline/build_dataset.py`, catalog, evidence manifest, generated MathML and committed offline HTML are unchanged. No file under `public/` or `pipeline/`, nor either package manifest/lockfile, changes in this diff. `planning-4` remains the same canonical evaluator; the disclosed supplemental parser/cohort fixes do not alter its formulas, values or scenario identities.

Verified that the original 19 scientific test bodies from RED commit `0094023` remain an identical contiguous prefix of the current test bodies: SHA-256 `19ddee419c886dad3c6894ba31b3cdc9a4318562c925d73f91c73f4433258043`. The science report preserves its original five failures, followed by the explicit S1–S3 resolution. No assertion or fixture was weakened for this review. The fresh full suite includes all 36 scientific-review tests. No Horizons rerun is claimed: canonical ephemeris/geometry is unchanged, and repeated provider calls were outside this lane's instructions.

## Fresh verification

All commands below ran on the exact reviewed source with existing shared `node_modules`; all exited 0.

| Command | Result | Log |
| --- | --- | --- |
| `npm test` | **723/723 pass**, 0 failed, skipped, cancelled or todo | `/tmp/refine-final-review-npm-test.log` |
| `npm run typecheck -- --incremental false` | PASS | `/tmp/refine-final-review-typecheck.log` |
| `npm run lint` | PASS | `/tmp/refine-final-review-lint.log` |
| `npm run math:check` | PASS, **314 expressions**, registry SHA-256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f` | `/tmp/refine-final-review-math.log` |
| `git diff --check` | PASS | `/tmp/refine-final-review-diff.log` |
| `git diff --check a45f5e5..6c9227a03597c33169dd05433aec79adc7048a48` | PASS | command output empty |

Report-only staged whitespace and commit-scope checks are included in the final handoff. No new mirror tests were authored. No failing check was dismissed as pre-existing.

## Release boundary and genuine gaps

`docs/IN-FLIGHT.md` retains the substantive unresolved gates: original catalog time/EOP and propagated terrain/frame/event uncertainty; fine footprint, vehicle/controller/gear/soil and trajectory evidence; real station masks, antenna/weather/service/allocation assumptions; subsystem and structural qualification; defensible uncertainty bounds; actual audience studies, screen-reader and device testing; hosted provider/CORS behavior; and target-device performance. These remain real evidence requirements, not reasons to invent a new code blocker. Automated or agent evidence does not close them.

The exact final web/offline artifact replay, rendered framing/contrast/native zoom, source/artifact identities, build and delivery gates remain with Root and the independent browser lanes. This source review neither relabels older candidate evidence as final nor closes those gates. Open blocking **code** findings from this lane: **0**; nonblocking documentation follow-up: **D1**.
