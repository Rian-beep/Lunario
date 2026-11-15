# C13 independent refinement workflow verification

Status: **C13 SCOPED WORKFLOW GATE GREEN — 82/82 PASS, 0 failed, 0 unexecuted, 0 owned blockers**. All 41 journeys pass independently over actual HTTP and fully disconnected `file:`. Fresh checks in the actual C13 source checkout pass **763/763 tests**, nonincremental types, full lint and **314 native MathML expressions**. This is agent verification within the workflow lane, not overall release, operational, human or screen-reader acceptance, or GPU performance evidence.

## Actual execution and immutable identities

Completed **2026-11-14T23:42:34.260Z–2026-11-14T23:45:08.012Z**, exit **0**, from workflow base `30630158ef10706aa0e1a26dcafe078fecf93275` plus the owned candidate-default change. The executing script is frozen before/after; the later commit does not change it.

```sh
node scripts/verify-refinement.mjs --marker /tmp/solarreach-refinement-c13-ready.json --instructions /tmp/refinement-c13-qa-instructions.txt --sourceBundle /tmp/lunar-window-c13-source.bundle --section all --mode both --output /tmp/solarreach-refinement-workflows-c13 > /tmp/refine-c13-workflow.log 2>&1
```

| Frozen identity | Actual measured value |
| --- | --- |
| Published C13 source | `a93e252f2c9e46395c3644d822a94cf62f30f95d` |
| Actual read-only source | `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c13-final-check`, clean before/after |
| Artifact | `/tmp/lunar-window-c13.html`, **81,081,299 bytes** |
| Exact matching HTTP | `http://127.0.0.1:43326/` |
| Artifact + HTTP SHA-256 before/after | `a031e1695a7a75b03e8316055c75467943e2abe889bca0cf15aadc5c52f0c84f` |
| Ready marker SHA-256 before/after | `3b066432911c03a19072030a4b9df297fe5b8e25fd6c69181d8db67915033fb8` |
| Frozen instructions SHA-256 before/after | `3029c0c3676d2cf40fd6615480836d1506236f7e0422294184dbb826eaf9c446` |
| Executing verifier SHA-256 before/after | `b58b22fa14a0fdb7a04a2177b276cb56f8de7c3203dab941487d3df91bafeb4c` |
| Published source bundle | `/tmp/lunar-window-c13-source.bundle`, **1,103,977 bytes**, verified published source head |
| Source bundle SHA-256 before/after | `bd145e4a8e1bd6766ef2e5c8d9f402d57834b1b9df3d4efd02523a538d4e1570` |
| Complete report | `/tmp/solarreach-refinement-workflows-c13/report.json` |

No marker, instructions, artifact, HTTP bytes, executing script, source bundle or read-only source identity changed during verification. Before/after copies and supplementary integrity records are retained in the evidence directory. Both the artifact and HTTP response hash to the required `a031e169…f0c84f`; this is a fresh C13 execution, not relabelled C12 evidence.

The only verifier change from `3063015` is replacing the four C12 marker/instructions/source-bundle/output defaults with C13 paths. **Every assertion body is byte-identical**; all 82 journey names and their order match the complete C12 run (`unchanged-check-contract.json`). No rewrite, retry, threshold relaxation, injected application state, forced click or app numerical-helper import was used.

Browser: **Google Chrome 149.0.7827.155**, Playwright **1.63.0-alpha-2026-08-05**, module `/home/luke/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs` (package SHA-256 `cc20d8407732820e1a334b890b204360aabf5e675ebfe0d2881bc2f54d32e681`). Host **CLEVO-X2**, Linux x64, AMD RYZEN AI MAX+ 395 w/ Radeon 8060S. Fresh isolated contexts at 1600×1100, reduced motion, 800/390-width document bounds; flags `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --disable-dev-shm-usage`. SwiftShader is software rendering; caches were not flushed. This lane does not claim real GPU performance, native-200% or whole-product visual acceptance.

## Complete owned outcomes and preserved RED history

Both transports pass public guidance/state preservation; independent replan capture, exact dates/deltas/first failures, actual bounded scans and cancellation; native Teaching modal/focus/Escape, plots/units/illustrative arithmetic, prediction and legacy notebook/draft persistence; every actual student/teacher export, captured givens, native notation, known-zero versus missing-forcing explanation, teacher-answer separation including hidden text, escaping, exact immutable capture and explicit recapture; engineering archived official import, source/identity/date/unit rejection, known zero versus missing coverage/allocation, stale fields/bindings, bounded cases and provider failure/cancel/station change. Resource edits preserve scene/canvas identity, focus and avoid baseline asset refetch.

Actual known-zero and missing-forcing student download screenshots, plus the disconnected native teacher download, were inspected: native equations and givens are visible, available zero hardware is explicitly distinguished from unavailable forcing, literal edited HTML remains escaped, and teacher answers occupy their separate section. This is scoped agent inspection, not human or screen-reader acceptance.

**No C13 content assertion or screenshot transport failure occurred.** All required embedded cases and full-page downloaded-document captures completed on the first full run. The C12 screenshot-protocol RED runs and readiness diagnosis below remain unchanged; they are neither removed nor counted as C13 failures. All earlier C11/C10/C8/C5/C3 RED and GREEN histories are preserved byte-for-byte below. C12's separate F9 native-200% visual RED remains historical and is not overridden by either candidate's workflow GREEN. Root and the visual/contact owners retain their independent C13 release gates.

Each context records zero page errors, zero HTTP error responses and zero unexpected console errors. Ordinary disconnected-file use issues **zero unmocked HTTP requests**, including actual downloads, reload and imports. Each transport retains four deliberately failed/aborted provider requests with explicit labels and two expected console errors (`ERR_FAILED`, `ERR_INTERNET_DISCONNECTED`). No successful external response is fabricated or claimed. Exact requests, failure/cancel evidence and errors are in `report.json` and `network-summary.json`.

## Fresh C13 source and owned checks

| Required check | Actual result |
| --- | --- |
| `npm test` in actual read-only C13 source | **763 pass, 0 fail/cancelled/skipped/todo** |
| `npm run typecheck -- --incremental false` there | PASS, exit 0 |
| `npm run lint` there | PASS, exit 0 |
| `npm run math:check` there | PASS, **314 expressions**, exit 0 |
| HTTP + fully disconnected file workflows | **41 + 41 pass**, 0 failed/unexecuted |
| Owned verifier syntax / zero-warning ESLint / diff whitespace | PASS |
| C12 assertion-body and journey-order preservation | PASS, exact comparisons |
| C12-and-earlier report history preservation | PASS, byte-identical suffix |

`fresh-source-checks.json` records exact commands, actual source path, start/end UTC, exits and SHA-256 of each copied `/tmp/refine-c13-source-{tests,types,lint,math}.log`. Source testing ran during the immutable browser gate; before/after source remains the published clean commit. These are fresh lane executions, not borrowed Root counts. Math manifest SHA-256 is `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f`.

Owned syntax and zero-warning ESLint pass. Cached installed slop-scan 0.3.0, without installation, reports **0 findings** in owned scripts. The actual-source scan reports five inspected findings: three directory fan-out metrics and two catch groups. NASA wrappers retain error causes; scenario import validators return null on invalid input by contract. No owned implementation defect is identified. Logs/scans are retained in the evidence directory. The canonical `evaluateScenario` authority, astro, planning types, touchdown physics, dataset pipeline and catalog have identical Git objects from C12 to C13 (`supplementary-canonical-authority.json`); this lane changes no numerical/constraint meaning or ephemeris and does not rerun Horizons.

Evidence includes **102 PNGs** and **182 numbered production input/download files**. Required owned checks: **0 remaining, 0 unexecuted; no owned blocker**. Physical completed-frame/all157/1×/COM/clearance/replay, full viewport/map/pole/raster contrast and native-200% normal-pointer gates remain separate-lane work; their counts are not borrowed. Immutable web/offline builds were supplied by Root, not rebuilt here. Human audience, screen-reader, operational and mission qualification remain explicitly **unperformed**.

Only `scripts/verify-refinement.mjs` and this report change in the repository. No app/config/dependency/generated changes, children, shared browser/server, Simulator/Metro, push or merge. Private GitHub and teammate hosting remain unchanged. Delivery: `/tmp/refine-c13-workflow-result.txt` and `/tmp/refine-c13-workflow.bundle` since `30630158ef10706aa0e1a26dcafe078fecf93275`.

## Preserved C12 and earlier report (verbatim)

The following is the complete unchanged C12 workflow report, including all prior RED evidence. Its candidate-specific statuses remain historical.

# C12 independent refinement workflow verification

Status: **C12 WORKFLOW GATE GREEN — 82/82 PASS, 0 failed, 0 unexecuted, 0 owned blockers**. Both transports independently pass all 41 prepared journeys, including the expanded R1 known-zero/missing-forcing check. Fresh exact-C12-source verification: **763/763 tests**, nonincremental types, full lint and **314** native MathML expressions pass. This is scoped agent verification; physical/visual release gates and human/mission qualification are not borrowed from other lanes. The complete C11/C10-and-earlier report below remains verbatim history.

## Actual execution and frozen identities

Final full run: **2026-11-14T23:22:07.775Z–2026-11-14T23:25:43.398Z**, exit **0**, starting verifier checkout `b81243ed28f433e2e69956f27fa43f18fedf302c` plus the owned QA changes. The final executed script is frozen byte-for-byte in the evidence directory; the subsequent commit does not change it.

```sh
node scripts/verify-refinement.mjs --marker /tmp/solarreach-refinement-c12-ready.json --instructions /tmp/refinement-c12-qa-instructions.txt --sourceBundle /tmp/lunar-window-c12-source.bundle --section all --mode both --output /tmp/solarreach-refinement-workflows-c12-r4 > /tmp/refine-c12-workflow-r4.log 2>&1
```

| Identity | Actual measured value |
| --- | --- |
| Combined C12 source | `0ef2526a894f35bf9ee05773f646f817bf4b958f` |
| Actual read-only source checkout | `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c12-final-check`, clean before/after |
| Artifact | `/tmp/lunar-window-c12.html`, **81,080,480 bytes** |
| Exact matching HTTP | `http://127.0.0.1:43325/` |
| Artifact and HTTP SHA-256 before/after | `5caf68a6d4d6ad66401545afd3a773adf8ce0213e4fd3dccc7fe703a6b5484bf` |
| Ready marker SHA-256 before/after | `6d88d2c53a583193accbfd9a9c011c71f160a4548f17742edfedbf785c98a46f` |
| Frozen instructions SHA-256 before/after | `e279460638b452d9ecc399272f3da979a147bfdf16875b0cb88d521c12ff6185` |
| Actual executing verifier SHA-256 before/after | `628a89887db2dfe20b191c43b1129aa5fe85717b29e87ea198143a0686c60fda` |
| Source bundle | `/tmp/lunar-window-c12-source.bundle`, **12,328 bytes**, verified HEAD matches the published source |
| Source bundle SHA-256 before/after | `be0af876206b8ebdb55c7407281217bc670ad084406e0c7b02adb2a331cf5823` |
| Final complete report | `/tmp/solarreach-refinement-workflows-c12-r4/report.json` |

The runner now defaults to the actual C12 marker/instructions and directly freezes/verifies the published source bundle as well as source identity, artifact, HTTP bytes and executing script before/after. `--sourceBundle PATH` supports an explicit published bundle. No candidate, source, script or handoff was changed during any completed run. Supplementary whole-session integrity, source-command logs/hashes and the canonical-assessment object comparison are retained in the same directory.

Browser: **Google Chrome 149.0.7827.155**, Playwright **1.63.0-alpha-2026-08-05**, cached module `/home/luke/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs` (package SHA-256 `cc20d8407732820e1a334b890b204360aabf5e675ebfe0d2881bc2f54d32e681`). Host CLEVO-X2, Linux x64, AMD Ryzen AI Max+ 395, 32 logical CPUs, 130,148,806,656 bytes RAM. Isolated headless contexts; 1600×1100 baseline, 800/390-width document checks, reduced motion. Flags: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --disable-dev-shm-usage`. Software rendering and unflushed OS/disk caches are explicit limits, not hardware-performance evidence.

## R1 closure from actual student and teacher downloads

In **each** transport, the production importer supplies zero collecting area with otherwise identical mission/hardware inputs. Available generation evidence yields actual first-interval **0 W**, while a custom point at 25°N, 30°E under prepared-only terrain yields **null**, including null full-stay generated energy. The evidence/location scope changes explicitly; the complete mission object stays equal. Both captures have the same five solar givens, including an undefined normalized collecting factor. These givens alone cannot distinguish known zero from unavailable forcing.

The actual downloaded first student articles now differ inside the article: available evidence explicitly explains that zero collecting area/efficiency/retained fraction gives zero response even with an undefined normalized factor; unavailable evidence explicitly says **not to infer a numerical power response, including zero, from missing forcing**. Both articles retain native MathML. Exact teacher JSON/HTML separately show **0 m² / 0 W** for known forcing and **Unavailable (do not substitute zero)** for missing forcing. Every complete teacher answer is absent from all student text, including hidden content; student exports contain no scenario serialization, scripts or hidden answer carriers. Actual disconnected student and teacher documents make no HTTP requests.

The expanded check remains one named journey per transport, containing **both** adversarial captures; the 82 count is not inflated by embedded assertions. All other 41 journey names/order are retained from `b81243e`. Captured-givens preview, stable Question/Hint names, native reserve notation and semantic subscripts, actual requirement/evidence states/source notes, exact givens, HTML escaping, immutable capture and byte-identical student/teacher exports until explicit recapture, exact changed recapture scenario/key, unknown/stale/invalid handling and legacy `solarreach-teaching-v1` / `solarreach-teaching-v1-draft` keys all pass unchanged. The existing audience, replan, engineering and cancellation checks also pass.

Actual downloaded known teacher and unknown student renders were inspected along with the earlier known student render: the distinguishing evidence text is visible in the first question, native equations/legends and givens remain present, and teacher answers have their separate section. Agent inspection is not audience acceptance.

## Preserved C12 RED runs and diagnosis

| Actual C12 run | Result | Disposition |
| --- | --- | --- |
| `c12-r1`, 2026-11-14T23:11:20.502Z–2026-11-14T23:13:54.864Z | **80 pass / 2 fail / 0 unexecuted journeys** | The retained C11 assertion inspected only the teacher JSON `answer` string, whose prose is unchanged. C12's explicit zero-area explanation is instead visible in captured context in both real student and teacher documents. |
| `c12-r2`, 2026-11-14T23:14:48.456Z–2026-11-14T23:18:11.980Z | **81 pass / 1 fail / 0 unexecuted journeys** | Chrome `Page.captureScreenshot: Unable to capture screenshot` on the disconnected known-zero teacher HTML. That journey was interrupted before its missing-forcing counterpart; R1 closure was therefore not claimed for this run. |
| `c12-r3`, 2026-11-14T23:18:20.881Z–2026-11-14T23:21:52.124Z | **81 pass / 1 fail / 0 unexecuted journeys** | Same unchanged r2 verifier; R1 passes in both modes, but the Chrome capture error recurs on the HTTP evidence-exercise student download before that journey completes. |
| `c12-r4`, final run above | **82 pass / 0 fail / 0 unexecuted journeys or required embedded cases** | Complete repeat after the explicit document-paint readiness correction; every screenshot/content/zero-knowledge assertion passes. |

All directories `/tmp/solarreach-refinement-workflows-c12-r1`, `-r2`, `-r3`, `-r4`, corresponding `/tmp/refine-c12-workflow-r*.log`, failure DOM/screenshots and append-only findings are retained. These are fresh C12 runs, not renamed C11 results.

For r1 the same zero-area explanation regex now inspects the **complete actual teacher article**, retaining the numerical zero assertions and adding explicit student evidence, exact identical hardware/givens, null-for-missing-forcing, teacher/student separation and actual unknown-case downloads. This corrects the representation boundary; it does not waive the explanation requirement. A retained C11 actual student download still fails the strengthened explicit-context check, whereas the actual C12 download passes (`supplementary-r1-negative-control.json`). That retained-download comparison is a negative control, not a new C11 browser run. C11's historical product blocker below remains unchanged.

For r2 the exact failed file was independently opened in **three fresh fully disconnected contexts**; all original content assertions and full-page screenshots passed (`refine-c12-download-capture-probe.json`, script, log and three PNGs). The unchanged r3 repeat then reproduced the error on a different download. A tight probe with the real offline app open reproduced the original immediate-capture failure **1/12** times; foreground/font/two-animation-frame readiness produced **0/12** failures (`refine-c12-capture-readiness-probe.json`, script, log and 24 captures/attempt records). This supports a screenshot readiness race rather than a worksheet-content defect; the internal Chrome cause is not independently proven. The final runner explicitly brings each downloaded document to the foreground, waits for `document.fonts.ready` and two paint frames, then performs all original content assertions and the required full-page screenshot once. No retry, DOM/style/content change or assertion relaxation is used. The complete r4 repeat resolves this lane's readiness blocker; all RED histories remain.

## Fresh source checks, authority and explicit scope limits

Independently executed in the marker's actual C12 source checkout, **not** the older workflow worktree:

| Required owned check | Fresh result |
| --- | --- |
| `npm test` | **763 pass, 0 fail/cancelled/skipped/todo**, 2026-11-14T23:11:20.991449+00:00–2026-11-14T23:12:06.212040+00:00 |
| `npm run typecheck -- --incremental false` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0 |
| `npm run math:check` | PASS, **314 expressions**, exit 0 |
| Full workflow HTTP + browser-offline `file:` | **41 + 41 pass**, zero failed/unexecuted |
| Owned runner syntax, zero-warning ESLint, whitespace and retained history/names | PASS |

Source-command start/end times and exact commands are in `fresh-source-checks.json`; logs `/tmp/refine-c12-source-{tests,types,lint,math}.log` are copied and hashed in the final evidence directory. Installed cached slop-scan 0.3.0 reports **0 findings** in owned `scripts`; actual combined-source scan reports five inspected findings (three directory metrics, NASA wrappers preserving `cause`, scenario input validation returning null). These are outside owned source scope and supply no new owned blocker. An initial CLI invocation missing the `scan` verb was a tool-usage error, retained in `/tmp/refine-c12-workflow-scripts-slop.log`; corrected/final scan output is preserved. No tool or dependency installation occurred.

Read-only C11→C12 diff inspection confirms `world.maxCcdSubsteps = 8`, retained `numSolverIterations = 8`, fixed 120 Hz replay output, and the explicit model note. `lib/assessment.ts` (the canonical `evaluateScenario` authority), `lib/astro.ts`, `lib/planning-types.ts`, catalog and dataset pipeline have identical Git objects before/after that candidate change (`supplementary-canonical-authority.json`). Exported assessment identity remains **planning-4**. This workflow lane makes no numerical or constraint-meaning changes and does not promote illustrative contact physics into mission assessment authority.

Final evidence contains **128 PNGs** (including the successful isolated capture/readiness probes) and **182 numbered production inputs/downloads**. Each mode has zero page errors, zero HTTP error responses and zero unexpected console errors. The disconnected app has **zero unmocked HTTP attempts**; ordinary navigation, imports/exports, notebook reload and resource edits remain offline. Expected provider failure/disconnection/cancellation attempts and console errors are explicitly labelled in `report.json` / `network-summary.json`; no successful provider payload, telemetry or computed state is injected. Resource edits retain scene/canvas identity and do not refetch baseline assets.

Required owned checks are complete: **0 remaining / 0 unexecuted**. Separate-lane physical every-completed-frame clearance/all157/1×/COM/replay, native-200% normal-pointer and raster contrast/all-map/pole visual checks are **not executed by this lane**, and no counts from them are claimed here. Browser/source-review release decisions remain with Root and their assigned owners. Fresh web/offline builds and Horizons network validation are also **not run here**: Root supplied the immutable build, and this lane changes no ephemeris or geometry. Human audience acceptance, screen-reader testing, mission qualification and operational readiness are **unperformed**, not passes. No global C12 merge/release approval follows from this scoped workflow result.

Only `scripts/verify-refinement.mjs` and this report change in the repository. No app/config/generated/dependency edits, shared browser/server, Simulator, Metro, push or merge. Source GitHub remains private; hosting belongs to the teammate. Delivery: `/tmp/refine-c12-workflow-result.txt` and verified `/tmp/refine-c12-workflow.bundle` **since latest C11 commit `b81243ed28f433e2e69956f27fa43f18fedf302c`**; Root will fetch parent history and this new report.

## Preserved C11 and earlier history (verbatim)

Everything below is the unchanged historical report from `b81243e`, including its then-current C11 BLOCKED status and all C10/C8/C5/C3 evidence. It is not the current C12 result.

# Independent refinement workflow verification

Status: **C11 BLOCKED — zero-area teaching explanation fails in both transports**. Final full run: **80/82 PASS, 2 FAIL, 0 unexecuted**; all historical 72 workflow checks pass on C11. Fresh exact-source checks: **758/758 tests**, types, lint and 314 MathML expressions pass. F8 physics release remains blocked separately. C10 and earlier evidence remain historical; human and operational acceptance are unperformed.

Owned scope: `scripts/verify-refinement.mjs` and this report. No product source, dependencies, generated output, shared server/browser, push or merge is changed by this lane.

## C11 executed candidate — 14 November 2026

The published handoff was verified and executed from prepared commit `b65778a1b1a0c629f6e8a507c2a84a79f14ec265`. Only the two owned QA files change. **This is a completed run with an explicit product blocker, not a green candidate or physics release.** No application/source/configuration/generated/dependency edits, app server, shared browser, Simulator, Metro, push or merge were performed.

Final full HTTP plus fully disconnected `file:` repeat, `2026-11-14T23:02:21.998Z`–`2026-11-14T23:04:03.139Z`, exit **1**:

```sh
node scripts/verify-refinement.mjs --section all --mode both --output /tmp/solarreach-refinement-workflows-c11-r3 > /tmp/refine-c11-workflow-r3.log 2>&1
```

Each transport executed all **41** journeys: **40 pass, 1 fail**. All **36 original C10 journeys per transport** pass on these C11 bytes, plus four of the five added journeys. No check was omitted. This does not relabel C10's separate 72/72 history as C11 evidence.

| Frozen identity | Measured value |
| --- | --- |
| Actual combined source | `a31ca0577f3c1f811080be82994511bf082a29af` |
| Read-only source checkout | `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c11-final-check`, clean before/after |
| Candidate artifact | `/tmp/lunar-window-c11.html`, **81,080,046 bytes** |
| Exact matching HTTP | `http://127.0.0.1:43324/` |
| Artifact and HTTP SHA-256 before/after | `72fdb47684236426ec1816772f7421a65535a698b19dba1e50eb731d3258dcfe` |
| Marker SHA-256 before/after | `b40288d1509786f90e24d9818a2b3ccbec703565ffed84bc6fdb6e293a9d98d5` |
| Instructions SHA-256 before/after | `b06fc228afc79b3cf4cc6510b7259bdbcac8bfb8d603146506f6875c0429a610` |
| Executed verifier SHA-256 before/after | `44e14a38c656171840f2f4b5cd1e3ed5477a6c30587c46a52ef8999826434fbb` |
| Source bundle | `/tmp/lunar-window-c11-source.bundle`, verified HEAD matches the marker |
| Source bundle SHA-256 before/after | `b20b8f78fedc0b1f8fd511d1c21d3b7bff97ecb6c5c25fd4fdb15b132f6ccae9` |
| Final report and integrity supplements | `/tmp/solarreach-refinement-workflows-c11-r3/report.json`, `supplementary-integrity-before.json`, `supplementary-integrity-after.json`, `fresh-source-checks.json` |

### Confirmed blocker: C11 zero-area teaching explanation

`materials-zero-area-explanation-and-unknown-held-factor` fails identically in HTTP and disconnected file. Through the production importer, set only collecting area to **0 m²** on the real exported reference scenario, then capture and download teacher JSON and student HTML. The exported scenario remains exact; power is **0 W**, the combined source factor correctly remains **null**, and student HTML says **Unavailable (do not substitute zero)** without leaking the answer. The teacher correctly computes a **0 m²** irradiance gradient but explains:

> A zero can mean shadow, zero collecting efficiency or no active deployment; unavailable means the required evidence is missing.

It omits the actual captured **zero collecting area**, while efficiency in this capture is 0.3. The required explanation assertion is unchanged from prepared `b65778a`; it has not been waived or replaced with a generic zero-result check. Source location is the solar answer in read-only `lib/education-materials/index.ts`. The product owner must explicitly explain the captured zero area without inventing the unknown source/deployment factor, then publish a new immutable candidate for a complete repeat. This QA lane cannot edit that application file.

Both real teacher JSON downloads, student HTML, screenshots and failure DOM/stack are retained in the final directory; filenames contain `materials-zero-area`. Failure cleanup now always restores the real reference through the production importer, so later engineering bounds checks pass independently rather than inheriting the zero-area input. Notebook and draft preservation are still asserted during cleanup.

### Verified worksheet and workflow behavior

- Actual expanded **Captured givens for this question** preview has all captured solar inputs and explicit stable **Question**/**Hint** ARIA names. The combined visible-disk × incidence × active-deployment factor matches independent arithmetic from a separately downloaded production source interval.
- Downloaded student/teacher HTML are opened in fresh disconnected contexts. Exact given labels, values and units match the teacher JSON; native symbol text and semantic subscript nodes are checked separately from the reserve notation legend. There are no visible literal `M_reserve`, `E_B`, `C_B` or `f_reserve` strings. Reserve equation and all four symbol legends retain native MathML and subscripts.
- The actual student evidence exercise includes every independently exported constraint's readable name, required/optional status, exact state and explanation, plus every evidence source's kind, coverage and source notes. The current conditional/no-recorded-failure case stays conditional; prompts allow no recorded failure and preserve missing evidence.
- Escaped edited title/question/hint, no student answers even in hidden text, no full student scenario/scripts, teacher-only exact scenario/answers, immutable JSON and byte-identical HTML until explicit recapture, exact changed scenario on recapture, legacy IDs/storage keys, unsupported-coverage nulls, modal focus, cancellation, invalid/stale imports and original replan/engineering journeys all pass.

The final run retains **96 screenshots** and **170 numbered inputs/downloads**. The actual preview and printable student/teacher/zero-area renders were inspected. Browser/host/SwiftShader/cache limits are recorded in the report. There are zero page errors, HTTP errors or unexpected console errors. The disconnected app has **zero unmocked HTTP attempts**; downloaded documents likewise make no HTTP requests. Deliberate provider failure/cancellation requests and their expected console errors stay labelled; no successful provider data or telemetry is injected.

### Preserved RED runs and verifier corrections

All runs retain frozen artifact, marker, instructions and executing script before/after, along with logs, screenshots, actual downloads and clean source identity:

| Run | Full result | Interpretation |
| --- | --- | --- |
| `c11-r1` | **74 pass / 8 fail / 0 unexecuted** | Two schema-reader assumptions per transport, the actual zero-area explanation failure, and one downstream engineering key mismatch caused by missing failure cleanup. |
| `c11-r2` | **78 pass / 4 fail / 0 unexecuted** | Evidence-context and cleanup fixes pass; native symbols lack the reader's assumed `aria-label`, plus the unchanged zero-area failure. |
| `c11-r3` | **80 pass / 2 fail / 0 unexecuted** | All reader/cleanup issues resolved; only the zero-area explanation fails, once per transport. |

Directories are `/tmp/solarreach-refinement-workflows-c11-r1`, `-r2`, `-r3`; logs are `/tmp/refine-c11-workflow-r1.log`, `-r2.log`, `-r3.log`. Raw `givens` evidence remains recorded. Instead of expecting the C10 flat list shape, the verifier checks each article's exact value definitions separately from C11's added native legend, including native symbol text and subscript structure. Instead of requiring internal constraint IDs or one exact warning paraphrase in visible prose, it checks all actual named constraint/state/explanation tuples and every source note from the separate production export. These are representation corrections to the prepared reader, retaining the original behavioral checks and extending source-context coverage. The zero-area assertion is unchanged. No candidate input, numerical result, capture, telemetry or browser DOM is patched to produce a pass.

### Fresh exact-source and owned checks

Independently executed in the marker's actual read-only checkout, not the older verifier checkout:

```sh
npm test
npm run typecheck -- --incremental false
npm run lint
npm run math:check
```

Actual result: **758 tests, 758 pass, 0 fail/cancelled/skipped/todo**, nonincremental types and repository lint pass; **314** native MathML expressions pass. Source logs are `/tmp/refine-c11-source-{tests,types,lint,math}.log`, copied with hashes into the final evidence directory. The source remains clean at the exact full published commit. No geometry/ephemeris changes were made; no fresh Horizons validation or rebuilt artifact is claimed by this lane.

Owned script syntax, zero-warning ESLint, retained 36+5 journey names, staged/range whitespace and byte-identical C10-and-earlier report history checks pass. Cached installed slop-scan 0.3.0 reports **0 findings** in owned `scripts`; combined source scan reports five inspected findings: three directory metrics and two catch groups. NASA wrappers preserve `cause`; scenario validation returns null by its input-validation contract. No arbitrary tool/dependency installation was performed.

F6 expanded-contact raster contrast, F7 actual native-zoom framing/interactions, per-owner atlas/globe lifecycle review and **F8 physical contact** remain separately owned. The C11 handoff explicitly keeps F8 open; this workflow result does not close it or imply landing qualification. Source unit tests are not visual or operational acceptance. C12 will require final web/offline verification after the physical fix.

Primary handoff: `/tmp/refine-c11-workflow-green-result.txt` and `/tmp/refine-c11-workflow-green.bundle` **since b65778a**; despite the requested filenames their result is explicitly **BLOCKED**, never green. Compatibility handoff: `/tmp/refine-c11-workflow-result.txt` and `/tmp/refine-c11-workflow.bundle` since `bdd6221`. Pre-run handoffs were preserved as `.before-run-b65778a`; all Git/preparation history and older C10/C8/C5/C3 evidence remain intact.

## Historical C11 preparation checkpoint — b65778a

The following pre-run checkpoint is preserved as history and superseded by the executed candidate report above.

The user assigned only this report and `scripts/verify-refinement.mjs`, starting at `bdd6221d5d177d5d2b9a9ca9320412d7569bfb41`. The C11 ready marker and instructions were absent during the initial 30-second bounded wait. No previous artifact is substituted. Independent audit findings concerning worksheet givens/native legends, stalled globe abort and expanded contact styling are candidate-owner responsibilities; this workflow lane does not claim their fixes before verifying published C11 bytes. Physical/framing and actual rendered contact pixels remain with the visual lane.

The runner now requires the actual published `sourceCheckPath` and full 40-character `sourceCommit`, checks that read-only checkout's identity and cleanliness before/after, and reads catalog and official archived inputs there. Artifact, marker, instructions and executing verifier are frozen before/after; source checkout and verifier checkout are separately recorded. The prepared runner retains all 36 C10 journey names per transport and adds five (41 per transport, **82 expected**): captured-givens preview with explicit stable Question/Hint ARIA labels; combined visible/incidence/active-deployment factor matched to a separate production source-interval export and student HTML; actual required-constraint states, outcome and source warnings in the student evidence exercise; native semantic reserve equation and all four legend symbols; and zero collecting area with an unknown combined factor and a correct zero-area explanation. Existing unsupported-coverage nulls, escaped editable text, no hidden answers/full scenario, immutable capture/recapture, legacy IDs and notebook/storage preservation remain enforced. All scenario writes still use the production importer; no DOM, telemetry, local-storage or successful provider payload is injected.

**Explicit blocker:** neither `/tmp/solarreach-refinement-c11-ready.json` nor `/tmp/refinement-c11-qa-instructions.txt` was published during the initial 30-second wait or subsequent preparation checks. Consequently no C11 source identity, artifact, HTTP/file workflow result, downloaded C11 document, or source test count can be verified. The expected 758 source tests are **unperformed**, not a pass. The additional assertions are prepared but not validated against a published C11 schema/render. C10's 72/72 and 752/752 are historical only.

Prepared owned checks pass: `node --check scripts/verify-refinement.mjs`, scoped ESLint with zero warnings, repository lint, whitespace checks, and a retained-name/history comparison against `bdd6221`. Installed cached `slop-scan` 0.3.0 scans `scripts` with **0 findings** (`/tmp/refine-c11-workflow-scripts-slop.log`). These are harness checks, not C11 product acceptance.

Resume when both files are published, reading their actual source identity without editing that checkout:

```sh
node scripts/verify-refinement.mjs --section all --mode both --output /tmp/solarreach-refinement-workflows-c11-r1 > /tmp/refine-c11-workflow-r1.log 2>&1
```

Independently run `npm test`, nonincremental types, lint and `math:check` in the marker's read-only `sourceCheckPath`; report its actual count and source cleanliness before/after. Freeze published artifact/marker/instructions and executing verifier, retain every RED run in a unique directory, then replace this blocker with measured C11 evidence. Result handoff: `/tmp/refine-c11-workflow-result.txt`; bundle since `bdd6221`: `/tmp/refine-c11-workflow.bundle`. No app/config/generated edits, server, shared browser, Simulator, Metro, push or merge.

## C10 final dark candidate

The new marker and instructions were polled every 20 seconds until published. C10 instructions arrived first, then the marker. No historical C8 artifact was run as new acceptance. Root supplied the combined source, generated artifact and HTTP server; this lane used isolated Chrome contexts and changed only its two owned repository files.

Full run **14 November 2026, 22:26:40.590–22:28:32.819 UTC**, exit **0**:

```sh
node scripts/verify-refinement.mjs --section all --mode both --output /tmp/solarreach-refinement-workflows-dark-c10-r1 > /tmp/refine-workflow-dark-c10-r1.log 2>&1
```

| Identity | Measured value |
| --- | --- |
| Combined source commit | `8ae902d40f0f196b065b20d57bef1602a5ec73ae` |
| Immutable artifact | `/tmp/lunar-window-c10.html`, **81,076,979 bytes** |
| Matching HTTP | `http://127.0.0.1:43323/` |
| File and HTTP SHA-256 before/after | `88ced1ea1994174450fe0fe87d640006a4b01482dbb1986efd337a6625cadd69` |
| Marker | `/tmp/solarreach-refinement-dark-ready.json`, 395 bytes |
| Marker SHA-256 before/after | `7387b22c2ce9017dd9aea14735db52d547274b3157a24f39baf8d247318b0643` |
| Instructions SHA-256 before/after | `9bd8bd4485884490fa82ac49f614dfe4b359826269c8582d093f4621f9c7c635` |
| Executed verifier SHA-256 before/after | `57c4795d984a4c3f874bee49225df9fd1dd7f464371cc768f8c9abd756fc7d0a` |
| Verifier checkout before owned commit | `2f1f473` (separate from combined source) |
| Source bundle | `/tmp/lunar-window-c10-source.bundle` |
| Bundle SHA-256 before/after | `e2db721317aa95bc06f6429a0f8b6cdac57a0288759b87bc7baec5fb24d37d90` |
| Full report | `/tmp/solarreach-refinement-workflows-dark-c10-r1/report.json` |
| Source/verifier integrity supplement | `/tmp/solarreach-refinement-workflows-dark-c10-r1/source-and-verifier-integrity.json` |
| Log and findings | `/tmp/refine-workflow-dark-c10-r1.log`, `/tmp/refine-workflow-qa-findings.txt` |

Both transports used fresh 1600×1100 reduced-motion contexts, Chrome **149.0.7827.155**, cached Playwright **1.63.0-alpha-2026-08-05**, the recorded SwiftShader flags and CLEVO-X2 hardware described by the report. There are **76 screenshots**: one for each of 72 checks and four full-document screenshots of the actually downloaded student/teacher HTML. The directory also retains 154 numbered input/download files. Raw marker and instruction snapshots before/after are preserved beside the report. This is software-rendered functional evidence, not hardware performance or physical qualification.

### Retained and new journeys

All original **58** checks and their meaningful assertions remain. The bootstrap screenshot alone allows 30 seconds instead of 12; application readiness, page/network/console errors and other screenshot deadlines remain enforced. There was no C10 RED run or application/harness repair during this run. Original C3 and C8 r1 RED histories below remain unchanged.

The additional **14** checks are seven journeys in each transport:

- Default Lunar Window title/header, actual dark body `rgb(23, 25, 28)` and pale text `rgb(243, 241, 235)`. At 1600, 800 and 390 CSS pixels, document and body widths equal the viewport. Every completed journey also checks document horizontal overflow. These sampled theme and bounds checks are not a WCAG audit or mission assessment.
- In Educator → Teaching studio → **Create a problem set and teaching materials**, uncheck all five goals and require capture to disable; choose four goals, edit the title and explicitly capture. Require no export before capture. Teacher JSON version **1** must contain the complete exact scenario, exact assessment key/dataset/model, ISO arrival and exclusive end, source step and all selected answers. Raw question givens must match separately downloaded production decision results; independent reserve-floor, reserve-margin, terrain-energy-difference and contact-percentage arithmetic is checked.
- Edit the actual question and hint fields. Save separate real student HTML, teacher HTML and teacher JSON browser downloads. Open both HTML downloads in separate disconnected contexts: four articles, exact givens, site/identity/readable UTCs and **two native MathML equations** with the MathML namespace must match. Title, prompt and hint containing literal tag-like text, quotes and ampersands stay escaped; no injected element appears. Student files contain no answer text, hidden elements, scripts or serialized full scenario. Teacher HTML contains all answers; teacher JSON deliberately includes answers and the exact scenario.
- Apply the controlled array-height candidate through the studio's actual **Apply candidate to navigator** button. Pending title/topic edits and the navigator change must preserve the entire edited captured JSON and **byte-identical student and teacher HTML**. No hidden state is injected.
- Explicit **Replace capture with current scenario** must capture the changed array height, produce a different exact scenario key and apply the pending title/five-topic choices. Dates remain identical. Its scenario/key subsequently match a separate production navigator export.
- Switch Public/Educator and verify the complete active scenario/key are unchanged. Saved notebook JSON and the existing `solarreach-teaching-v1` / `solarreach-teaching-v1-draft` records remain exactly intact, including the legacy edited conclusion, draft baseline, controlled value and prediction. Reopen and check the actual fields. Restore the reference through the production decision importer for later retained checks.
- Import a deliberate real unsupported-coverage point at 25°N, 30°E with prepared terrain selected through the production control. Fresh decision and teaching exports must agree on its exact scenario/key and null terrain generation/minimum storage. JSON keeps null; student/teacher prose keeps **Unavailable (do not substitute zero)**. Restore the reference explicitly and verify notebook/draft preservation again.

The tested supported case was Connecting Ridge, **14 November 2026 00:00 UTC → 15 November 2026 00:00 UTC exclusive**, 24 hourly intervals. Real captured givens included 4 m² area, 0.3 efficiency, 0.15 loss fraction, 1361 W/m² irradiance, 10,000 Wh capacity, 0.2 reserve fraction and 10,000 Wh minimum storage. Independent floor/margin are **2,000 Wh / 8,000 Wh**. Terrain and sphere generated energy were each **33,317.28 Wh**; both contact fractions were **0**. These are the captured model outputs, not new measurements or universal site claims. The different unsupported-point case retained unknown terrain values.

Screenshots of the dark Public view and the actual printable student/teacher downloads were visually inspected. Printable exports retain their light paper layout; app theme checks apply to the navigator. Agent visual inspection is not human acceptance. This lane does not claim F1/F4 camera/contact verification, actual native 200% zoom, fine hazard evidence, operational approval, a full contrast audit or screen-reader testing; those physical/visual checks remain assigned separately.

### Network and errors

Both app transports recorded **zero page errors, zero HTTP error responses and zero unexpected console errors**. HTTP fetched its standalone document twice. Disconnected ordinary app journeys issued **zero HTTP requests**. All four downloaded-document inspections issued zero HTTP requests and zero page errors. Each app transport deliberately exercised four failed/aborted provider requests, including one actual browser-disconnected request without a response mock. The two expected console errors per transport remain labelled (`ERR_FAILED`, `ERR_INTERNET_DISCONNECTED`). No successful external provider payload, allocation or mission approval is claimed.

### Fresh exact-source and owned checks

Source checks ran independently in Root's read-only `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-dark-final-check`. Its actual Git HEAD, source-bundle HEAD and published marker all match **8ae902d40f0f196b065b20d57bef1602a5ec73ae**. The checkout was clean before and after. No source, dependencies or compiler configuration changed. These are fresh executions on the combined C10 source, not the old verifier checkout's counts:

```sh
npm test
npm run typecheck -- --incremental false
npm run lint
npm run math:check
```

All pass: **752 tests, 0 failed, 0 skipped**, nonincremental types, lint, and **314 native MathML expressions**. Logs: `/tmp/refine-workflow-dark-c10-source-{tests,types,lint,math}.log`. No build or fresh Horizons run was performed by this lane; the lane changes no ephemeris or numerical model. Root's build claims in the supplied instructions remain distinct from these independently executed checks.

Owned checks also pass: `node --check scripts/verify-refinement.mjs`, explicit harness ESLint with zero warnings, repository `npm run lint`, and working/staged whitespace checks. Owned lint log: `/tmp/refine-workflow-dark-c10-owned-lint.log`.

Cached installed `slop-scan` **0.3.0** was found and run without installing packages. The C10 source scan reports five inspected findings: three directory fan-out metrics and two catch groups. NASA load wrappers retain error causes; scenario validators deliberately return null on rejected inputs. No owned implementation finding is reported. A corrected directory scan of `scripts` reports **0 findings**. The first attempted file-target invocation was rejected because this CLI requires a directory; its tool-error log is retained, not an application RED. Logs: `/tmp/refine-workflow-dark-c10-{source,owned,scripts}-slop.log`. No claim is made that the entire application is free of technical debt.

## C8 final rerun

Waited until the published marker advanced from C5 to C8 (C7-or-later gate), then reread `/tmp/refinement-qa-instructions.txt`. Root owns the F1 site-animation/Lander, F2 disclosure/inspector painting and F3 Teaching-axis corrections. This lane's 58 workflow checks do not replace the separate visual/physical lane's exact F1 regression, pixel contrast, chart-overlap or playback/contact evidence.

Fresh full run **14 November 2026, 21:13:14.393–21:15:57.794 UTC**, exit **0**:

```sh
node scripts/verify-refinement.mjs --section all --mode both --output /tmp/solarreach-refinement-workflows-c8-final-r2 > /tmp/refine-workflow-qa-c8-final-r2.log 2>&1
```

| Identity | Measured value |
| --- | --- |
| Artifact source commit | `6c9227a03597c33169dd05433aec79adc7048a48` |
| Immutable HTML | `/tmp/solarreach-refinement-c8.html`, 81,356,215 bytes |
| Exact matching HTTP | `http://127.0.0.1:43322/` |
| File and HTTP SHA-256, before and after | `f24d7f64851c00e542ba747db4e8ee2213b5e0647d9049d51989ff39f934f623` |
| Executed verifier SHA-256 | `41f6e42e583419165ddf62a8336ccd78e4ab60945cb24a40f01197f4f9882e53` |
| Verifier checkout | `900a21c4051aa596c4bb585bb2748fdc58f4484d` (preserved C5 lane commit; separate from artifact source) |
| Full report | `/tmp/solarreach-refinement-workflows-c8-final-r2/report.json` |
| Log | `/tmp/refine-workflow-qa-c8-final-r2.log` |
| Screenshots | 58 PNGs in the report directory, one per executed check |

The marker and instructions remained unchanged. Chrome 149.0.7827.155 and cached Playwright 1.63.0-alpha-2026-08-05 used the same isolated 1600×1100 reduced-motion contexts and software-rendering flags documented below. No other lane's counts are included. Root's reported 723 unit tests and 30 focused tests are not fresh unit executions by this lane.

All 29 journeys documented below executed in each transport. Exact state/numerical/source/focus assertions, independently checked 1020 W illustrative arithmetic, complete zero-capacity versus unknown cases, cancellation, notebook/study persistence, same-scene/resource-input focus and 58-check completeness remain enforced. Imports use the production file-input controls; exports use production buttons and actual browser downloads. No forced clicks, DOM/state injection, application engine imports or fabricated provider success are used.

Both contexts recorded **zero page errors, zero HTTP error responses and zero unexpected console errors**. HTTP fetched the standalone document twice; disconnected ordinary journeys issued **zero HTTP requests**. Each transport deliberately exercised four failed/aborted provider requests, including one actual browser-disconnected request with no response mock. The two expected console errors per transport (`ERR_FAILED`, `ERR_INTERNET_DISCONNECTED`) remain explicitly labelled in the report. No successful external provider response or operational evidence is claimed.

### C8 r1 observation and readiness correction

The unchanged C5 verifier first ran the complete C8 suite with the same `--section all --mode both` arguments and output `/tmp/solarreach-refinement-workflows-c8-final-r1` (log `/tmp/refine-workflow-qa-c8-final-r1.log`): **57 pass / 1 fail / 0 unexecuted**, exit 1. Only the HTTP immediate prediction-field read on Studio reopen failed, returning blank. The identical disconnected check and both reload-persistence checks passed. Findings were appended immediately to `/tmp/refine-workflow-qa-findings.txt`; r1 report, screenshot, DOM and downloads remain preserved.

The read previously followed native-dialog focus without waiting for passive notebook restoration. The sole harness change waits for the restored notebook export control to become enabled, then still requires the exact prediction and complete exported JSON, including the legacy edited conclusion; reset must preserve that exact JSON. It does not wait merely for a desired prediction string or skip failed checks. The final r2 reopened values already matched at first read, with readiness checks taking 8 ms HTTP / 7 ms file; exact notebook exports, reset preservation and reload all passed. This supports a readiness race in r1 rather than demonstrated data loss. No new product defect is confirmed by this lane.

The C8 Public guidance, Teaching notebook/lesson and complete explicit-zero engineering screenshots were inspected. They retain paired labels and explicit assumptions. This is scoped agent inspection; it is not final F1–F3 visual verification, screen-reader testing, human acceptance or operational qualification.

### C8 fresh owned checks

After the green browser run:

```sh
node --check scripts/verify-refinement.mjs
./node_modules/.bin/eslint scripts/verify-refinement.mjs --max-warnings 0
npm run typecheck -- --incremental false
npm run lint
git diff --check
git diff --cached --check
```

All pass. Logs: `/tmp/refine-workflow-qa-c8-owned-lint.log`, `/tmp/refine-workflow-qa-c8-types-final.log`, `/tmp/refine-workflow-qa-c8-lint-final.log`. Only the two owned files changed. No app source, dependencies, build, server, generated HTML, push or merge changed in this lane. Full unit testing and the core planning run below remain explicitly historical executions. The final gate covers the exact C8 bytes above; actual human and operational acceptance remain unperformed.

## C5 preserved green evidence

Historical status: **C5 scoped workflow gate PASS — 58/58**, 29 HTTP and 29 disconnected-file checks, zero failed or unexecuted. C3's confirmed focus-return defect was fixed in C5 and verified in both transports. Human acceptance was unperformed. The original C5 evidence and C3 red history below have not been relabelled as C8.


Run completed 14 November 2026, **20:57:30–20:58:53 UTC**, exit 0:

```sh
node scripts/verify-refinement.mjs --output /tmp/solarreach-refinement-workflows-c5-final-r1
```

| Identity | Measured value |
| --- | --- |
| Artifact source commit | `1e1b0b2babde26a6334c7a3aec2f8a08e03b80bd` |
| Immutable HTML | `/tmp/solarreach-refinement-c5.html`, 81,355,930 bytes |
| Exact matching HTTP | `http://127.0.0.1:43321/` |
| File and HTTP SHA-256, before and after | `d64367b5f43b80ccca5ec4ad1b3473df4e433d1948fdc0f86ce798b1a1795111` |
| Executed verifier SHA-256 | `704b4d3fb1661bcfc884e850cce4c396ae97281832d7b657f6455433caad4ef2` |
| Full report | `/tmp/solarreach-refinement-workflows-c5-final-r1/report.json` |
| Log | `/tmp/refine-workflow-qa-c5-final-r1.log` |
| Screenshots | 58 PNGs in the report directory, one per executed check |

Marker and instructions remained unchanged throughout. The verifier checkout was `a45f5e56c8596cfc74a685d4fc649846c437d571`; it is recorded separately from the later artifact source, which Root built and published. These results apply to the measured C5 bytes. Root's reported 721 integrated unit tests are not this lane's fresh unit count.

Environment: CLEVO-X2, Linux x64, AMD Ryzen AI Max+ 395, 32 logical CPUs, 130,148,806,656 bytes RAM; Chrome **149.0.7827.155**, cached Playwright **1.63.0-alpha-2026-08-05**. Exact module/package hash and launch flags are in the report. Each transport started in its own fresh context at 1600×1100, reduced motion enabled. Production reloads deliberately tested local persistence.

### Network and errors

Both contexts recorded **zero page errors, zero HTTP error responses and zero unexpected console errors**. Ordinary disconnected navigation, reload, imports, exports, plots and scene edits made **zero HTTP requests**. There were four explicitly requested provider failure/cancellation attempts in each transport: one route-aborted failure, one real browser-disconnected fetch, and two held/cancelled requests. All failed/aborted, with zero successful external HTTP responses. The two real console messages per transport (`ERR_FAILED`, `ERR_INTERNET_DISCONNECTED`) and all request failures remain in the report with their test labels. The report's `mock` field labels these transport tests; the disconnected fetch is explicitly labelled **no response mock**. No live provider success, booking or forecast is claimed.

The browser HTTP context fetched the standalone document twice (initial navigation and persistence reload). Resource edits retained the same scene instance/canvas and issued no new catalog/map/terrain/model requests. The file context remained browser-offline throughout.

### Verified outcomes

All 29 journeys listed by the runner executed in each transport, including fresh Public dismissal/restore; exact audience-state preservation; independent replan captures, quick date/site controls, invalid inputs, separate UTCs/non-overlap, actual curves/tables/exported deltas, scan/cancel and exact failure state/time; real Teaching prediction/reveal/native math/current-versus-illustrative units, old-notebook editing/reopen/reload, initially empty study and explicitly agent-labelled export; all station selections, official archived production import, raw source/date/units/identity rejection, missing coverage versus explicit zero, complete 90°-cutoff shortfall, stale evidence, finite-case run/cancel/export and labelled provider failures.

Screenshots of Public guidance, synchronized replanning, the Teaching derivative lab and the complete zero-capacity chain were also visually inspected. They show the warm map-first hierarchy, distinct paired model labels, native equations and explicit conditional/assumption copy. This is scoped agent inspection, not human audience or accessibility acceptance.

The runner reads `/tmp/refinement-qa-instructions.txt` before execution and requires `/tmp/solarreach-refinement-final-ready.json` with `artifactPath`, `artifactSha256`, `sourceCommit` and `url`. It independently hashes the local file and HTTP response, requires identical bytes, opens fresh isolated Chrome contexts for HTTP and disconnected `file:`, and checks the marker/file again at completion. It never uses the earlier R7 as a refinement candidate.

Run from the worktree:

```sh
node scripts/verify-refinement.mjs --output /tmp/solarreach-refinement-workflows-final
```

The installed cached Playwright module and `/usr/bin/google-chrome` are defaults; explicit `PLAYWRIGHT_CORE_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` overrides are supported. Launch flags match the existing physical verifier: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --disable-dev-shm-usage`. This is software rendering, not hardware performance evidence. `--section public|replan|teaching|engineering` and `--mode http|file` allow targeted retests; they do not constitute the complete final gate.

## Method and expected results

All scenario and engineering writes use normal production file import or pointer/keyboard controls. Scenario snapshots come from production decision downloads. The runner imports no application calculation modules, copies no numerical helpers, calls no application evaluation functions, changes no DOM/state and uses no forced clicks. Read-only DOM attributes establish native dialogs, focus and scene identity. Every check saves a screenshot; downloads, imported fixtures, full JSON report and failure DOM text remain in its output directory. Failures append to `/tmp/refine-workflow-qa-findings.txt`; red history is retained.

- Public: fresh current-versus-stay guidance, paired terrain/sphere context, dismissal/restore, and exact scientific input preservation through audience changes.
- Replanning: independent reference/candidate captures; elapsed alignment with separate UTCs; disabled non-overlap UTC; actual curves and paired tables; browsing without applying; exact open/save; real invalid values, bounded grid/cancellation, unknowns and first-failure inspection.
- Teaching: native modal, Escape/focus return, prediction/capture/one-input reveal, actual tables/plots/native equations, separate illustrative/current constants and units, existing notebook export/reopen/reload without concurrent overwrite. Empty study starts at zero; recorded walkthroughs are explicitly agents. Blank and invalid forms are exercised.
- Engineering: all three terrestrial stations, no automatic provider requests, native modal, missing evidence and unquantified bounds, production import of the committed raw official Goldstone observer response, source/date/units/identity validation, explicit sourced assumptions, incomplete coverage, missing requirement versus computed shortfall, exact export/import, stale binding, bounded case run/cancel/export and labelled provider transport failure/cancellation.
- Resource edits: same scene identity, preserved input focus, no baseline catalog/map/terrain/model refetch.

Independent hand calculations: the illustrative solar constants give `4 × 0.30 × (1 − 0.15) = 1.02 m²`, hence `1020 W` at `1000 W/m²`. The station shortfall uses the committed official observer day **2026-11-14 00:00 UTC–2026-11-15 00:00 UTC**, with maximum sampled elevation below 31°. An explicitly assumed 90° station minimum excludes every sample; therefore available contact and delivered capacity are exactly zero regardless of positive configured rate. The complete chain with no data requirement remains incomplete; with an entered 1-bit requirement it is a conditional shortfall. These deliberate assumed inputs are not booking, forecast weather or operational evidence.

Provider mocks only abort or hold transport. No fabricated successful provider payload is returned or called live success. Expected mock failures remain separately listed in actual network/console logs. Disconnected ordinary journeys must issue zero unmocked HTTP requests. Physical Follow/contact and framing are assigned to separate lanes; this report does not borrow their counts.

## Fresh non-browser checks

At source checkout `a45f5e5` (the contract checkpoint plus the scientific-review documentation commit), the existing core planning verifier was executed with `node_modules/.bin/tsx scripts/verify-planning.mts --output /tmp/solarreach-refinement-workflow-core-planning`. It returned exit 2, **24 pass, 0 fail, 1 incomplete, 1 skipped**. Its analytical status is PASS; scientific validation remains INCOMPLETE. This is a fresh execution of the existing suite, separate from this lane's future browser counts. The initial invocation without its required `--output` argument only returned usage and is not counted as a test run.

Prepared runner passes `node --check`, scoped ESLint and `git diff --check`. Fresh full `npm test`: **683/683 pass**, zero failed/skipped/cancelled; `npm run typecheck -- --incremental false` and full `npm run lint` pass. Full-suite log: `/tmp/refine-workflow-qa-npm-test.log`. After the final C5 browser run, `node --check scripts/verify-refinement.mjs`, full `npm run typecheck -- --incremental false`, full `npm run lint` and working/staged `git diff --check` all pass. Only the two owned files are staged/committed. No source update, build, server, dependency installation, push or merge was performed by this lane.

The existing `verify-contact-consistency.mjs` is not counted as a fresh run: it depends on the former comparison entry/legacy demo trajectory, while this phase requires the unified replan workflow. This lane checks masked contact against exported assessments and the engineering chain; the separate physical lane owns full Follow/contact. No counts from that lane or Root's integrated unit suite are borrowed here. `slop-scan` is unavailable/unconfigured; no package or tool was installed.

## C3 red history and targeted evidence

C3 source: `ae306b9ad0ae4cf87b6218cb268609f005d882ca`. Artifact `/tmp/solarreach-refinement-c3.html`, SHA-256 `5dd3170275727a2ac67c14dbeb45d83f494353a017811c78e787ee996b31c290`, exact matching HTTP bytes at `http://127.0.0.1:43320/`. Measured file/HTTP hashes and marker remained unchanged during the completed runs below.

Confirmed P2: Teaching studio Escape loses return focus. Fresh isolated Chrome, normal Educator → Teaching studio → wait for real Close action → Tab focuses Close teaching studio → Escape removes the dialog. After 400 ms, `:focus` has zero elements and the opener is not focused. Evidence: `/tmp/refinement-c3-escape-focus.json` and `.png`; this is distinct from the initial harness mistake that required a focused descendant when the native dialog itself legitimately held focus. Root accepted ownership of the fix; C3 is not final green.

Separate targeted C3 HTTP runs, without aggregating duplicated checks:

| Evidence directory under `/tmp/` | Actual result | Disposition |
| --- | --- | --- |
| `solarreach-refinement-workflows-c3-replan-r3` | 9 pass / 0 fail | All scoped replan journeys green, including actual scan/cancel, delta arithmetic from separate exports and exact failure state/time. |
| `solarreach-refinement-workflows-c3-teaching-r4` | 9 pass / 1 fail | Sole failure is confirmed P2. Prediction/reveal/save, real plots/native equations/gradient units, bidirectional old-notebook edits, reload persistence and agent-only study capture/export pass. |
| `solarreach-refinement-workflows-c3-engineering-r2` | 13 pass / 1 harness fail | Complete zero-capacity chain, missing coverage/zero distinction, bindings, finite cases, provider failures/cancel and persistent scene pass. A correctly rejected km→metres corruption used the message `Expected finite value in [300000, 500000]`; the harness expected narrower wording. Corrected rejection plus retained-state checks await final run. |

Earlier C3 `r1`, `replan-r2`, `teaching-r2/r3` directories retain all red screenshots/DOM/reports. Equivalent plain-language conditional copy, exact-label matching on option-rich native labels, a section-relative heading locator, textarea labels and lazy native-dialog focus were harness corrections. Numerical results, exact scenario identities, required unknowns, focus-return requirement and source validation expectations were not weakened. Subsequent dependent errors after a closed Studio are not counted as extra product defects. The complete final runner expects 29 checks per transport (58 for HTTP + disconnected file); missing scoped checks cannot be reported green.

## Limits

No human audience, screen-reader, real-device, 200% native zoom, continuous uncertainty, source-frame qualification, station booking, forecast weather, mission readiness or operational acceptance is claimed. Fresh browser contexts do not flush OS/server/disk caches. Physical Follow/contact, detailed framing/contrast and other viewport sizes remain separate-lane work. This gate covers the exact C5 artifact above and does not certify subsequent bytes.


# C14 independent refinement workflow verification — 15 November 2026

**C14 SCOPED WORKFLOW GATE GREEN: 82/82 PASS (41 HTTP + 41 disconnected file), 0 failed, 0 unexecuted, 0 owned blockers.** Fresh actual-C14-source checks: **763/763 tests, 0 failed/cancelled/skipped/todo**; nonincremental types, full lint and **314 MathML expressions** pass. The preceding C13 and earlier reports, candidate identities and original RED results remain verbatim historical evidence; this appended result does not relabel them or override separate visual/physical gates.

Execution: **2026-11-14T23:58:04.250Z–2026-11-15T00:01:02.274Z**, exit 0, based on `77b8b97d239ad1427bc4ab16770ca792fa610128`. Only four candidate defaults changed in the verifier; every assertion body is byte-identical to C13 and all 82 journey names/order match (`unchanged-check-contract.json`). The complete run required no retry or assertion relaxation.

```sh
node scripts/verify-refinement.mjs --marker /tmp/solarreach-refinement-c14-ready.json --instructions /tmp/refinement-c14-qa-instructions.txt --sourceBundle /tmp/lunar-window-c14-source.bundle --section all --mode both --output /tmp/solarreach-refinement-workflows-c14 > /tmp/refine-c14-workflow.log 2>&1
```

| Frozen identity | Actual value, unchanged before/after |
| --- | --- |
| C14 source | `b2a5925848bc710c25e4d2ba42dc015df286014a` |
| Read-only source | `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c14-final-check`, clean; all 523 tracked-file hashes unchanged |
| Artifact / HTTP | `/tmp/lunar-window-c14.html`, **81,081,298 bytes** / `http://127.0.0.1:43327/` |
| Artifact + HTTP SHA-256 | `423938c5b7d76f762541d3c113e75ccb87f5c68ae144a33211ff235365a9b59f` |
| Marker SHA-256 | `3c06f7760ca0ce0ff678ad51f9547fb29130b1626da7b0ab3b35bafabd7d8879` |
| Instructions SHA-256 | `cc3647b2615aed3fc7f66cc59c0754c5010756a5ff4c99a67f94693c49401f71` |
| Executing verifier SHA-256 | `0d7a454ac6306ac59a374b65c2ea0a879cc39a6c3a177c42a2f7a5bd66dd0e90` |
| Published source bundle | `/tmp/lunar-window-c14-source.bundle`, **8,804 bytes**, published head verified |
| Source-bundle SHA-256 | `1b7269a71a23414c0b297461670993fd64aea773df668e37e6b62dcbf4d01d3a` |

Full report: `/tmp/solarreach-refinement-workflows-c14/report.json`; before/after script, artifact, marker, instructions and source-bundle copies are retained alongside it. Supplementary integrity, source-command exits/log hashes, network summary and unchanged-contract records are in that directory, with **102 PNGs and 182 numbered production input/download files**. All 308 frozen C13 evidence files remain unchanged. The full preceding report is an exact byte prefix of this file.

All original audience, immutable capture/explicit recapture, held-scenario comparison, invalid/stale evidence, provider failure/cancellation and persistence checks remain. Actual student/teacher exports pass captured givens, semantic native symbols, known zero versus unavailable forcing, answer separation including hidden content, escaping and exact captured input checks. Agent inspection of the actual known-zero/missing-forcing student downloads and disconnected native teacher download confirms distinct explanations, visible native equations/givens and separate teacher answers. No application numerical helper, injected state, forced click or fabricated successful provider payload was used.

Both transports have **0 page errors, 0 HTTP error responses and 0 unexpected console errors**. Ordinary disconnected use, including downloaded documents, issues **0 unmocked HTTP requests**. Each transport retains four deliberately failed/aborted provider requests and two expected console errors, explicitly labelled; there is no claim of live provider success. Resource edits retain scene/canvas identity, focus and avoid baseline asset refetch.

`c13-c14-byte-identity.json` independently confirms the two complete embedded data/application script bodies are byte-identical between C13 and C14. Canonical assessment, astro, planning types, touchdown physics, pipeline and catalog Git objects are identical. The only product-source change is `app/globals.css` chart-axis-label margin from **−5 px to 8 px**; the separate visual lane owns overlap/framing acceptance. No physics, geometry, ephemeris or constraint meaning changed; Horizons was not rerun and no fresh Horizons pass is claimed.

Owned verifier syntax, zero-warning ESLint, whitespace and cached installed slop-scan pass (**0 script findings**, no installation). Browser/runtime/host/flags remain recorded in `report.json`: isolated Chrome contexts with SwiftShader software rendering and unflushed caches. Builds were supplied by Root and were not rerun here. Human audience, screen-reader, real hardware/GPU performance, qualified scientific validation, continuous uncertainty/source-frame qualification, station booking, operational/mission readiness and overall release acceptance remain **unperformed or outside this lane**. Separate C13 physical results remain C13; no physical or visual counts are borrowed.

Only `scripts/verify-refinement.mjs` and this report change in the repository. No app/config/generated/dependency edits, children, app server/shared browser, Simulator/Metro, push or merge. Delivery: `/tmp/refine-c14-workflow-result.txt`; `/tmp/refine-c14-workflow.bundle` since `77b8b97d239ad1427bc4ab16770ca792fa610128`.


# C15 independent refinement workflow verification — 15 November 2026

**C15 SCOPED WORKFLOW GATE GREEN: 82/82 PASS (41 HTTP + 41 disconnected file), 0 failed, 0 unexecuted, 0 owned blockers.** Fresh actual-C15-source checks pass: **763/763 tests, 0 failed/cancelled/skipped/todo**, nonincremental types, full lint and **314 MathML expressions**. The complete preceding reports, frozen candidate proofs and every historical RED remain verbatim. This result is scoped agent verification, not overall release or human, operational, hardware-performance, screen-reader or qualified mission acceptance.

Execution: **2026-11-15T00:12:14.013Z–2026-11-15T00:13:57.925Z**, clean process exit **0**, from workflow base `ff74d6b28ff0f45c155586369f52f176d88ca202` plus only the four C14→C15 candidate defaults. Every assertion body is byte-identical; all 82 C14 journey names/order match (`unchanged-check-contract.json`). No retry, assertion relaxation, forced click, injected application state or application numerical-helper import was used.

```sh
node scripts/verify-refinement.mjs > /tmp/refine-c15-workflow.log 2>&1
```

Defaults select `--section all --mode both`, C15 marker/instructions/source bundle and `/tmp/solarreach-refinement-workflows-c15` output.

| Frozen identity | Actual value, unchanged before/after |
| --- | --- |
| Published C15 source | `f7ecd636f36955509e6e24f54c1fe85df2a25ab2` |
| Read-only source | `/home/luke/Storage/solarreach-navigator-20261114-worktrees/refine-c15-final-check`, clean; all **525 tracked-file hashes** unchanged |
| Artifact / HTTP | `/tmp/lunar-window-c15.html`, **81,081,637 bytes** / `http://127.0.0.1:43328/` |
| Artifact + HTTP SHA-256 | `094b080b03fdcb8629f71ba294fb20c43e448d670367fe11001ecf4839e9765c` |
| Marker SHA-256 | `73725066d42333a0983cb151d94d864c2160e2b2d2d5d051fce8bc36efdeec37` |
| Instructions SHA-256 | `73f9eb4b133b5241b574c1e405ff5fbd0cf680d09c0941c005cc3a82ce5c9da0` |
| Executing verifier SHA-256 | `82559a8b9d8ccc885e929f5eab8f3fe841885d329a0eb55ff294d044a3518df6` |
| Published source bundle | `/tmp/lunar-window-c15-source.bundle`, **11,661 bytes**, published head verified |
| Source-bundle SHA-256 | `638801bd1698329f0612a3efc762301c8627c2d860f4fa6f77a6b8c308a21d9a` |

Full report: `/tmp/solarreach-refinement-workflows-c15/report.json`. Before/after verifier, artifact, marker, instructions and source-bundle copies retain the final frozen identity proof. Fresh source command timestamps/exits/log hashes, exact network summary, assertion-contract preservation and supplementary integrity records are alongside it. Evidence includes **102 PNGs** and **182 numbered production input/download files**. All **3403 prior C3–C14 evidence files** hashed at start remain unchanged. The entire earlier report remains an exact byte prefix, SHA-256 `609aa4b928504d837420862c4a7200c7a68d512e6054e529f63cfd6c102f0fb5`.

Both transports pass all original audience/state, exact replan capture/date/delta/first-failure, bounded scan/cancel, teaching keyboard/modal/notebook/draft persistence, immutable worksheet capture/explicit recapture, student/teacher production exports and engineering invalid/stale/missing-evidence/provider failure/cancel checks. Resource edits retain scene/canvas identity, focus and avoid baseline asset refetch. Actual downloaded known-zero and unavailable-forcing student screenshots, plus the disconnected native teacher screenshot, were inspected: distinct explanations, native equations/givens, escaped literal edits and separate teacher answers are visible.

Each transport records **0 page errors, 0 HTTP error responses, 0 unexpected console errors**. Ordinary disconnected-file use, including downloaded documents, issues **0 unmocked HTTP requests**. Each transport retains four deliberately failed/aborted provider requests and two expected console errors, explicitly labelled. No successful external response is fabricated or claimed live. Both complete transports finished on the first run, with no screenshot-protocol failure.

Fresh source checks ran in the exact clean C15 checkout, not the workflow base: `npm test`, `npm run typecheck -- --incremental false`, `npm run lint`, `npm run math:check`, all exit **0**. Math manifest SHA-256 remains `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f`. Owned verifier syntax, zero-warning ESLint and diff whitespace pass. Cached installed slop-scan 0.3.0 scans the scripts directory with **0 findings**; no installation. Its initial single-file CLI invocation rejected a file as a directory; the corrected directory scan completed, without changing the verifier or assertions. A supplementary identity preflight initially named a nonexistent rigid-math path, then enumerated the actual scene files; the final **24 canonical/scene Git-object comparisons** all pass.

C15's supplied F11 controlled-plot inspection/blur/shared-clock correction, retained resource cursor clamps, F10 axis spacing and F9 native HUD belong to Root/visual acceptance. This unchanged workflow suite does not claim new battery-endpoint, native-200%, raster-contrast or physical-contact coverage. `supplementary-canonical-authority.json` verifies unchanged assessment, astro, planning types, touchdown physics, pipeline, catalog, generated MathML and every scene file against C14. No science, physics, geometry, ephemeris, asset or planning-4 meaning changed here. Horizons was not rerun; no fresh Horizons pass is claimed.

Browser/runtime/host/flags are frozen in `report.json`: isolated Chrome 149.0.7827.155 contexts, Playwright 1.63.0-alpha-2026-08-05, SwiftShader software rendering, caches not flushed. Root supplied builds; this lane did not rebuild. C13 physical six-scenario/13-check evidence and its recorded process-exit anomaly remain C13, with no relabelling or borrowed counts. Separate full visual/native-zoom/HUD/maps/workspaces/graph/contrast and fresh nominal physical gates remain their owners' responsibility. Human audience, screen-reader, qualified scientific validation, continuous uncertainty/source-frame qualification, station booking, hardware/GPU performance and operational/mission readiness remain unperformed or outside this lane.

Only `scripts/verify-refinement.mjs` and this report change in the repository. No app/config/generated/dependency edits, subagents, server/shared browser, Simulator/Metro, push or merge. Delivery: `/tmp/refine-c15-workflow-result.txt`; `/tmp/refine-c15-workflow.bundle` since `ff74d6b28ff0f45c155586369f52f176d88ca202`.
