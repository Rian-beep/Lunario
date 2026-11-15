# Fresh audience evaluation — 15 November 2026

**The desktop agent tasks are usable, but site selection by pointer is blocked at mobile size and native 200%. Incoming south-pole detail also fails its delivery path. Production fixes require the parent.** No production files, packages, generated applications, scientific receipts/bindings or shared memory were changed by this lane.

## Exact baseline and method

Worktree `/tmp/lunario-eval-audience/navigator`, branch `codex/eval-audience`, baseline `3c82b5aa02c4da52053fd3c12c180cca18fd6d4e` (production parent `6b10ee8`). Locked contract read before implementation. Parent-notes path was checked at implementation/testing/commit boundaries; it was absent during the recorded work. Parent requests/findings were left at `/tmp/lunario-eval-audience-parent-request.txt`. Instruction parity passed31/31 reviewed sections. Memory was recalled read-only; parent owns durable shared memory.

| Delivery | Exact identity | Scope |
| --- | --- | --- |
| Served baseline | `http://127.0.0.1:4357/web/index.html`;1222bytes; SHA256 `33bf36685194eb5bc5974ee84c940eedb4ec7fc064932d30417ff64b280c9b61` | Actual fresh-context browser tasks; parent reverse tunnel. Build receipt SHA256 `184930b34bd0b9b999ba881b14c08b32b610996d20e70945e058cb0961d6ff96`. |
| Incoming offline | `public/solarreach-navigator.html`; SHA256 `afa9fa3725f5297299368363c7a317ab62d374acc95a981ebaff59f8aa37e45d` | Actual file: browser with network disabled; separately evaluated without rebuilding. File hash unchanged after runs. |
| Source | Exact source/tree and selected production-file hashes in [artifact-binding.json](evidence/artifact-binding.json) | No assertion that a generated artifact contains every current source change. Hosted receipt lacks independently verified source-commit binding. |

Existing Google Chrome149.0.7827.155, Playwright-core1.65.1, fresh isolated contexts/profiles; no Luke profile or shared session, app server, Simulator, Metro, dependency download, push or merge. Desktop1600×1000CSS; mobile390×844CSS with touch/mobile emulation and DPR2. GPU identity is **ANGLE Vulkan SwiftShader Device (Subzero), software**, not verified hardware GPU. No throughput claim. Cold loading over the reverse tunnel is distinct from render cost and original loader duration. Loader was never skipped; observed presence3.51–3.55s includes DOM observation/animation scheduling around its intended3s minimum. Playback was paused on load.

The hosted endpoint became unresponsive after the pilot. The final hosted rerun timed out fetching its build receipt after20s, completed0checks and exited1. This is unavailable environment evidence, not a passing task suite or a new production diagnosis. Complete authoritative replays therefore target the exact incoming offline file. Hosted observations and offline replays remain separate throughout.

## Observed tasks and results

| Evaluation | Actual actions and evidence | Result |
| --- | --- | --- |
| Public, desktop offline | Fresh load → Pick a site → Malapert → inspector → Preview a lunar flight → assisted reference →50×play/pause → change only thrust16000→4000N → read reasons → reload reference and replay. | Completed. Scenario diff exactly `flight.thrustN`; edit reset/paused playback. Displayed prediction changed from within entered limits to excessive vertical/sideways speed, target miss and energy threshold. Actual computed values are retained in [journey observations](evidence/incoming-offline-journeys.json), not asserted as flight qualification. |
| Educator, desktop offline | Select Educator → native relations → Teaching studio → prediction → capture baseline → raise array2→10m → reveal → exact sample table → save conclusion → notebook → distinct student worksheet, teacher key and teacher JSON. | Completed. Nine nativeMathML elements in revealed studio;3explicit height trials. Generated energy109686.19→121251.30Wh; displayed terrain contact0.38→0.38; sphere generation45727.65Wh held. Both cases still fail a modeled required limit. These are that exact captured stay’s outputs, not independently validated physics or learning outcomes. |
| Planner, desktop offline | Replan → +1day candidate → explicit0,24,48h alternatives → inspect first failure → name/save/open candidate → decisionJSON download → import → recompute. | Completed. Downloaded scenario equals current state before and after import;4events; modelplanning-5. Export does not approve mission readiness. |
| Served baseline pilot | Same visible desktop route; paired terrain/sphere, native relations, material exports and Planner delay/scan/save/export/import. |8/10step checks completed;2failed evaluator-only assumptions: scene dataset reset was read before its next frame, and a caption locator incorrectly scoped itself inside the dialog. Corrected current runner completed both actions on incoming offline file. Do not count pilot as10/10 or those two errors as product bugs. |
| Mobile + native 200%, offline, both themes | Guide keyboard loop/Escape/opener; Space play/pause; normal site pointer action; documented programmatic-focus/Enter workaround to continue; horizon axes/units/sample keyboard; PNG download and native clipboard. |11/15pass;4site-pointer cases fail, independently reset between themes. Clipboard returns image/png in all4chart cases; selected opaque chart text contrast17.51085:1. No general contrast/accessibility pass. |
| Agent keyboard, offline | Map arrows/+ change raster with fixed mission time; body arrows +1/shift +6 samples; reduced-motion stepped playback; Down-arrow focuses explanation, Escape returns to i. |5/5pass;0uncaught errors/HTTP. These are DOM/event observations, not screen-reader speech. |
| Disconnected smoke | Actual Public3D/lander, Educator studio, errors and network. |3/3pass;0HTTP attempts/uncaught errors. Console/local-file optional detail failure is retained, not suppressed. |

Native zoom is verified, rather than inferred from viewport size: at100% DPR1/innerWidth1600/outerWidth1600/surfacePNGwidth1600/visualScale1; at200% DPR2/innerWidth800/outerWidth1600/surfacePNGwidth1600/visualScale1. Corresponding CSS heights993→496. No body horizontal overflow occurred; the unusable zero-height site list demonstrates why that alone cannot establish successful reflow.

Selected screenshots: [initial hosted map](evidence/web-initial-map.png), [hosted pending3D](evidence/web-pending-3d.png), [Public edited flight](evidence/offline-public-flight.png), [Educator real response](evidence/offline-educator-result.png), [Planner import](evidence/web-planner-export-import.png), [mobile dark blocker](evidence/offline-mobile-dark-blocker.png), [mobile light blocker](evidence/offline-mobile-light-blocker.png), [native200 dark blocker](evidence/offline-native200-dark-blocker.png), [native200 light blocker](evidence/offline-native200-light-blocker.png), [mobile chart](evidence/offline-mobile-horizon-chart.png). Every retained evidence file is hashed in artifact-binding.json.

## Parent fixes and interfaces

1. **AUD-01 / P1 / open:** At390×844, the searched Malapert result has height0 at y649.265625. At native200 it has height0 at y506.5, beyond496CSS-height. Filter/custom-coordinate/footer chrome consumes the55%-height drawer; map controls also intercept. `app/globals.css` responsive `.site-drawer`/`.site-list` rules around2828–2839 are the root-cause candidate. Guarantee usable scrollable results or scroll the complete drawer within the available viewport. Retest ordinary taps/clicks in both themes and native200. The evaluator deliberately reports failure even though a programmatic-focus workaround allows later tasks.
2. **AUD-02 / P2 / open:** Hosted request `/data/south-pole-detail/manifest.json` returns404 while other assets use `/navigator/public/data/`. Offline attempts a file: manifest fetch and Chrome blocks it. `southPoleManifestUrl()` bypasses `lib/public-assets.ts::publicAssetURL` and offline inline transport. Parent owns this incoming adapter, runtime and build integration. Resolve manifest/subordinate URLs through the existing transport boundary; make offline detail availability truthful. Preserve working numerical/local fallback and warnings. Overall scene-ready is not detail-ready.
3. **AUD-03 / P2 / open:** Deferred3D can show an unexplained empty/legend-only pane. `web-source/lazy-dynamic.mjs` has a null default Suspense fallback. Scripted hosted cold entry reports legend-only pane text at5s and Moon model ready45.843s later in that run; exploratory screenshot shows the blank pane. Add concise accessible pending/retry feedback inside the existing pane. Preserve original3 s loader. Do not generalize these reverse-tunnel/software timings to target hardware.
4. **AUD-04 / P2 / open:** Incoming `lunar-terrain.js:1` causes the required lint failure. Same full lint command fails on untouchedbase with exactly1error/0warnings. Parent owns resolution; no lint rule was weakened.
5. **AUD-05 / needs-external-evidence:** Real intended audiences, real screen readers/touch devices, OS paste targets and hardware GPU remain untested. [Human task sheet](HUMAN-TASK-SHEET.md), [blank CSV](OBSERVATION-TEMPLATE.csv) and [session template](SESSION-TEMPLATE.json) are ready. No participants, confidence scores or learning/engagement acceptance were invented.
6. **AUD-06 / needs-external-evidence:** Parent must bind final generated artifacts/source and expose the integrated candidate for replay. No final candidate or source-equivalence claim is made. No shared UI component/binding/version interface was added in this read-only lane.

Machine-readable details/statuses, exact reproduction and before/after limits are in [findings.json](findings.json). No production finding is marked fixed: after-evidence requires parent-owned changes. Owned implementation consists of the reusable runner, evidence guards, regression tests and practical study/export protocol.

## Verification and reproducibility

[Runner instructions](../../../../scripts/evaluation-audience/README.md) describe fresh contexts, command options and conservative failure handling. `evidence/runner-executed.mjs.txt` preserves the exact runner used for the full offline journey; the current runner only bounds logged focus text to avoid serializing inline application code when Chrome focuses BODY. Pilot assumptions were corrected without forcing pointer events or weakening native200 proof. Hosted pilot failures, console errors,404 and local file CORS failures remain in raw observations.

| Command/check | Exact outcome |
| --- | --- |
| `node --test tests/evaluation-audience/*.test.mjs` |5tests,5pass,0fail,0cancelled,0skipped,0todo; exit0. Guards reject fake native zoom, invalid contrast, nested held-input drift and accidental failed-check counting. |
| `node scripts/evaluation-audience/run.mjs --section journeys --transport file --out /tmp/lunario-audience-final-offline-journeys` |10checks,10pass,0fail; exit0. |
| `node scripts/evaluation-audience/run.mjs --section surfaces --transport file --out /tmp/lunario-audience-final-offline-surfaces-small` |15checks,11pass,4fail; exit1. Native zoom proof is an additional assertion. |
| `node scripts/evaluation-audience/run.mjs --section offline --out /tmp/lunario-audience-baseline-offline` |3checks,3pass,0fail; exit0. |
| `node scripts/evaluation-audience/run.mjs --section journeys --out /tmp/lunario-audience-final-web-journeys` |0checks;20 s build-receipt timeout; exit1; unavailable final replay. |
| `AUDIENCE_KEYBOARD_OUT=/tmp/lunario-audience-keyboard-complete node scripts/evaluation-audience/keyboard.mjs` |5checks,5pass,0fail; exit0. [observations](evidence/keyboard.json). |
| `npm run typecheck -- --incremental false` |Exit0; exact stdout in [typecheck.log](evidence/typecheck.log). |
| `npm run lint` |Exit1;1error/0warnings, `@typescript-eslint/ban-ts-comment`, `components/workbench/scene/lunar-terrain.js:1:1`. [stdout](evidence/lint.log). |
| `npm --prefix /tmp/lunario-audience-base-check run lint` after untouched `git archive 3c82b5a`+existing dependency symlink |Exit1; same1error/0warnings in isolatedbase. [stdout](evidence/base-lint.log). |
| `git diff --check` |Exit0. |

No full npm test, Horizons, publication-binding, render/build or scientific comparison pass is claimed. Production numerics and receipts are unchanged; parent retains scientific/model/publication gates. Automated DOM, keyboard and emulation evidence is not actual screen-reader use, a global WCAG audit, a human study or user/mission acceptance.
