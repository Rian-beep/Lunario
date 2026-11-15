# Independent final source review

15 November 2026 · Clevo / Sol · report-only worktree `codex/eval-final-review`.

Reviewed `913d9d4..3365672043fb24737b1090327cee8e64628db5df`. Initial review excluded generated web/offline artifacts and retained raw evidence. Afterwards, inspected the scientific integration receipts and read-only camera patch `6bf2afdd8ca097985a2126d5b72e4a26971e75ba` in `/tmp/lunario-eval-terrain`, as requested.

**No additional introduced defect confirmed. One important inherited publication-gate gap remains. The known camera defect is repaired in the isolated patch, pending integration.** No critical finding. Application source, receipts, bindings and generated applications were untouched.

## Important: FR01 — station reference changes escape the publication gate

**Open; inherited, independently reproduced on both review endpoints.** Locations: `scripts/compile-scientific-verification.py:63`, `docs/qa/scientific-audit/integration/receipt-bindings.json:61`; reference consumers: `tests/comms-evaluation/compare-sources.mts:9` and `scripts/audit-resources-compare.ts:56`.

The supplemental station/resource gates validate bound result receipts and archived observer bytes, but the retained CSPICE reference they compare against, `public/data/engineering-evidence/spice-reference.json`, is absent from both the bindings and registered asset inventory. Changing that reference leaves the published comparison current according to `--check`, even when a fresh comparison fails. This limits the new integration report's statement that source changes invalidate publication. It is not evidence that the committed numbers are wrong.

Reproduction, using disposable copies only:

1. Copy the compiler, binding, all bound files, registered inventory assets, both published JSON registers, the CSPICE reference and `docs/qa/scientific-audit/resources/sources/` into a scratch directory, preserving relative paths.
2. From that directory run the original checkout's `node_modules/.bin/tsx /ABS/REVIEW/scripts/audit-resources-compare.ts`: **288 comparisons, no failures, exit 0**. Run `python3 scripts/compile-scientific-verification.py --check`: **42 verified / 22 uncertain / 0 failing, exit 0**.
3. Change only `spice-reference.json` → `samples[0].azimuthDeg` from `191.25633627568297` to `201.25633627568297`.
4. Repeat the comparison: **exit 1**, Goldstone `2026-11-14T00:00:00.000Z` azimuth error **10.000078898683°**, tolerance **0.002°**. Repeat publication `--check`: **exit 0**, unchanged **42 / 22 / 0**. No receipt or binding was edited.
5. The same reference mutation on an isolated exact `913d9d4` snapshot also passes publication (**41 / 21 / 0**). This is an inherited integrity gap, not a newly introduced regression.

Suggested bounded correction: bind the actual retained comparison reference and comparison implementation, with a regression asserting reference drift rejects publication before touching outputs. Review the other comparison-input dependencies at the same boundary. Current fresh source comparisons already pass; no operational qualification is requested.

## Camera patch disposition

Known ordinary-click cancellation is still present at the reviewed `3365672` endpoint (`runtime.ts:673`, `:678`). The isolated `6bf2afd` patch replaces pointer-down cancellation with a movement threshold, resumes interrupted asset travel, guards same-spacecraft picks, and preserves newer focus requests at site cancellation. **No additional defect found in this patch.**

- Independently ran `node_modules/.bin/tsx --test /tmp/lunario-eval-terrain/navigator/tests/camera-navigation.test.ts`: **6/6 pass**.
- Verified both production-file SHA-256 values against `/tmp/lunario-camera-delivery/report.json`: exact matches; retained receipt has **10/10 groups passing, zero page errors**. This review did not rerun that browser suite.
- Parent still owns integrating the patch and checking the resulting full application and rebuilt offline artifact. The old mode/framing flags alone do not prove visible arrival; retain its camera-distance and visible-geometry assertions.

## Verification and coverage

- Fresh `python3 scripts/compile-scientific-verification.py --check`: **pass, 42 verified / 22 uncertain / 0 failing**. Disposable mutations of `astro.ts`, station communications, evidence validation, the CLPS verifier and the Athena extract each reject stale evidence; published output stays byte-identical.
- Fresh `node_modules/.bin/tsx scripts/audit-resources-compare.ts`: **288 comparisons pass; all 11 source byte/hash checks pass**.
- Fresh `uv run --offline --python 3.12 --with spiceypy==8.4.0 --with numpy python scripts/evaluation-integration/verify-clps.py /tmp/lunario-eval-trajectory-sources` with no output-file argument: **740 states pass** (159 Athena, 220 Blue Ghost 1, 361 Odysseus). Maximum component residuals remain below `1e-8` km and km/s; UTC annotations remain below 1 ms. Used cached dependencies and pinned local kernels; wrote no receipt.
- Two focused review selections: **73 passing tests** for confidence/held-input exports, comms, replay/trajectory and contrast; **46 passing tests** for terrain, bitmap, streamed appearance and replay. These selections overlap; counts are not added. Existing confidence/contrast tests launch private temporary file fixtures; no server or shared browser was used.
- Fresh `npm run typecheck -- --incremental false`: **pass**. Report whitespace and JSON checks pass before commit.

Standards and requirements checks found no further concrete defect in scenario-specific uncertainty language, canonical finite-case recomputation/full held scenario, strict source parsing/chronology/EOP, `station-comms-2`, three source-pinned CLPS replays separate from physics, replay framing/time/coverage, terrain disposal/offline fallback/registration disclosures, bounded bitmap leases and unchanged NASA imagery, or semantic theme wiring across three audiences. Canonical `planning-5` is unchanged.

This is a bounded source review and focused verification, not a rerun of the reported full 1463-test suite or the generated web/file journeys. No flight, probability, station booking, human-study, screen-reader, authenticated live-ion or target-hardware qualification is asserted. No generators, source fixes, pushes or merges were performed.
