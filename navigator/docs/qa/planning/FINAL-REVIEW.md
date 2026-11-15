# Final cross-feature source review — T00–T25

Review time: 2026-11-14T14:25:05.190585+00:00. Source Git HEAD: `46ada04d71935ec8d3c970ec2f8ffeb965a99115`. Dirty snapshot SHA-256: `54fedd8c7dcd208f786b550f8db6dd457c44e05336b1983ee28af415b1207749`. Fingerprint convention: sorted dirty tracked plus untracked file paths, each followed by NUL, working-file SHA-256 and newline; hash the resulting UTF-8 inventory. Generated artifact identity is included for traceability, not a claim that it matches the latest source.

This is one bounded source review of the parent’s live integration, independent of its wiring implementation. No application source was changed and no server, build, simulator, browser automation or repeated full test suite was run. The parent reported 285 tests, types and lint green before the latest celestial-cache patch; that report is not fresh post-patch evidence. Separate NASA browser and map-contrast audits own their actual rendering evidence.

## Findings and disposition

- **P2 — Legacy prepared mode silently changed on location edits.** `components/navigator.tsx`, selectSite and map/custom-placement handlers originally interpreted an omitted terrainMode as global-context even though analysis treats omission as prepared. Loading the prepared demonstration/old record and selecting a historical site could change scientific scope without the terrain toggle. Parent accepted the targeted fix: location-only changes retain mode; a fresh initial scenario remains explicitly global-context. The reviewed callbacks no longer add that automatic upgrade. Verify this user path in the rebuilt artifact.
- **P2 — Historical comparison banner contradicted coarse assessments.** `components/navigator.tsx`, saved-comparison notice originally inspected only native site.horizons. Two historical records with explicit global-context could show computed partial/failing rows beneath a banner saying terrain/power/storage were unassessed. Parent restricted the notice to records without global-context; that source condition is verified. The actual comparison table still delegates to the shared assessment authority.
- **P2 — Cold walkthrough identity and manual mode were stale.** `docs/DEMO.md` described planning-2 although the live fixture/evaluator are planning-3. Its manual historical-site path also needs Prepared horizons only selected explicitly when starting from a fresh global-context scenario. Parent accepted the documentation correction and updated `docs/MODELS.md`; the DEMO update was still pending at the source check. Exact fixture loading remains preferable for exact scenario-key reproduction; manual recreation must disclose its selected mode.
- **P2 — Shared celestial-source waiting lacked cancellation/deadline bounds.** `lib/celestial-assets.ts`, loadCelestialAsset awaited the shared source promise before observing caller cancellation; a stalled source response could leave a cancelled caller and later consumers waiting indefinitely. The owner response also used arrayBuffer before checking its pinned byte length. Shared ownership itself is correct: cancelling a departing renderer must not abort its successor. Parent accepted per-caller abort racing plus an owner-owned30s deadline and bounded response reading. That final patch and its regression results were not yet reviewed here; do not mark this finding closed solely from the earlier six loader tests.

No P1 finding was identified. The pending documentation/cache items and final artifact checks remain explicit; this review does not declare every requested gate complete.

## Cross-feature result

- **Canonical planning and constraints (T00–T08):** the common assessment entry point owns terrain/smooth mission results, constraints, first-known events and evidence. Full stay bounds are exclusive at the final catalog endpoint. Independent array/antenna heights and unsupported/missing channels retain their meaning. Global coarse evidence cannot become unconditional physical approval.
- **Search, comparison and finite experiments (T09–T12):** calendar candidates preserve complete stays/hardware; request keys and cancellation reject superseded search work. Comparison, sensitivity and tested alternatives use actual authority outputs and exact candidate states. Conditional, incomplete and failed outcomes remain distinct. Sparse sweeps are not minimum-required or probabilistic estimates. The historical-banner correction prevents a presentation contradiction.
- **External evidence, exports and teaching (T13–T16):** user reports remain externally reported and scenario-bound. Decision-package import recomputes current results rather than trusting imported historical metrics. The teaching notebook captures a locked baseline and one variable, retains prediction/evidence/explanation and does not erase saved records on reset. Its outage-order demonstration is explicitly synthetic and uses the same energy evaluator.
- **Accessibility, science and portable packaging (T17–T20):** screen-reader operation and unresolved backdrop/contrast states remain independent human gates, not WCAG claims. The available science.json records planning-2/commit6e5067f and scientificValidation INCOMPLETE; it is not fresh global-model3 physical verification. Global unit/integration tests establish numerical/software behavior, not independently validated terrain/frame uncertainty. The offline builder embeds catalog, terrain, imagery, NASA Moon, equipment, evidence, demo, global gzip and celestial globals. Its safe JSON expression was checked in isolation to preserve a `<m/pix>` string. Actual final rebuilt file parity belongs to the parent’s artifact/browser validation.
- **Requested scene/global extensions (T21–T25):** numerical global heights come from calibrated PDS LOLA, not visualization vertices or brightness. Prepared site/polar masks retain priority; explicit mode/source/model identity carries through the numerical pipeline. The scene’s local/body-frame camera handoff preserves physical camera/target/up coordinates, while the original NASA globe is adopted through a frame transform. Live JPL azimuth/elevation drives Sun/Earth directions. Authored body textures/orientation and nominal/enlarged scale are explicitly distinguished from measured celestial attitude, size and range. Hide-panels source rules hide nested camera controls and overlays as well as outer panels; input alignment and actual interaction remain the separate visual audit’s responsibility.

## Cold judge story and remaining gates

The actual prepared fixture retains the same hardware and336h stay: Connecting Ridge2027-06-29 conditional →14day delayed arrival2027-07-13 fails assessed energy →same delayed dates at de Gerlache–Shackleton ridge conditional. The restored case still has a168h geometric Earth outage and no configured outage/radio requirement. Its preference is for the assessed energy requirements, not landing readiness. The prepared-only historical case remains unknown; explicitly enabling global context computes coarse results and may fail them. Audience changes must not alter the scenario.

Before claiming final delivery, land the remaining accepted source fixes, rerun the final loader/complete validation after those changes, rebuild and exercise the actual portable artifact, and preserve manual screen-reader/independent terrain-frame gates as incomplete. No NASA operational qualification, scientific uncertainty certification or accessibility conformance follows from this source review.

## Dirty snapshot inventory

- `app/globals.css` — `90e0fb7189d996dc4d8a6b4343cdf7cef008f9665deb57505895574864c52283`
- `components/navigator.tsx` — `3891c3fc9daeb1525f9a45a62df2900f1a9517a1f5b81c95e94fa5b73abbd544`
- `components/workbench/decision-panel.tsx` — `f80eb0154f17a1cfdd64d557a44e0047eb358ba70cb706533238e57945db2e4c`
- `components/workbench/panels.tsx` — `bfe3cff30332cb268125b117554a8f93a1e3c1a69ddbf1569bae7a366bec7275`
- `components/workbench/scene.tsx` — `1fbb66235ff25ababd25a26ea653ae29839229d3ad527f68dcc306aa653915e8`
- `components/workbench/scene/runtime.ts` — `5192e759a9d25be3fdb92d73259ca2d9b0c3a34c001f5cb4d73e4f2caaee4bba`
- `components/workbench/scene/surface.test.ts` — `3ac9eaa271243c72566b46e24f12dbbfa9a464b211e133c0697a16c7c8c0afc2`
- `components/workbench/scene/surface.ts` — `2fa5e9c01a09db973aadcb71c3917fd2842dbf5d6ab890f8be71efd543ecc01a`
- `docs/MODELS.md` — `e3968f1086f6dd8f45e0c0c3ec0e13f1c8276919e2c010ebf74d8f8f5997585a`
- `docs/decisions/0006-shared-planning-assessment.md` — `2c1b9974fec3904e0c78e0521a34fe9a0718741d57f1c4822b659175155b0865`
- `docs/qa/planning/science.json` — `f8fffa7994984d3feee176d366c57999d7b05e89c77ad16d52a16ab130c1b03b`
- `lib/analysis-context.ts` — `c714189ec6fc4121963c0fc1944f87e32fadf51e085f5131945c100ad3f77c3d`
- `lib/assessment.ts` — `6d3d2e008fe7b062a93fca977f0b9247fcc30bfc53f380cca0a80be761595b09`
- `lib/catalog.ts` — `87fcb058b0aff28be6c4f7ba3ff6ed39e191c48986b5ccff24c4fc1ebc4fd6ae`
- `lib/celestial-assets.ts` — `3447fc6d15679b64119b9b08a489cf9219e88b1318d7a723a4f7c34337f0255b`
- `lib/scenario-diff.ts` — `c4b9a1d9cfacfdf9a5522e602e8aea9c62deeaefc8c4a9ead4755a3b019ed53e`
- `lib/site-transition.ts` — `1121666fc1545b540ee431d230406b1f9a350ca11d20e4e6cf8132ed3f40b5bb`
- `lib/terrain.ts` — `4a90e62db04d36c5bbf18784dba09845ebb978b2808fffdfa0c07a79c64f0606`
- `public/data/evidence-manifest.json` — `cd50cc5e57d28e8cb2f7a0a88ba0e99c8b60f2653539e760df130098abd0a1a9`
- `public/data/planning-demo.json` — `dd7ec749e928283f63fa936093e51c58c59d21d7ec4d4fd7cb870c9e8f1c87a2`
- `public/solarreach-navigator.html` — `8e7bd86a53b2734cd9d1dfc7b92c2508689150ca337cf9b531f6268e6aca49d9`
- `scripts/build-standalone.mjs` — `1f6525ec245634ffdfef624befc03a1bcdfcc167b8be065701013eed14b37711`
- `scripts/verify-planning-flows.mjs` — `51d9560c2849a6ae63c7564e7b487606496b723fe2b41d7531a52f6e4610b7ad`
- `tests/celestial-assets.test.ts` — `db5fbd861f1ee2c7ec07da9a5c86297692cdc1bfd9c7f4589c1a3ff487c78f0d`
- `tests/site-transition.test.ts` — `64ad4905689d9380922b76ecbbb8d638ffc04bea7c65a6c9dce13dc017eb88f2`
