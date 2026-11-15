# Independent confirmation of FR01 correction

15 November 2026 · report-only worktree `codex/eval-final-review`.

**FR01 is closed at the station/resource reference and comparison dependency boundary.** Independently verified `06f33ebd7758c56a5ac131f6a5242c2204e0a29a` after the requested fast-forward merge of `refs/remotes/mac/evaluation-review-fix`. The original `REPORT.md` and `findings.json` remain unchanged historical records. One adjacent inherited producer dependency gap is recorded below; it does not reopen FR01.

## Exact mutation and publication gate

Fresh controls:

- `python3 scripts/compile-scientific-verification.py --check`: exit 0, **42 verified / 22 uncertain / 0 failing**.
- `node_modules/.bin/tsx scripts/audit-resources-compare.ts`: exit 0, **288 comparisons**, no failures, all **11** source byte/hash checks pass.
- `node_modules/.bin/tsx scripts/verify-engineering-evidence.mts`: exit 0, **75 station/epoch samples**; maximum residuals **0.0002686886904257335° azimuth**, **0.00007336623912124196° elevation**, **0.00324417429510504 km range**, within the unchanged limits.

The comparison and mutation probes ran in a disposable relative-path copy containing the binding, all bound files, registered inventory assets, both published JSON registers and `VERIFICATION.md`. The copied comparison program imported the copied resource reference; its Node dependencies were linked to the existing installation. No reference, receipt or binding in the checkout was changed.

Changed only `public/data/engineering-evidence/spice-reference.json` → `samples[0].azimuthDeg` from **191.25633627568297** to **201.25633627568297**, exactly matching the original FR01 case:

| Probe with mutated reference | Independent result |
|---|---|
| Resource comparison | Exit 1; exactly one failed component: Goldstone `2026-11-14T00:00:00.000Z` azimuth, error **10.000078898683°**, tolerance **0.002°** |
| Retained 75-sample station verifier | Exit 1 at the changed Goldstone epoch |
| Publication compiler `--check` | Exit 1, `Stale scientific evidence: public/data/engineering-evidence/spice-reference.json` |
| Write-capable publication compiler, without `--check` | Exit 1 with the same stale-reference rejection |

Both rejection modes left the **bytes and modification times** of all three publication outputs unchanged: `lib/generated/scientific-verification.json`, `docs/qa/scientific-audit/VERIFICATION.json` and `docs/qa/scientific-audit/VERIFICATION.md`. Restoring the reference restored a passing publication check. This independently demonstrates rejection before writes, beyond the regression's single-output assertion.

Additionally mutated each of the **78 newly bound files**, individually, by appending one newline in the disposable copy. Every file was rejected by its exact path in **both check mode and write mode**; all three outputs remained unchanged throughout. This includes the observer fixtures, primary archives, resource reference, comparison producers, defaults/provenance imports, numerical terrain metadata/bytes and ice inputs. These identity probes establish freshness enforcement, not the scientific validity of arbitrary changed contents.

## Standards

No violation found in the scoped correction. Independently checked **73 → 151** identities: all **73 prior path/hash pairs are unchanged**, and every current path is a tracked, existing, regular, non-symlink file with a matching SHA-256. Paths are repository-relative with no parent traversal. No public numerical data or published register changed between the prior review and this fix.

The added HTTP responses, primary documents and check logs are frozen archived evidence. Recorded retrieval times and test durations do not make compilation nondeterministic: the compiler reads their committed bytes and does not regenerate them. Regeneration intentionally requires review and rebinding. No publication output, temporary file, live cache or visual-only asset was accidentally included. Visual acceptance remains separate.

## Spec

No missing critical dependency found in the requested FR01 station/resource boundary. The CSPICE reference, all three archived observer fixtures, resource reference and source manifest/files, comparison programs, reference producers and transitive local numerical/default/provenance imports are bound. Numerical global-terrain metadata and compressed bytes, plus ice catalog/source identities, are bound. The compiler checks identities before reading/promoting results or writing publication outputs.

Fresh existing regression: `node_modules/.bin/tsx --test tests/audit-register-freshness.test.ts` — **1/1 pass**, no skips. It exercises the exact +10° mutation, the other added dependency classes, original stale-input probes and rebound-failed-outcome rejection.

Fresh focused checks: `node_modules/.bin/tsx --test tests/audit-resources.test.ts tests/audit-sources.test.ts tests/engineering-evidence.test.ts` — **343/343 pass**, no failures, skips or cancellations. The 288 resource cases are included in that count. Standards and requirements were also inspected in separate read-only review passes.

## Adjacent inherited dependency gap

`scripts/prepare-fine-terrain.mjs:3` imports `scripts/terrain-codec.mjs` and passes its `packTerrain` result to the terrain write at line 155. The producer is already bound, but the codec is absent from both the binding and registered inventory. The codec controls height quantization, scale/offset and the unknown-height sentinel (`terrain-codec.mjs:13`).

Independently changed its minimum quantization scale from `0.1` to `1000` in a disposable copy. Publication `--check` still exits 0 with **42 / 22 / 0**. Repeated the control and mutation with the exact consumed compiler, bindings, registered assets and publication bytes from **`c5683fa`**: the same result, confirming an inherited gap rather than a regression in this correction. No terrain generator was run and no produced numerical terrain was changed.

This limits claims of exhaustive freshness coverage for every historical numerical producer. Bind the codec and add a drift probe if extending that broader boundary. It does **not** defeat the repaired station/resource reference gate: its comparison import closure is complete, and committed numerical terrain outputs are themselves protected. No current terrain-number error is established by this probe.

## Scope and handoff

Only this confirmation report is changed. Original findings, source, data, receipts, bindings and generated applications remain untouched. Production generators/builds, the full 1470-test suite, typecheck/lint and fresh live Horizons retrieval were not rerun for this report-only follow-up. No browser, app server, Simulator or Metro was started. Parent owns concurrent final browser/artifact acceptance; these checks establish neither user acceptance nor operational qualification.

Local reproduction evidence: `/tmp/lunario-review-confirmation-check.py` and `/tmp/lunario-review-confirmation-evidence/summary.json`, with per-probe stdout/stderr in that directory. Disposable verification copy: `/tmp/lunario-fr01-confirm-jh006oit`. The exact mutation, commands, counts and residuals above are retained here for the committed handoff independently of those temporary files.
