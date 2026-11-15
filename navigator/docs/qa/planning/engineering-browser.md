# Focused engineering UI / offline proof

Run against an already-built preview and/or a local standalone artifact:

```sh
node scripts/verify-engineering-flows.mjs --base-url http://localhost:4317 --file /absolute/path/solarreach-navigator.html --output /tmp/engineering-proof
```

An optional `--ready-marker PATH` fails before launch unless that marker exists. The verifier never starts a server, builds the app, installs dependencies or connects to a user's browser/profile. It uses the existing project playwright-core and a dedicated headless Chrome process; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can override the macOS executable. Each target gets a fresh isolated context at1600×1080 with reduced motion. A file target is offline before navigation, and all attempted HTTP requests are counted.

The flow uses actual controls and observes canonical storage without modifying it directly. It selects Planner, confirms empty ground-support fields are unknown, chooses landing-readiness requirements, enters explicitly synthetic support assumptions, and applies them. Four overlap hours at50% allocation and1Mbit/s produce2 allocated hours and7200Mbit capacity. It checks the absent source/author warning, supplies provenance, and verifies that the separate required external ground-support report is still not-assessed and the overall readiness verdict is incomplete.

It saves the baseline, moves arrival one day while retaining stay length, and verifies that the old scope stays stale with Unknown metrics rather than zero. Explicit rebinding with a2Mbit/s supplied rate restores a conditional analytical result and14400Mbit capacity. A second saved scenario is compared through the selected engineering variable, including the7200Mbit delta and downloaded CSV with scenario/date scope identity.

The current scenario is exported as a decision JSON package. The verifier changes its engineering rate again, imports the earlier package through the real file chooser, and checks restored exact inputs/provenance, recalculated values and the import recomputation message. When both targets run, their exported canonical scenarios, assessment scenario keys, dataset IDs and model versions must match. These synthetic assumptions are not a DSN reservation, measured site data or evidence of operational readiness.

Outputs include per-target screenshots, engineering CSV, decision JSON, failure DOM text when relevant, and report.json. Exit0 means only these focused engineering flows passed. It does not certify all seven physical models, every UI state, screen-reader use, readable glass, navigation/rendering performance or qualified landing safety.

## Observed run

On2026-11-14, the dedicated run exercised HTTP4317 and the parent-provided immutable `/tmp/solarreach-new-features-final.html` after `/tmp/solarreach-new-features-ready` existed. All26 checks passed:12 HTTP checks,13 file checks and1 cross-target identity check. The file context attempted **0 HTTP requests**, and neither context emitted a page runtime error. Report and screenshots are in `/tmp/solarreach-engineering-browser-proof/`.

The initial attempt correctly failed an overly exact test locator for a wrapped Assessment scope label containing option text. The fixture was corrected to the actual combobox name prefix, then both complete flows were rerun. No product source was altered to make that selector pass. Current report supersedes those first-attempt failure screenshots; retained old files are diagnostic history, not current failures.
