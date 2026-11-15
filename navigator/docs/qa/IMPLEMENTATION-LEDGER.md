# Implementation ledger — lunar workbench, 14 November 2026

Design approved in chat. Native execution in isolated extracted source on codex/lunar-workbench. Original ZIP remains unchanged. Source Git history restored without foreign hooks/remotes.

Baseline: npm ci; tsc exit 0; lint 0 errors / 4 warnings; Next production build exit 0. No original unit-test suite. Offline baseline opened and screenshot captured; only favicon 404s on static server. New model tests observed failing before the new modules existed.

Shared interfaces: astronomy SampleSeries feeds mission model; terrain grid feeds map/3D/collision; flight result feeds seconds-based playback; shared scenario feeds audience modes/comparison/export. Preserve existing celestial geometry.

Decision: implement in this isolated restored project rather than another nested worktree; no other agents modify product source. The design-review agent was read-only. Preserve offline datasets and source provenance. No push to archived Cursor origin or public README repo.

Foundation validation: 30 numerical/chart/export/state tests pass, strict typecheck and lint pass, Next production build passes (218 kB route). Fresh decoded Horizons check: 42 samples, max ~0.00853° azimuth / ~0.00442° elevation, within explicit 0.02° quantization-aware tolerance.

User corrections: dark-blue visual treatment rejected; requested original-like lighter premium materials. Warm mineral/ivory glass is now the working direction, not a claim of acceptance. User rejected tiny floating 3D terrain and invisible vehicle/trajectory framing. User explicitly requested all axes labelled with units and audience-specific hover/focus/tap information and critical-range intuition. Root added SVG graph contracts and glossary; further design/science refinement is assigned to parallel lanes.

14 November Clevo dispatch preparation: user explicitly requested parallel subagents on Clevo. One SSH session is pending Tailscale identity check for brandnamechanges@gmail.com; no remote work or workers started yet. Local spawn helper was inspected and launches Claude rather than Codex, so remote dispatch will use verified Codex CLI/tmux equivalents rather than silently launch the wrong runtime. Remote workload survey is part of the same pending SSH command. Original machine HOLD for other Cadence jobs remains untouched.

## Planning baseline

Source checkpoint be7d92d preserves compact/dismissible controls, independent modes, global historical map and contingency matrix. All eight existing Clevo workers are complete; new Sol lanes have isolated scope. T00–T20 task status is maintained in planning/IMPLEMENTATION-STATUS.md. Numerical contracts are extended in dependency order; no unsupported source is promoted to a pass.

## Shared planning contract rulings

T03 adds datasetId to context/results so evidence versions can be checked directly. External-report scenarioKey refers to a separate physical evidenceScopeKey that excludes reports, avoiding a self-referential key; full assessment scenarioKey still includes reports. Canonical keys identify inputs and do not replace SHA256 asset integrity. T05 must preserve one timeline entry per forcing interval and expose split subsegments separately. Unknown horizon evidence remains unknown, including when the manifest entry is missing. The final catalogue epoch is an endpoint; full stays crossing validUntilUtcExclusive are rejected, never trimmed.

T01 and T02 integrated; their worker validations are documented in planning/. T03 five provenance/context tests pass, including independent subsystem heights, custom borrowed evidence and endpoint bounds.

## Additional navigation, models and coverage work

Luke requested real site transit animation, original NASA Sun/Earth assets, source Git data, and a fix for arbitrary-point unknown results. Ten Rian upstream branches were fetched read-only into upstream/*, preserving private origin. The earlier README-only observation is obsolete: upstream now contains a full app and shared science fixtures. No unreviewed upstream code or scripts are executed.

Non-overlapping Sol lanes own transition files, new celestial assets/inventory, and new global DEM/horizon modules. The integrator owns schema, context/display adapters, manifest, offline embedding, preview and generated artifacts. Global context requires calibrated numerical heights; brightness and nominal globe vertices are not substitutes. Optional terrainMode is explicit; absent older values mean prepared-only.
