# Evidence confidence integration

15 November 2026 · `codex/eval-confidence` · integration base `8cfb59abbaf7418f5b28b16ae8d73ed42e0b4b21`

`refs/remotes/mac/evaluation-integration` was already an ancestor of this branch when the requested merge ran. No default-branch merge or push was performed.

## Result

- Navigator's existing Data & math selection mounts `DataMathPanel` through `next/dynamic`. The wrapper owns the confidence summary, existing data connections, science framework, scientific verification JSON and resources panel. Planner's separate data-connections mount is also dynamic. Public / teach / plan maps to public / educator / planner for confidence copy.
- The planner evidence workspace passes its actual scenario, manifest, declared bounds and completed stability result into the confidence evaluator. Both the summary download and **Export cases & held scenario** include the full nominal `heldScenario`, dataset/model identity, bounds and validated cases. The latter is disabled after the scenario changes; the summary export retains current inputs and marks finite evidence stale without exporting old case numbers.
- `StationEvidenceSummary` is collapsed beside the communications screen. It receives the canonical assessment key, the exact `[start, end)` mission stay and wall-clock UTC. The communications screen uses the same UTC clock, updated every 30 seconds locally without provider polling.
- Observer-file import reads valid `fetchedUtc` / `retrievedUtc` from the archive, its metadata object or response. If none is valid, it requires the original retrieval UTC through the labeled field and gives an actionable rejection until supplied. Conflicting valid retrieval dates reject. Import time, export time, sample dates and the Horizons generation banner cannot supply freshness.
- Complete imported observer JSON, including a supplied API signature, remains separately inspectable and downloadable through **Export original observer JSON**. A raw response without a signature stays unknown. Schema 1's station envelope is unchanged and retains its raw table and original retrieval timestamp; its export does not encode the API signature. Keep the separate observer archive when that metadata is needed.

## Fresh verification

All commands run in this worktree:

```sh
npm run typecheck -- --incremental false
npx eslint components/navigator.tsx components/engineering/evidence-workspace.tsx components/workbench/data-math-panel.tsx lib/engineering-evidence/import-metadata.ts tests/engineering-evidence.test.ts tests/evidence-confidence/import-metadata.test.ts tests/evidence-confidence/wiring.test.ts
npx tsx --test tests/evidence-confidence/*.test.ts tests/comms-evaluation/*.test.ts tests/engineering-evidence.test.ts tests/audience-workspaces.test.ts tests/science-framework.test.ts tests/providers.test.ts
git diff --check
```

Typecheck, owned lint and whitespace checks pass. Focused tests: **112 passed, 0 failed/skipped/cancelled**. Logs are in `/tmp/lunario-fix-evidence-{tests,typecheck,lint}.log`.

New tests exercise retrieval metadata, missing/invalid/conflicting dates, API JSON round trips, unchanged envelope shape, mismatched station/request and corrupt tables. A private Chromium file fixture mounts the actual Data & math and planner components, downloads their JSON, changes audiences, imports raw/archived observer responses, runs finite cases, changes the scenario and verifies stale behavior. Full input retention includes a nondefault load schedule, a zero charge cap and radio inputs. No HTTP requests or browser runtime errors occur. The existing Node SSR test now compiles the actual workspace in memory with CSS excluded; CSS loads in the browser fixture.

## Remaining scope and handoff

- The browser fixture verifies real component interactions and exports; it is not a full Navigator/Next.js or regenerated disconnected-app acceptance run. Parent owns integrated visual checks, builds and generated offline HTML. No server, shared browser, Simulator or Metro was started or controlled.
- `ResourcesPanel` shares `panels.tsx` with other eager Navigator panels. Its mount is inside the lazy wrapper, but that existing shared module is not fully deferred. No shared panel-module refactor was introduced and no production bundle-size reduction is claimed without a parent build measurement.
- The live geometry loader and schema-1 station envelopes still do not carry API JSON signatures. Imported observer JSON retains them via the separate archive; any shared schema/loader extension requires parent coordination.
- Numerical formulas, catalog, model identity/bindings and audit receipts are unchanged. No Horizons re-query or full npm suite was run for this UI/import integration, and no new scientific qualification or user acceptance is claimed.
