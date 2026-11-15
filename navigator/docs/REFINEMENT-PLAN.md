# Audience and replanning refinement

User-approved scope: implement the post-release audit recommendations in parallel on Clevo, fix confirmed issues first, test web and offline before merging. Shared contracts and ownership are in CONTRACTS.md. Hosting remains the teammate's responsibility.

## Acceptance gates

### A — Confirmed corrections

- Guided/manual flight explanatory text, time steps, coordinates/rotation assumptions and gradients match the selected solver. Native equation notation and units remain correct.
- At1280,1728 and800px, the physical lander is framed inside the visible canvas around open inspector, location and HUD controls. Camera target/COM tracking alone is insufficient. Resizing/toggling panels preserves user orientation and scene identity.
- Dense comparison content has no underlying field text bleeding through; actual rendered contrast/readability is rechecked.

### B — Unified replanning

- A clear header entry opens reference/candidate comparison without changing the active scenario merely by browsing.
- Candidate-only UTC/site controls and +1/+7 day actions retain the full stay, hardware and requirements; unsupported dates leave the previous case intact. The first plot shows paired stored energy/reserve; a curve selector exposes the other histories without a wall of charts.
- Different arrival dates share an explicitly elapsed-time cursor with both exact UTCs; absolute-time overlap is never fabricated.
- Actual power, stored energy, contact and horizon information connect to spatial site context, input differences, fixed requirements and first failure intervals.
- Selecting an interval opens the exact scenario/horizon at its absolute catalog index. Opening/saving preserves all hardware, terrain mode, independent heights, requirements and operations.
- Non-dominated tested cases retain conditional/unknown evidence; unsupported inputs never become a favorable score. Any searches are bounded, cancellable and yield to input.

### C — Audience tasks

- Fresh Public entry provides a compact dismissible answer/next action outside floating map panels, with clear current-versus-stay context and plain-language unknown/failure explanation.
- Teaching opens in a spacious surface, connects actual selected inputs with controlled prediction/result, native equations/derivative units and named plots, and reuses saved notebook records.
- Illustrative constants and actual scenario values are distinguishable and can be explicitly synchronized. Audience switching preserves scientific inputs.
- Planner shows requirements assessed, not required and unresolved evidence prominently. Human/agent/self-reported study data remain distinguished; no fabricated acceptance participants.

### D — Engineering evidence

- Declared uncertainty bounds and their provenance produce bounded case/stability results through evaluateScenario. No undeclared statistical distribution or invented precision; missing bounds remain unquantified.
- Station elevation/horizon, lunar contact, link losses, rates and dated allocation coverage form a traceable chain. Missing necessary stages prevent an adequacy claim.
- Source fixtures/reference computations are independently checked; provider requests are explicit, bounded and cancellable. Present observations do not substitute for future conditions.
- Imported evidence validates units, timestamps, identity/scope, finite values and coverage; exported evidence reopens offline without required network.
- Source-frame/terrain qualification closes only with actual defensible validation. Otherwise the unresolved scientific gate stays explicit in the UI and report.

### E — Integrated delivery

Every worker supplies focused and full tests/types/lint plus atomic owned commits. Root reviews scope/diffs, integrates correction lane first, then modules, compiles native math and independently verifies resulting behavior.

Build a new isolated production directory; do not rebuild the active preview's files. Produce an immutable final offline artifact/hash and exercise actual HTTP and file/no-network workflows. Test new task journeys, core decision export/import and controlled comparisons, persistence, NASA assets, pole navigation, full Follow/contact and no baseline asset reload. Visually inspect new default views and replay the five audit findings. Record actual browser/hardware and scoped scientific limits, not a blanket certification claim.

Survey all worktrees/completed workers before final private merge. Publish passing source, generated offline HTML, user-facing documentation and exact QA evidence. Human audience/screen-reader validation and physical mission qualification require actual independent evidence; a study capture interface or mathematical test is not such a pass.

## Accepted Lunar Window visual and teaching extension

The user explicitly adopted Lunar Window (upstream main d7273fb) and requested a dark interface following the orange framed-card reference. Preserve all existing icons and control placement. Use charcoal surfaces, pale text, amber Sun, blue ring Earth and warm orange framing; do not recolor NASA imagery. Reuse the current fonts, native math, accessible focus and reduced-motion behavior. The loading state reflects real initialization, with no artificial progress. Internal storage and source identities retain SolarReach compatibility.

- Fill the actual viewport, with bounded internal inspector scrolling at narrow widths and 200% zoom; preserve map aspect, pointer coordinates and scale.
- Keep the physical NASA lander visibly framed through ordinary descent and crash replay. Broken debris may require a smooth camera pullback; model scale remains one and intact Follow retains its offset.
- Educators can explicitly capture an immutable scenario, choose goals and edit questions/hints, then export student worksheets separately from teacher answer keys and portable teacher JSON. Native notation, units, gradient intuition, source identity and unknown results survive export. Student HTML contains no hidden answer key.
- Keep Planner as an evidence-scoped engineering workspace. Missing qualified terrain, vehicle, thermal, operational allocation or structural evidence cannot be converted into an operational pass by the theme or worksheets.
- Verify dark text, graphs, hover/focus, expanded cards and actual lander visibility on web and offline builds.
