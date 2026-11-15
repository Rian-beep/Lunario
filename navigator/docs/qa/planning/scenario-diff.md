# Exact scenario differences (T10 utility)

`diffScenarios(before, after)` returns `Array<{path,before,after}>` sorted by path. Call it with inputs already accepted by the canonical scenario parser. It compares an explicit whitelist of scenario schema fields: version, site/custom coordinates, date indices, display and independent subsystem heights, mission, flight, partial radio, requirements/screens/contact windows, operations/load segments and external reports. User-entered comparison metrics and arbitrary imported keys cannot alter the differences or assessment status. It never reads the clock or mutates either input.

`classifyScenarioDiff(differences)` returns:

- `identical`: no declared input changes.
- `site-only`: only site ID or custom coordinate fields changed.
- `date-only`: only start/end indices changed.
- `assumptions`: only fields outside site/date changed (includes hardware, operations, requirements, external reports and schema version).
- `mixed`: changes span two or more of those three categories.

The label describes changed inputs, not an isolated causal result. Root UI must enforce controlled modes by cloning the baseline mission and allowing only site or date changes; this utility does not enforce editing permissions or compute outcomes. Assessment values must still come from the shared evaluator, with saved scenarios recomputed against the current model/evidence. Free comparison should show assumption differences prominently.

Longitude aliases normalize to [0,360) for comparison: -10° and 350° are equivalent. Other numeric fields retain their values; null, zero and missing partial-radio values remain distinct. A null custom-site marker remains visible as `custom`; actual coordinates use `custom.lat`/`custom.lon`. ID-bearing arrays use escaped-ID paths such as `operations.loadSegments[drill].additionalW`, so ordering changes do not produce false edits. Additions/deletions use undefined on the absent side. IDs must be nonempty and unique within each array or the utility throws. `requirements.requiredExternal` compares sorted selections without mutating them. Optional absent versus empty external-report arrays are equivalent.

This module remains source-compatible with the old `ScenarioState` type while comparing declared schema-2 fields at runtime, so the schema owner can land independently. It does not perform migration or validation and must not be used to bless unvalidated imports.

Validation: `npm run typecheck`; `node_modules/.bin/tsx --test tests/scenario-diff.test.ts`; `node_modules/.bin/eslint lib/scenario-diff.ts tests/scenario-diff.test.ts`. Tests cover determinism, whitelist filtering, no mutation, all classifications, longitude aliases, null/zero/missing radio, independent heights, nested operations/contacts/screens/reports, ID reordering/duplicates and deletions. No server, browser, Simulator or Metro is needed. T10 UI integration and T19 browser coverage remain parent responsibilities.

Verified on Clevo 14 November 2026 against checkpoint `808cb87`: typecheck passed; 7/7 targeted tests passed with no skips; targeted ESLint passed. Authored in the local isolated worktree and validated remotely; no remote-authoring claim is made.
