# Dedicated planner browser verifier

Run with existing project dependencies and a separately running preview:

```sh
node scripts/verify-planner-browser.mjs --base-url http://localhost:4317 --output /tmp/planner-browser
node scripts/verify-planner-browser.mjs --file /absolute/path/solarreach-navigator.html --offline --output /tmp/planner-offline
```

Exactly one target and an output directory are required. `--offline` disables network before navigation: an HTTP target therefore fails unless independently available in the context; use a built local standalone file to assess offline behavior. The verifier does not build, start a server or install a browser. It imports the project's pinned playwright-core and launches a fresh headless Chrome with a temporary context, never a user profile, shared browser or emulator. macOS defaults to `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; other platforms set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium executable.

Outputs are `planner-1920.png`, `planner-1600.png`, `planner-1024.png`, `planner-390.png` (1080 CSS pixel viewport height, device scale 1, full-page capture) and `report.json`. Reduced motion is requested and its media query checked. Programmatic checks cover document overflow at each width, guide Escape, drawer/inspector close and reopen, location/timeline minimize and restore, body Space playback, input Space guard and an unrelated button Space guard. Native button activation is preserved. Assertions wait for observed state; missing controls fail instead of passing vacuously.

The report records errors and returns exit 1 for failed checks, exit 2 for invalid CLI, exit 0 when the implemented checks have no failures. Exit 0 still means **incomplete**, never T17 completion or WCAG conformance. Chart captions/text are inventoried, not certified as equivalent alternatives. Glass computed colors are recorded, but layered translucent imagery/canvas backgrounds require actual compositing and visual review: no ratio is fabricated. Real browser zoom at 200% is a manual gate; neither CSS resizing nor CDP pageScaleFactor/pinch emulates browser zoom. Actual screen-reader operation and subsequent planner assessment/export/sensitivity flows remain incomplete.

These checks target the current workbench labels; update assertions when accepted interaction contracts change. A failing preview can be an app issue or fixture mismatch; inspect report detail and screenshot evidence before assigning cause. Runtime errors are reported without filtering. Screenshots and reports are external artifacts, not committed generated assets.

Fresh infrastructure verification (2026-11-14): `node --check` passed; five malformed CLI configurations each returned 2. Dedicated Chrome run against the already-running localhost:4317 generated all four screenshots and report with zero failed checks, including analysis chart captions. Report status remains `incomplete` because manual gates and later UI coverage are outstanding. The run observes that preview, not an assertion that every later implementation has been tested. External run artifacts: `/tmp/solarreach-browser-evidence/`.
