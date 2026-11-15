# C12 follow-up — zero owned source-review blockers

14 November 2026. Reviewed and tested the frozen C12 source **`0ef2526a894f35bf9ee05773f646f817bf4b958f`**. **Standards: 0 open; Spec: 0 open. R1 is closed; S1 and R2 remain closed.** The actual student first articles now distinguish available generation evidence with an undefined normalized factor from unavailable forcing. The actual-NASA contact regression reproduces the original failure and passes C12's unchanged 5 cm clearance gate. This is source/numerical verification, not final global release signoff, browser visual acceptance, human acceptance or mission qualification.

## Pinned C12 identity and scope

- Actual source checkout: `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c12-final-check`; HEAD `0ef2526a894f35bf9ee05773f646f817bf4b958f`, tree `2cd9740310622dd3d8dfda38fe3ad60369ff7eea`; clean before and after checks. Product tests ran here, not in the historical report checkout.
- Delta: `git diff a31ca057...0ef2526`, two commits, seven files. Binary diff SHA-256 `f5168ef961dfbf1c0691538c5bbd8a8b6ebce90e3806c0a2313d5b3c220b26f9`. Source bundle `/tmp/lunar-window-c12-source.bundle` verifies, resolves HEAD to C12 and requires `a31ca057`; SHA-256 `be0af876206b8ebdb55c7407281217bc670ad084406e0c7b02adb2a331cf5823`.
- Frozen artifact `/tmp/lunar-window-c12.html`: SHA-256 **`5caf68a6d4d6ad66401545afd3a773adf8ce0213e4fd3dccc7fe703a6b5484bf`**. A read-only GET of the existing `http://127.0.0.1:43325/` returns that exact hash. This is byte identity, not a browser run.
- Marker `/tmp/solarreach-refinement-c12-ready.json`: SHA-256 `6d88d2c53a583193accbfd9a9c011c71f160a4548f17742edfedbf785c98a46f`; instructions `/tmp/refinement-c12-qa-instructions.txt`: `e279460638b452d9ecc399272f3da979a147bfdf16875b0cb88d521c12ff6185`. Both were present on first inspection. Marker, instructions, artifact and bundle hashes remained unchanged.
- Read frozen instructions, project instructions, Models, ADRs 0005/0006, workflow adaptation and canonical memory. Instruction parity passed. The review skill's independent read-only Standards and Spec agents found no new blocker; the primary reviewer ran the probes/checks below.
- Exclusive repository write: **this report only**, branch `codex/refine-dark-code-review`, starting at `4e50010`. No app/test/configuration/generated/dependency edits, app server, shared browser, Simulator, Metro, push or merge. No builds were run by this lane; Root's web/offline build results remain attributed handoff evidence. Under the exclusive-write restriction this report is the durable milestone record; no shared-memory write is claimed.

## R1 closed — actual student articles are independently solvable

The C12 change in `lib/education-materials/index.ts:18` adds frozen interval-generation availability context derived from the existing canonical response. It does not use null normalized factor as a proxy for absent forcing. At zero area, zero efficiency or complete loss, available evidence permits zero response despite an undefined normalized factor. Missing forcing explicitly prohibits inferring even zero. Both student and teacher HTML render this context, including the explicit zero-area explanation; the historical teacher explanation omission is therefore resolved in the complete article.

The independent export probe builds the actual C12 modules and writes actual student, solar-only and teacher HTML for **14 fixtures**: ordinary, partial deployment, undeployed, zero battery, no required reserve/unmet-demand failure, unknown terrain, zero area, unknown plus zero area, zero efficiency, complete loss, zero irradiance, unknown plus zero efficiency, unknown plus complete loss, and unknown plus undeployed. A separate HTML parser computes answers using only the printed student givens/context before comparing with the authority. It also reconstructs reserve floor/margin, terrain-minus-sphere energy and both contact percentages, preserving unknowns. Evidence-question context contains every actual requirement/state/explanation and source coverage/version/cadence/resolution/note, including the no-recorded-failure case.

- Ordinary printed givens yield **0.707580120 m²**, versus authority **0.7075802941347838 m²**, and **70.758012 W** for +100 W/m²; the difference is six-decimal export rounding.
- Half-interval deployment yields **0.353790060 m²**, versus **0.3537901470673919 m²**. Undeployed gives known zero. Zero irradiance retains a positive derivative.
- Known zero hardware gives zero from the printed hardware and explicit available-evidence rule. The matching unknown-forcing cases remain unavailable. The actual known-zero and unknown-zero **first question articles differ**; neither relies on coordinates or other questions to disclose forcing availability.
- All tested reserve articles have seven definition terms; the four legend symbols and two symbolic given labels each contain native `<math>` and `<msub>`. No rejected literal reserve/energy underscore identifiers appear. This closes the native legend/given-label gate, without making a glyph-pixel claim.
- Answer sentinels occur only in teacher HTML; student HTML contains no answer payload or serialized full scenario. Edited title/question/hint markup stays escaped. Captures survive subsequent mission/date/requirement/operation mutations. First/last valid source intervals retain exclusive ends; negative, reversed and endpoint-only interval selections reject.

Evidence: `/tmp/refine-c12-material-probe.{cjs,json,log}`, `/tmp/refine-c12-student-solvability.{py,log}`, `/tmp/refine-c12-{student,solar-only,teacher}-*.html`. Independent Spec review also checked eleven actual-export cases without writing files. No hidden-answer workaround or alternate assessment implementation was introduced.

## R2 and S1 remain closed

`/tmp/refine-c12-abort-probe.cjs` bundles the **actual C12 globe consumer and atlas helper**; only NASA loading is replaced with three vertices and TextureLoader with a controlled callback. With another owner live and the callback stalled, globe abort settles as `AbortError`, disposes its geometry once, and leaves texture disposal at zero. The other owner then receives the image and its release disposes the texture once. A sole-owner stalled load aborts/disposes immediately and tolerates late completion. The actual bundled-globe repository regression additionally checks that a late image is cleared after final-owner release. No helper-only substitution is used for this closure. Logs: `/tmp/refine-c12-abort-probe.log` and focused suite.

The C11/C10 actual-consumer RED comparison and native-notation history below remain unchanged. Native legend checks above freshly reconfirm S1. No GPU-memory measurement or actual screen-reader acceptance is claimed.

## CCD8 and actual-NASA F8 numerical regression

The only contact-engine numerical delta is `world.maxCcdSubsteps = 8` in `lib/touchdown-physics.ts:258`; `numSolverIterations` remains eight. Mass assignment, friction/restitution, gravity, collision/proxy geometry, initial contact pose, output/cache cadence and clearance calculation are unchanged. No manual lift, post-step clamp/impulse, fabricated clearance, hidden/filter-selected piece or tolerance change was added. The retained initial geometry placement is unchanged. `CONTACT_MODEL_NOTE` now explicitly says **120 Hz replay with up to eight CCD substeps per sample**, not fixed 960 Hz integration.

The independent frozen CCD harness bundles the actual regression and production functions. Its cap-one run substitutes the exact `a31ca057:lib/touchdown-physics.ts` from Git; cap-eight runs unmodified C12. Both decode original indexed Draco geometry, preserve glTF accessor normalization bounds and node transforms, and use production 7 m normalization, all **157** proxies, the committed DEM and finite triangle collider. The original captured C10 contact is reused exactly.

| Captured breakup, 1,441 states | Original/default cap 1 | C12 cap 8 |
| --- | --- | --- |
| Frame 12 clearance | **−0.14322332847795147 m** | **−0.000021306776364637958 m** |
| Worst clearance | **−0.25009984343061104 m**, frame 3 | **−0.036762394522795616 m**, frame 2 |
| States below unchanged −0.05 m gate | **19 — expected RED** | **0 — PASS** |
| Original fragments in post-contact states | 157 | 157 |

C12's actual regression also checks all 1,441 states for finite root/fragment values and normalized quaternions, positive/exact total mass, complete untruncated replay, identical fresh packed states/flags/masses, backward/forward sampling and returned-value isolation. Removing the final piece or placing it outside the finite collider returns unknown, never a clearance pass. Captured nominal contact and controlled bounce pass with minima **−0.006529815868060507 m** and **−0.004981498341951732 m** respectively. The bounce is a labeled experiment, not telemetry. Small negative solver residuals and box/finite-DEM/soil/structural limits remain disclosed.

Evidence: `/tmp/refine-c12-ccd-probe.{cjs,log}`, `/tmp/refine-c12-ccd{1,8}.{cjs,log}`, fresh focused/full suite logs. The immutable original NASA GLB SHA-256 is `379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e`; decoder `8625489da79a805f4f2a7d511c3e52d8b4085608a9d2a4d5f4f9de5db0aea04f`; terrain `be7f59a95901f36cda1050538ea75fb1ce51e8b9cf5aebb532073086c0f70c32`.

This closes the reviewed source/numerical defect. **Actual completed-render HTTP/offline physical replay, framing, COM target, intact offset, physical 1× scale and every rendered sample remain the visual/runtime owner's independent final-candidate gates.** This lane does not substitute numerical regression for that browser evidence.

## Fresh checks and verifier integrity

Node **20.20.2**, npm **10.8.2**, existing lockfile SHA-256 `ad505d98b2d7114579e1ee30e04f504932349553db613c77d2d9de38ee86ff64`. All product commands ran at C12's actual sourceCheckPath with existing dependencies.

| Check | Fresh result | Evidence |
| --- | --- | --- |
| Focused atlas/actual globe/material/framing/debris/viewport/brand/education/imagery/landing-panel/contact-penetration suite | **57/57 pass**, zero failed/skipped/cancelled/todo | `/tmp/refine-c12-review-focused.log` |
| `npm test` | **763/763 pass**, zero failed/skipped/cancelled/todo | `/tmp/refine-c12-review-full.log` |
| `npm run typecheck -- --incremental false` | PASS | `/tmp/refine-c12-review-types.log` |
| `npm run lint` | PASS | `/tmp/refine-c12-review-lint.log` |
| `npm run math:check` | PASS, **314 expressions**, SHA-256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f` | `/tmp/refine-c12-review-math.log` |
| Actual-export, student-only printed-givens solver and actual-consumer abort probes | PASS | Probe logs above |
| Exact original/default CCD / unmodified C12 CCD | Expected RED exactly reproduced / PASS | CCD logs above |
| `git diff --check a31ca057..0ef2526` | PASS | `/tmp/refine-c12-review-whitespace.log` |
| Cached slop-scan 0.3.0 `scan .` / `scan . --lint` | Both exit 0; **289 files, five findings**, inspected | `/tmp/refine-c12-review-slop{,-lint}.log` |

Scanner findings remain contextual NASA decoding/decompression error catches, intentional strict scenario-validation rejection, and three directory fan-out metrics. Inspection identifies no new runtime defect; no scanner suppression, dependency installation or metric-only edit. Harness Three CommonJS warnings are not app-runtime observations.

The first focused command named a nonexistent test file and ran no tests; corrected to the actual `tests/landing-panel.test.ts` before the complete passing run. The initial CCD harness could not resolve an external dynamic Rapier import from `/tmp`; the next revision ran the original regression but its diagnostic parser missed TAP indentation. Both failed harness versions/logs/hash manifests are retained (`initial`, `resolver-v2`). Neither is counted as a product failure or passing evidence. After correcting the resolver/parser, **all four probes were frozen and rerun**. Final SHA-256 values:

- Material export: `a626904ad7bdc59824f77e3d3894a395dafaf3be48021da11818d845449f9d9f`.
- Student-only solver: `1aeeb0daeb83b1c5a1ce241fff0a6af6f4ee8f87ed7015464dbf73516a3f601d`.
- Actual-globe abort: `0bd63202fe8fa28fa68bf015dbcdfa0da79c3ee79dd4a782d3b87917d785fbcd`.
- CCD baseline/C12 harness: `31596b58676135083db8cb180b870a3e13ffc6c8f04b7b9a600834886a616552`.

`/tmp/refine-c12-review-probes-before.sha256` verifies these final scripts unchanged after execution; `/tmp/refine-c12-review-integrity-before.sha256` verifies candidate inputs and historical C11 probes unchanged. Original C11 probe manifest also still verifies. No changed script is claimed to have its initial identity.

Git confirms canonical assessment/mission/astro/flight/rigid/scenario/solar-response implementations, pipeline, all `public/data`, generated MathML and manifests/lockfile are unchanged in the C12 delta. `planning-4` remains the sole full-mission assessment authority. No ephemeris/astronomical geometry change, fresh Horizons/provider run or duplicated 75-epoch research is claimed. Illustrative post-contact dynamics change is separately disclosed above.

## Handoff and remaining owner gates

**Owned source-review disposition: GREEN, zero unresolved Standards or Spec blockers.** No new product blocker required `/tmp/refine-c12-review-findings.txt`. C12 source checks and probes are complete; only this report is committed/bundled since `4e50010` for Root. Final handoff: `/tmp/refine-c12-review-result.txt`, `/tmp/refine-c12-review.bundle`.

F6 actual expanded-contact glyph pixels, F7 native-200% normal-pointer controls, final immutable HTTP/disconnected-file workflows and completed-render physical replay belong to their assigned owners. No CSS/source-only inference closes those gates. Human classroom/assistive-technology acceptance, target-device performance and qualified terrain/contact/soil/structural/flight/station evidence retain the existing project limits. This review grants no mission qualification, user acceptance, deployment approval, push or merge.

The complete C11/C10 report suffix below is preserved **byte for byte** from `4e50010`, SHA-256 `6fec10aa96859509fdd0ef7fea585e55e640407c3b03716c400d5ce5971a0418`; its old findings, counts, RED history and probe identities remain dated history, not C12 results.

---

# C11 follow-up — two P2 findings closed; R1 partially open

14 November 2026. Reviewed the marker's actual C11 source **`a31ca0577f3c1f811080be82994511bf082a29af`**. **S1 (native notation) and R2 (stalled globe cancellation) are closed. R1 remains P2 at the zero-hardware/unknown-source boundary.** The ordinary solar and evidence-givens defects are corrected, but the actual student export still cannot distinguish two cases requiring different teacher answers. No additional source blocker found. No app fixes made. This is not global release signoff: C11 explicitly leaves F8 contact penetration open, and actual F6 pixels remain the visual verifier's gate.

## Pinned source and immutable evidence

- Actual inspected/tested source: `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c11-final-check`, HEAD `a31ca0577f3c1f811080be82994511bf082a29af`, tree `dc186e3f591fb709e75a7cddec9754c8cbd2ac0c`; clean before and after checks. This is the marker's `sourceCheckPath`, not the old `8ae902d` report checkout.
- Reviewed delta: `git diff 8ae902d..a31ca057`, 16 files, five commits. Binary diff SHA-256 `5cc1f12e9968854a4be1e66623e6bc02b87c52058bc47ce6e4706343d84fd592`. `/tmp/lunar-window-c11-source.bundle` verifies, resolves HEAD to that source, requires `8ae902d`, and hashes to `b20b8f78fedc0b1f8fd511d1c21d3b7bff97ecb6c5c25fd4fdb15b132f6ccae9`.
- Polled the two requested handoff paths every 20 seconds. Marker `/tmp/solarreach-refinement-c11-ready.json` SHA-256 `b40288d1509786f90e24d9818a2b3ccbec703565ffed84bc6fdb6e293a9d98d5`; instructions `/tmp/refinement-c11-qa-instructions.txt` SHA-256 `b06fc228afc79b3cf4cc6510b7259bdbcac8bfb8d603146506f6875c0429a610`.
- Artifact `/tmp/lunar-window-c11.html` SHA-256 `72fdb47684236426ec1816772f7421a65535a698b19dba1e50eb731d3258dcfe` matches the marker. Artifact, source bundle, marker and instructions retained identical hashes through this audit. Hash identity is not browser, download or pixel verification.
- Read instructions, adaptation, relevant memory and review skill; instruction parity passed. Independent read-only Standards and Spec reviewers inspected the pinned delta. Primary reviewer reproduced and classified the boundary below. No child edits or runtime sessions.
- Exclusive repository write: this report only, on `codex/refine-dark-code-review`, based on report commit `6864542`. No app/test/configuration/dependency/generated changes, source worktree writes, app server, browser, Simulator, Metro, push or merge. Temporary harnesses and logs are under `/tmp/refine-c11-*`. Harnesses were adapted, then frozen before the final probe run; `/tmp/refine-c11-review-probes-before.sha256` verifies all three final scripts unchanged afterward. The complete C10 report is preserved verbatim below. Under the exclusive-write restriction, the report is the durable review/milestone record; no shared-vault mutation is claimed.

## Standards — S1 closed

**S1 closure proof:** `lib/education-materials/index.ts:19,29` replaces literal reserve identifiers in prose with authored `notation` entries and symbolic given labels. Both exported HTML and the captured-givens preview call the native MathML renderer for these entries. The probe inspects the actual reserve article's seven definition terms: all four symbolic legend entries and both symbolic given labels contain native `<math>` and `<msub>`, alongside the native equation. Actual student exports across eleven fixtures contain no literal `M_reserve`, `E_B`, `C_B`, `f_reserve`, `E_terrain` or `E_sphere`. This is legend/given-label proof, not merely finding one equation.

Editable title, question and hint markup stays escaped in student and teacher HTML. Sentinel answers appear only in teacher output; student output does not serialize answers or the full scenario. No new documented-standard blocker found. Native font appearance, assistive-technology behavior and human acceptance remain unclaimed.

## Spec — R2 closed; R1 partially open

**R2 closure proof:** `lib/moon-atlas-texture.ts:24` adds the per-owner `waitForMoonAtlas` abort subscription, removes it on settlement and releases only that lease on abort. `components/workbench/scene/nasa-globe.ts:29` awaits it; its catch disposes geometry and idempotently releases the lease. Helper regressions cover already-aborted/successful settlement, retry, synchronous failure and late completion.

The independent adapted C10 probe bundles the actual consumer/helper, replacing only the large NASA model with three vertices and controlling `TextureLoader`. While the callback remains stalled, abort now produces `AbortError`, one geometry disposal and zero texture disposals while another owner remains live. That owner subsequently receives the actual controlled image, then retires the texture once. A second sole-owner stalled load also settles/retires immediately and tolerates a late callback. The same assertion using exact C10 consumer **and helper** from `git show 8ae902d` fails: state remains `pending`, geometry/texture disposals remain zero. Evidence: `/tmp/refine-c11-abort-probe.cjs`, `/tmp/refine-c11-abort-probe.log`, `/tmp/refine-c11-review-abort-red.log`. The new repository `tests/nasa-atlas-abort.test.ts` also exercises the actual bundled globe. No GPU-memory or target-device measurement is claimed.

**R1 ordinary-case closure:** `lib/education-materials/index.ts:18,22` freezes the combined visible-disk/incidence/active-deployment factor and assessment scope/outcome, every required/optional constraint state/explanation, and source coverage/version/cadence/resolution/notes. The evidence prompt allows no recorded failure or missing item and asks what remains unverified. `components/education-materials/material-builder.tsx:21` exposes “Captured givens for this question” before export. Capture remains unchanged after mutations to input mission, dates, operations and requirements.

Actual HTML parsing, without consulting teacher answers, reconstructs the positive-hardware gradient from the printed givens: **0.707580120 m²**, versus authority **0.7075802941347838 m²** (rounding from six printed decimal places), and a **70.758012 W** change for +100 W/m². Half-interval deployment yields **0.353790060 m²**, versus **0.3537901470673919 m²**; no deployment yields known zero. Zero irradiance correctly leaves the derivative positive. Missing-terrain output preserves unavailable values. Independent parsing also reconstructs reserve floor/margin, terrain-energy difference and both contact percentages from the actual student HTML across all eleven fixtures, preserving each unknown rather than substituting zero.

**R1 — P2 still open: zero hardware collapses source-known and source-unknown student givens.** At `lib/audience/experiments.ts:53` (unchanged helper), `activeFactor` is null whenever the hardware coefficient `area × efficiency × (1 − loss)` is zero, as well as when the derivative is unavailable. C11 now exports that null as the sole combined geometry/deployment given, with the instruction to preserve a missing-source limitation. At a known catalog site with `areaM2=0`, the teacher derivative is **0**; at the same hardware with custom latitude 25°, longitude 30° outside terrain coverage, it is **null/Unavailable**. The two **solar-only student question articles are byte-identical**, including “Unavailable (do not substitute zero)” for the combined factor, and contain no source-known flag distinguishing them. Applying zero hardware universally disagrees with the second authority result; preserving the unavailable factor universally disagrees with the first. Header coordinates/scenario identity alone do not disclose terrain coverage on a standalone worksheet. Zero efficiency and complete hardware loss similarly export null factors despite known-zero answers.

This is partial closure of the original missing-givens finding, not a new numerical-model defect. Supply a frozen student-safe source-known/unknown context or an explicit zero/unknown marking policy that reproduces the canonical answers; do not alter the numerical authority to repair worksheet presentation. Reported immediately to `/tmp/refine-c11-review-findings.txt`; no app fix applied. Evidence: `/tmp/refine-c11-material-probe.cjs`, `/tmp/refine-c11-material-probe.json`, `/tmp/refine-c11-material-probe.log`, `/tmp/refine-c11-student-solvability.py`, `/tmp/refine-c11-student-solvability.log`, and paired `/tmp/refine-c11-solar-only-area-zero.html` / `/tmp/refine-c11-solar-only-unknown-area-zero.html`.

## F6/F7 and authoring delta

- `components/workbench/panels.tsx:432` removes legacy inline foreground/translucent backgrounds from the expanded contact result and adds `data-landing-contact-result` plus semantic `constraint landing-outcome <state>` classes. Existing mission-theme selectors supply opaque outcome surfaces. SSR regression covers within/outside/unknown results. **Actual expanded, scrolled, unmodified glyph pixels are not verified here; F6 is not closed by this source review.**
- `app/globals.css:2845` gives short viewports a bounded, internally scrolling location band and moves flight telemetry below it, preserving controls. Source review finds no additional blocker. The ordinary test run does not enable the artifact/browser viewport gate. Root/visual verifier must prove normal expand/minimize actions, nonoverlap and native 200% zoom; their earlier six browser gates are handoff evidence, not this review's independent result.
- Question and Hint textareas have fixed explicit accessible names and unique `useId`/topic descriptions referencing the relevant question summary. Their editable values cannot change those explicit names. The captured-givens preview uses native equations/legends/values/context. This is source inspection, not actual screen-reader acceptance.

## Fresh checks on the marker source

Node **20.20.2**, npm **10.8.2**; unchanged lockfile SHA-256 `ad505d98b2d7114579e1ee30e04f504932349553db613c77d2d9de38ee86ff64`. Commands use the candidate's existing dependencies and manifests, without temporary configuration edits.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Focused atlas/globe/material/framing/debris/viewport/brand/education/imagery/landing-panel tests | **52/52 pass**, zero failed/skipped/cancelled/todo | `/tmp/refine-c11-review-focused.log` |
| `npm test` | **758/758 pass**, zero failed/skipped/cancelled/todo | `/tmp/refine-c11-review-full.log` |
| `npm run typecheck -- --incremental false` | PASS | `/tmp/refine-c11-review-types.log` |
| `npm run lint` | PASS | `/tmp/refine-c11-review-lint.log` |
| `npm run math:check` | PASS, **314 expressions**, SHA-256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f` | `/tmp/refine-c11-review-math.log` |
| Actual-consumer stalled-loader probe, C11 / exact C10 consumer+helper | **PASS / expected RED** at prompt-settlement assertion | `/tmp/refine-c11-review-probe-results.json`, abort logs above |
| Eleven actual-export fixtures; printed-givens solver; first/last valid and invalid interval boundaries | Probe assertions PASS; **R1 partial closure reproduced** | Material/solvability logs above |
| `git diff --check 8ae902d..a31ca057` | PASS | `/tmp/refine-c11-review-whitespace.log` |
| Cached `slop-scan` 0.3.0 `scan .` / `scan . --lint` | Both exit 0; **288 files, five findings**, inspected | `/tmp/refine-c11-review-slop.log`, `/tmp/refine-c11-review-slop-lint.log` |

Scanner findings: NASA decode/decompression catches retain contextual errors/causes; scenario validation catches deliberately return null for caller rejection; three fan-out metrics identify no concrete runtime defect. No new suppression, package installation or metric-only edit. The probe's Three CommonJS deprecation warning concerns harness imports, not observed application behavior.

Git confirms the C11 delta leaves `lib/assessment.ts`, `lib/astro.ts`, mission/flight/touchdown/rigid/scenario/solar-response numerical implementation, pipeline, all `public/data`, generated MathML and package manifests/lockfile unchanged. `planning-4` remains the sole assessment authority. No numerical, physical, solver, ephemeris, image or dataset changes; no repeated 75-epoch research, fresh Horizons/provider validation or altered science gate.

## Remaining gates and handoff

**Current review disposition:** Standards **0 open** (S1 closed); Spec **1 open P2** (R1 partial, R2 closed); no new P0/P1 finding. The zero/unknown export edge is not covered by the green 758-test suite. Root must resolve or explicitly disposition it on a later candidate and rerun affected review/checks.

C11 instructions explicitly retain **F8 OPEN**: the independent C10 completed-frame probe reported approximately **−0.143223 m** proxy-terrain clearance against the retained **−0.05 m** gate. That is supplied historical evidence, not a rerun or new physics finding in this lane. Its dedicated fix and full final web/offline E2E remain required; no assertion or threshold is waived. F6 pixels, F7 actual native-zoom interactions, immutable HTTP/file journey checks and downloaded-material workflows remain with their owners. C10 evidence below remains historical.

Human classroom/assistive-technology testing, actual native font/contrast/zoom acceptance, target-device performance and operational/qualified source, terrain, contact, flight, controller, soil, structural and station evidence remain subject to the existing project limits. This review does not confer user acceptance, mission qualification or deployment approval.

Only this report is committed and bundled since `6864542`; Root can land the C10 report commit and this follow-up sequentially. The unchanged C10 record follows in full.

---

# Final combined dark-refinement source review

14 November 2026. **Three P2 findings remain:** one native-notation regression, incomplete student exercise givens, and delayed cancellation in the globe atlas consumer. The latter reproduces on the prior source too; it is an unclosed requested lifecycle edge, not a newly introduced regression. Fresh combined-source checks pass. No app fixes were made. Root should resolve or explicitly disposition these findings before declaring the requested refinement complete.

## Source identity and review boundary

- Worktree: `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-dark-code-review`; branch `codex/refine-dark-code-review`.
- Exact reviewed product source: `8ae902d40f0f196b065b20d57bef1602a5ec73ae`; tree `607fe11d5f9305a1e7cc6276973700fc05e63b60`. The checkout was clean before review and remained unchanged through all product checks.
- Actual comparison: `git diff 6c9227a03597c33169dd05433aec79adc7048a48..8ae902d40f0f196b065b20d57bef1602a5ec73ae`, 71 files. SHA-256 of `git diff --binary 6c9227a..8ae902d`: `5f7b0233bc6bece2481cc7317959b9d583374baed308e928248bbb8c1162a6dc`.
- Read repository instructions, refinement acceptance criteria, current implementation/handoff records, relevant canonical memory, and the review skill. Instruction parity check passed. Two independent read-only subagents supplied Standards and Spec reviews; the primary reviewer inspected and reproduced findings.
- Only this new repository report is writable in this lane. No app/test fixes, generated files, dependency/configuration changes, app servers, Simulator, Metro, builds, browsers, pushes or merges. Temporary probes/logs live under `/tmp/refine-dark-review-*`. Shared memory was recalled; its files were not mutated under the exclusive-write restriction. This report is the durable review record.
- Root owns final candidate and integration. Other workers own final HTTP/offline visual and workflow verification. No ready marker was present when inspected; no stale checkout/artifact evidence is substituted for their work.

## Standards

**S1 — P2: new exported symbol legends regress to literal underscore notation.** `lib/education-materials/index.ts:19` authors `M_reserve`, `E_B`, `C_B` and `f_reserve`, including the given label `Capacity C_B`. At `:29`, symbols and given labels are escaped as plain prose. The equation itself correctly renders native MathML, but its legend and givens visibly expose the literal identifiers Luke previously rejected. This conflicts with the accepted extension's native-notation requirement. Capture the reserve topic and export student or teacher HTML; the literal strings are present in actual output. Use authored semantic symbols/subscripts for these labels, keeping editable user prose escaped. Evidence: `/tmp/refine-dark-review-probes.log` and `/tmp/refine-dark-review-student.html`.

No additional blocking standards violation identified. `evaluateScenario` remains the assessment authority, captured inputs are cloned, unknowns remain unavailable, legacy storage/data identities remain intact, and no second component library or numerical data path was introduced. The dark theme targets UI surfaces and authored charts rather than applying image/canvas filters. Rendered contrast, layout and human accessibility are separate evidence gates below.

## Spec

**R1 — P2: two student exercises lack the frozen givens needed to solve them.** `lib/education-materials/index.ts:18` requests the captured solar gradient and power change for +100 W/m², but supplies only area, efficiency, loss and irradiance. The solar disk/incidence/deployment factors are absent. The reproduced fixture supplies 4 m², 0.3 and 0.15, while the teacher answer is **0.70758 m²**, versus **1.02 m²** on the sphere; the student cannot derive this distinction from those givens. At `:22`, the evidence exercise requires the exact captured assessment, but exports `values:[]` and no constraint/evidence summary; those facts appear only in the teacher answer. The HTML is advertised as a printable student worksheet and deliberately excludes teacher files/scenario JSON. Capture default topics, export student HTML and use it independently: these exercises require information not on the sheet. Export frozen student-safe geometry/deployment factors and assessment/evidence context without serializing answers or the full teacher scenario. Evidence: the actual exported HTML and logged givens/teacher output in `/tmp/refine-dark-review-probes.log`.

**R2 — P2: globe abort does not release a pending shared-atlas lease promptly.** `components/workbench/scene/nasa-globe.ts:29` awaits `atlas.ready` before checking the caller's signal. Runtime teardown aborts `globeAbort` at `components/workbench/scene/runtime.ts:106`, but no abort listener/race settles this wait. Delay the atlas image after globe geometry preparation, dispose the scene, and release the surface owner: the globe promise remains pending, geometry remains retained and its lease prevents last-owner texture retirement until the image callback arrives. A stalled callback retains them indefinitely and a retry may join the stalled atlas entry. The lease helper's direct early-release tests pass, but the actual globe consumer does not call release on this path. Settle and clean up on abort while preserving other live owners and safe late completion.

The executable probe bundles the actual pinned consumer and shared helper, replacing only model loading with a three-vertex fixture and `TextureLoader` with a controlled pending loader. After abort plus other-owner release: `settled=false`, texture disposals `0`, geometry disposals `0`. After late success: `AbortError`, both disposal counts `1`. The same probe against isolated `git show 6c9227a:components/workbench/scene/nasa-globe.ts` reproduces delayed cleanup in the previous private-loader implementation. This establishes inherited cancellation debt, not a newly introduced private-loader regression. Evidence: `/tmp/refine-dark-review-probes.cjs`, `/tmp/refine-dark-review-probes.log`; separate current/base logs also retained. Immediate findings were published to `/tmp/refine-dark-review-findings.txt` during review.

No further concrete source blocker found in the requested contracts:

| Contract | Source inspection and fresh evidence | Qualification |
| --- | --- | --- |
| Shared atlas ownership/retry | URL-keyed shared texture/promise; independent idempotent releases; only last release retires; failed entries allow a new attempt without old release deleting it; synchronous loader errors return an owned rejected lease; late images are cleared. Surface cleanup releases its lease. Four helper lifecycle tests and surface lifecycle tests pass. | R2 applies to the actual globe abort path. Controlled loaders establish lifecycle behavior, not measured driver memory or target-device performance. |
| Original 8K source/offline alias | Both consumers request the same URL. The original JPEG is unchanged, 8192×4096, 4,631,745 bytes; SHA-256 `cc32b024491668b8a2d4e1a6c911ce9a130e9eb8e6704f65027697877f6aa77f` matches committed NASA metadata. Standalone skips a second global-image embedding and aliases `imagery.global.url` to the existing `textureDataUrl` before application startup. | Static alias/bundling review and existing tests; no new offline artifact or browser/GPU run in this lane. |
| Actual NAC patches/broad context | All six committed centre JPEGs decode at declared dimensions, contain their sites and sample at 2.090320587 m/output pixel. Metadata distinguishes 1 m source pixels from output sampling. Selection uses the finest containing patch plus the next finest broad NAC patch; source WAC backing/polar/global fallbacks remain. Existing two-load/three-cache-target protections, handoff, failure retry and late disposal tests pass. | No repeated remote imagery download or independent source research. Cache can temporarily exceed three while entries are bound/loading/preparing; this is documented protection, not an unconditional three-entry bound. Imagery is not numerical terrain or hazard qualification. |
| Immutable materials/numerics/unknowns/dates | Explicit capture clones inputs and calls the canonical authority/selected response. Mutating the original after capture leaves captured JSON identical. Teacher JSON retains exact scenario and identities; student HTML excludes answers/full scenario. Editable prose is escaped and authored equations use the closed MathML registry. Nulls remain unavailable. First and last valid intervals export correct exclusive ends; negative, reversed and last-endpoint-as-interval requests reject rather than clamp. | R1 and S1 remain. A first ad-hoc probe deliberately reached an invalid final endpoint and rejected; the corrected boundary probe uses `n-2`, matching the parser's interval contract. No human classroom usability claim. |
| Dark branding/icons/images | Existing header Sun/orbit markup is passed into the brand component; control components/callbacks remain. Theme/module edits recolor UI/chart primitives, retain Sun/Earth distinctions and explicit focus/disabled/invalid/reduced-motion styles, and do not filter NASA imagery. Public copy changes reuse existing results and terrain/sphere presentation. | Responsive placement changes are the authorized F5 work. Source and token-contrast checks cannot prove actual final pixels, overlap, zoom, screen-reader usability or visual acceptance. |
| F4 physical framing/picking | Runtime gathers every visible fragment's original geometry bounds. Render-only pullback follows the existing view ray around the target; original model/piece scales stay intact. The base camera is restored in `finally`, intact offsets remain, and a fitted camera copy drives Follow/Inspect picking. Position/distance/clip/geographic telemetry reports the fitted view. Focused original-asset/callsite and framing tests pass. | Tests include invalid/empty bounds and no accumulated pose mutation. Final real playback, smoothness, target-device FPS and actual GPU correctness belong to the visual/runtime lanes. |
| F5 viewport/projection | Occlusion intersects actual host/canvas rectangles with visualViewport and removes listeners on disposal. CSS bounds the app to dynamic viewport and gives long panels internal scrolling. Canvas transforms account for rounded backing dimensions; polar image/pointer inverse functions use one scale, and resize preserves manual centre/scale. Roundtrip tests pass across wide/narrow sizes. | Optional artifact/browser viewport test was not enabled. Native 200% zoom, actual clipped panels and final web/file journeys remain other workers' gates. |

## Numerical and scientific boundary

Git comparison confirms no changes in `lib/assessment.ts`, `lib/astro.ts`, `lib/mission.ts`, `lib/flight.ts`, `lib/touchdown-physics.ts`, `lib/rigid-math.ts`, `lib/scenario.ts`, pipeline files, catalog, numerical terrain, original NASA model metadata/JPEG, generated native MathML or either package manifest/lockfile. The new camera math changes viewing/framing only; no scientific coordinate transformation or physical trajectory formula changed. `planning-4` stays the same authority. The imagery manifest/JPEG additions are visual data, not new terrain measurements.

The ordinary full suite includes the existing scientific regressions. This review does not repeat the already reviewed C8/36-case research or 75-epoch SPICE reference study and claims no fresh Horizons/provider validation. Nothing here upgrades conditional evidence, DSN availability, landing readiness or mission qualification.

## Fresh combined-source verification

All requested checks ran on the exact `8ae902d` checkout, with existing dependencies, before this report was added. Node **20.20.2**, npm **10.8.2**, TypeScript **5.9.3**, tsx **4.23.15**, Three **0.187.0**, ESLint **9.39.5**, esbuild **0.28.2**, Temml **0.14.0**. Lockfile SHA-256: `ad505d98b2d7114579e1ee30e04f504932349553db613c77d2d9de38ee86ff64`.

| Command | Fresh result | Evidence |
| --- | --- | --- |
| `npx tsx --test tests/moon-atlas-texture.test.ts components/workbench/scene/material.test.ts components/workbench/scene/refine-framing.test.ts tests/refinement-debris-camera.test.ts tests/refinement-viewport.test.ts tests/refinement-brand.test.ts tests/education-materials.test.ts tests/surface-imagery.test.ts` | **44/44 pass**, zero failed/skipped/cancelled/todo | `/tmp/refine-dark-review-focused.log` |
| `npm test` | **752/752 pass**, zero failed/skipped/cancelled/todo | `/tmp/refine-dark-review-full.log` |
| `npm run typecheck -- --incremental false` | PASS | `/tmp/refine-dark-review-types.log` |
| `npm run lint` | PASS | `/tmp/refine-dark-review-lint.log` |
| `npm run math:check` | PASS, **314 expressions**, registry SHA-256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f` | `/tmp/refine-dark-review-math.log` |
| `git diff --check 6c9227a..8ae902d` | PASS | `/tmp/refine-dark-review-whitespace.log` |
| Cached `slop-scan` 0.3.0 `scan .` and `scan . --lint` | Both exit 0; **287 files, five findings**, all inspected | `/tmp/refine-dark-review-slop.log`, `/tmp/refine-dark-review-slop-lint.log` |
| `NODE_PATH="$PWD/node_modules" node /tmp/refine-dark-review-probes.cjs` | Exit 0; reproduces current/base cancellation gap and material defects; immutable/date-bound probes pass | `/tmp/refine-dark-review-probes.log` |

Scanner triage: two NASA decode/decompress catches preserve causes and throw contextual errors; strict scenario-validation catches intentionally return null for caller rejection; three directory fan-out metrics establish no runtime fault. No new scanner suppression or metric-only change. No package was installed. The probe's Three CommonJS deprecation warning is a harness import warning, not an app runtime observation.

Working/staged whitespace and report-only commit scope are checked for handoff. The temporary controlled probes supplement the regression suite; no repository tests were changed. Green tests do not cover missing worksheet givens/legends or immediate globe abort cleanup.

## Remaining acceptance limits and handoff

Root must reconcile the three findings with the final candidate and rerun affected checks after any fix. This report covers `8ae902d`; later changes require a delta review. Only this report is committed and bundled from base `8ae902d`; application source remains untouched.

Final immutable artifact/source matching, actual HTTP and disconnected-file runs, downloaded student/teacher files, native font/notation pixels, panel scrolling at all requested widths/native 200%, physical Follow/breakup/picking replay, GPU reuse and no-network evidence remain owned by the other workers/Root. Prior worker evidence is historical and is not relabeled as proof of this combined candidate.

Human audience and assistive-technology validation, real target-device performance, qualified source-frame/terrain/contact uncertainty, flight/controller/gear/soil/structural evidence and operational station/allocation support remain qualified or incomplete according to existing project gates. This is a current-source code review, not scientific mission qualification, user acceptance or deployment approval.

Standards findings: **1 (S1, P2)**. Spec findings: **2 (R1/R2, P2; R2 inherited and reproduced on base)**. No P0/P1 finding identified.
