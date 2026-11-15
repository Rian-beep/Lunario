# Isolated audience evaluation

Run from the repository root with installed `playwright-core` and existing Chrome 149. No dependency install, build, server, shared browser profile or production file edits occur. All profiles/downloads default to `/tmp`. A nonzero exit means a failed check or incomplete run; inspect observations rather than interpreting every failure as a production bug.

```bash
node --test tests/evaluation-audience/*.test.mjs
node scripts/evaluation-audience/run.mjs --section journeys --out /tmp/lunario-audience-web
node scripts/evaluation-audience/run.mjs --section surfaces --out /tmp/lunario-audience-web-surfaces
node scripts/evaluation-audience/run.mjs --section journeys --transport file --out /tmp/lunario-audience-file
node scripts/evaluation-audience/run.mjs --section surfaces --transport file --out /tmp/lunario-audience-file-surfaces
node scripts/evaluation-audience/run.mjs --section offline --out /tmp/lunario-audience-file-smoke
```

Options: `--url URL`, `--file PATH`, `--out DIR`, `--section journeys|surfaces|offline`, `--transport web|file`, `--chrome PATH`. Default hosted URL is the parent-owned `http://127.0.0.1:4357/web/index.html`; no server is started. `offline` always disconnects. `--transport file` disconnects all sections; the session named `web` in journey logs is a historical label: **the recorded URL and `offline` property determine transport**, not that label.

The runner keeps first-load original loader, uses fresh contexts and real UI events, saves step screenshots/text and JSON with failures, and checks script/artifact hashes. Public covers site, lander play/edit/explanation/retry. Educator covers native MathML, prediction, baseline/result, saved conclusion and distinct material exports. Planner covers held-date alternatives, first failure, save/open/export/import. Surface checks independently repeat both themes, focus/Space, touch emulation, PNG download/native clipboard and selected opaque DOM paint. They report a pointer blocker as failing even when programmatically focusing the result and pressing Enter allows later tests to continue. That workaround is not ordinary keyboard or touch acceptance.

Native zoom uses isolated Chrome profile preferences and verifies doubled DPR, halved CSS width, fixed physical window/screenshot width and visual scale 1. It does not substitute viewport resizing, CSS zoom or `Emulation.setPageScaleFactor`. Temporary profiles are removed. All scene rendering uses explicitly selected SwiftShader, whose runtime identity is recorded. Timings include actual reverse-tunnel/network/render conditions, not target hardware throughput.

Compare like artifacts and inputs. `served-index.html`, `served-build-receipt.json` and browser response hashes (when captured) identify hosted bytes; the offline SHA binds an entirely separate generated file. The build receipt does not itself prove which git revision was built. The parent must bind final generated artifacts to its validated source. Do not replace an incoming artifact with a local build during a baseline test.

Method references, consulted 15 Nov 2026: [Playwright isolation](https://playwright.dev/docs/browser-contexts), [Chrome accessibility reference](https://developer.chrome.com/docs/devtools/accessibility/reference), [CDP Emulation](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/). Chrome distinguishes automated markup inspection from actually using a keyboard or screen reader; these scripts provide agent keyboard observations, not human/assistive-technology acceptance.

After UI labels or behavior change, inspect first. Pilot runs in the report retain evaluator-only selector/timing mistakes explicitly. Do not weaken a production regression merely to produce a green count. Human session materials live in `docs/qa/evaluation/audience/HUMAN-TASK-SHEET.md`.
