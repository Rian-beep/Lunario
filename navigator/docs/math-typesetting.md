# Native equations and expandable lessons

Worker delivery: 14 November 2026, Clevo `codex/native-math`. This is an isolated presentation change; the numerical relations, legacy equation strings, aliases, scenario identity and assessment authority are unchanged.

## Contract

- The integrator owns the exact dependency pin `temml@0.14.0` in package manifests. For verification this worker installed it with `npm install --no-save --package-lock=false temml@0.14.0` in the shared base. No package files are included in this delivery.
- `NativeMath({expression, display?, label?})` accepts a legacy string from the authored registry, renders one semantic MathML root and retains that legacy accessible label unless a descriptive label is supplied. There is no additional `role="math"` wrapper.
- `lib/math-typesetting.ts` maps all 56 distinct required relations, all 104 notation entries' symbols, and supplementary symbol-key entries. Unknown equations/symbols throw explicitly. No heuristic TeX parser, arbitrary user TeX, raw-equation fallback, remote font or CDN is used. `renderToString` uses `trust:false`, `throwOnError:true`, no source annotation and bounded expansion/size. Render memoization is capped at 256 outputs.
- Local font fallback is Cambria Math, STIX Two Math, STIX Math, Latin Modern Math and the system `math` family. The basic presentation MathML uses its native fractions, powers, subscripts, operators and accents without importing Temml's downloadable-font stylesheet.
- The API follows [Temml's official administration documentation](https://temml.org/docs/en/administration#server-side). Verify actual rendering with the integrator's browsers; SSR proves structure, not font placement or assistive-technology behavior.

## Lessons

Info explanations, the audience variable explorer, model-relation cards and the physics reference use the shared native renderer and `EquationLesson`. Lessons collapse independently. Info keeps its concise explanation first and leaves the full lesson closed in all audiences. Existing plain-language definitions and metadata remain available; a few prose references were spelled out to avoid exposing legacy underscore syntax. Symbols cannot be nested in native HTML select options, so those options use the existing descriptive labels; the selected heading shows the native symbol.

A lesson exposes standard form, selected-variable meaning/units/intuitive explanation, a complete relation-specific symbol/unit key, behavior/graph shape and applicable scope/assumptions. Physics topics additionally retain frame, current calculated scope, supplied inputs and required external evidence. Text and tables use 14 px; mathematical display is larger. Styles stay inline in owned components so Node SSR imports do not need a CSS loader. No shared CSS was changed.

31 scalar relations have explicitly declared illustrative charts. Every chart names held factors, shows a derivation/normalization or reference subtraction, labels axes/units/values, exposes a complete sample table and provides Previous/Next buttons with a polite selected-value readout. Teaching charts use no catalog/scenario/assessment values. The solar example holds area 4 m², efficiency 0.30, loss 0.15, visible disk 1 and incidence 1: at 1000 W/m² the output is 1020 W.

Battery histories/reserve, terrain visibility, solar-direction mission response and integrated trajectories do not acquire a universal curve. The reference explicitly keeps current mission response unknown and offers a button to the existing “Sensitivity & tested alternatives” panel. That button opens/focuses the existing summary and its ancestor disclosure panels when present; otherwise it explains that Planner must be opened. It does not run an assessment or infer an untested threshold.

Info now allows Tab through its expanded content; Escape and Tab beyond its boundary return to the info button. Lesson navigation/Space events stay within the disclosure/scroll/chart controls rather than scrubbing or playing the app timeline.

## Verification and integrator checks

Fresh worker checks:

- Focused numerical notation, audience, physics-reference, MathML and lesson tests: **27 passed**.
- Full `npm test`: **446 passed, zero skipped**.
- `npm run typecheck -- --incremental false`: passed.
- ESLint on all nine owned TypeScript/TSX files: passed.
- `git diff --check`: passed.
- No scientific implementation changed, so Horizons was not rerun.
- `slop-scan` was not on this worker's PATH; existing project triage was read. No extra tooling was installed.

The plain `tsx` SSR test of the existing AudienceContextPanel emits React's warning about its pre-existing `<style jsx>` attribute outside Next's compiler. The tests pass; the Next source styling was retained.

The integrator owns the preview, browser and offline build. Still verify native font rendering and vector accents in target browsers; expanded Info keyboard scrolling/Tab/Escape; disclosure reflow at narrow widths and 200% zoom; chart horizontal scrolling at 14 px; sensitivity navigation with Planner mounted/unmounted; and the offline build's lack of font/CDN requests. No app server, shared browser, Metro, Simulator, generated offline artifact or scene file was started/changed by this worker. These checks are pending, not a claimed visual or screen-reader acceptance.

## Precompiled MathML build workflow — 14 November 2026

This delivery supersedes the runtime Temml rendering/cache described above. Authored TeX in `lib/math-typesetting.ts` remains the source. Its `listMathExpressions()` returns a sorted copy of every registered expression and TeX mapping; relation and symbol metadata are unchanged. The browser imports only the finite, frozen `lib/generated/native-mathml.json` lookup. Unknown expressions, absent output, or a TeX mismatch throw; there is no parser fallback or runtime rendering cache. Existing NativeMath styling, native fractions/subscripts and font behavior are unchanged.

After changing authored expressions, regenerate and commit the JSON with the source:

```bash
npx tsx scripts/build-mathml.ts
npx tsx scripts/build-mathml.ts --check
```

Do not edit generated MathML by hand. The generator writes only `lib/generated/native-mathml.json`, can bootstrap missing/malformed JSON, and requires installed Temml **0.14.0**. The integrator owns moving that exact dependency to development dependencies and adding the package script/check gate. The browser needs no Temml runtime, font/CDN request or fetch.

The manifest contains **305 expressions / 610 exact XML outputs**, including every notation symbol and all model/physics relations. Its SHA-256 identity hashes UTF-8 `JSON.stringify({parser, options, expressions})`: parser name/version, the exact rendering options plus `displayModes: [false, true]`, and `{expression, tex}` entries sorted by JavaScript code-unit order. Options remain `throwOnError: true`, `trust: false`, `annotate: false`, `maxExpand: 100`, `maxSize: [10, 10]`, `xml: true`. Each entry stores its TeX and independent inline/block XML. `--check` recompiles both modes and compares the complete serialized file, returning nonzero for missing output, changed mappings/options/version, XML drift, extra/missing entries or serialization drift. It never writes. Current identity: `9c9cd1f63443472f27d9e790e1c352a500a6c0cab93f2863087f05a80fbab7ef`.

Focused regression command:

```bash
npx tsx --test tests/precompiled-math.test.ts tests/math-typesetting.test.ts tests/equation-lesson.test.ts
```

The new tests compare every inline/block value against fresh Temml 0.14.0 XML, recompute the identity, exercise generator drift/repair in an isolated temporary fixture, verify fail-closed lookup and inspect a production browser esbuild metafile for parser dependencies.

Measured bridge-only comparison against `git show 205f04ef50985b0b0d7a4fb9a1252bcc29fb97c9:lib/math-typesetting.ts`, copied into an isolated temporary directory. Both bundles export exactly `nativeMathMarkup`, `mathToTex`, `mathRelation`, using esbuild **0.28.2**, `platform: browser`, `format: esm`, `target: es2017`, minification, production NODE_ENV and Node `gzipSync` defaults:

| Measurement | Prior runtime bridge | Precompiled bridge |
| --- | ---: | ---: |
| Raw bundle bytes | 278,367 | 241,639 |
| Gzip bytes | 81,239 | 33,949 |
| Temml bytes attributed in output metafile | 212,512 | 0 |
| Temml input module bytes | 478,952 (`dist/temml.mjs`) | 0 (no Temml inputs) |

Savings: **36,728 raw bytes / 47,290 gzip bytes**. This is a same-settings library bridge measurement, not a whole-app download or latency benchmark. No Next build, standalone generation, server or browser was used.

Fresh checks: **16 focused tests passed; full suite 483 passed, zero failed/skipped**; full nonincremental typecheck, repository lint, generator `--check` and diff whitespace check passed. `slop-scan` is unavailable on PATH and in local binaries; existing triage was read. No numerical science changed, so Horizons was not rerun. Integrator browser, offline and visual acceptance checks above remain applicable.
