# Lunar Window dark brand handoff

14 November 2026. Clevo worktree `refine-dark-brand`, branch `codex/refine-dark-brand`, base `6c9227a`. The user approved Lunar Window and the dark direction. Source verification and scratch review below do not constitute integrated product or human accessibility acceptance.

## Design and boundaries

Charcoal background `#17191c`, instrument surfaces `#202328`, pale ink `#f3f1eb`, secondary text `#c0c2c5`. Orange edges, ink outlines and a restrained 3 px offset edge echo the supplied browser/card reference. Warm orange marks actions and selection; amber filled Sun, blue Earth ring and mint success retain separate roles. Existing shapes, icons, control geometry, responsive layouts and numerical semantics are retained. Existing Outfit/Fraunces font setup stays in place; the brand wordmark uses the sans face, with an offline system fallback.

`app/mission-theme.css` defines semantic tokens and overrides fixed legacy UI colours. All eleven owned existing CSS modules now consume the tokens, including old audience/flight panels, full comparison cards, teaching cards, visibility events and geographic navigation. Native MathML inherits pale ink. Authored SVG axes, labels, paths, markers and matching legends get explicit UI colours; terrain/sphere dash patterns remain intact. Targeted important rules handle existing important sheet/play declarations and inline teaching/legend colours. Hex and browser-serialized rgb legend styles are both covered.

Control states include hover feedback, orange keyboard focus, disabled opacity/cursor, dashed invalid borders with separate error messages and busy cursor. Motion is limited to short action feedback; reduced motion removes CSS animation/transitions and smooth scrolling. The loader has no animation, synthetic progress, timer or minimum wait. Increased-contrast, reduced-transparency and forced-colour states are accounted for.

No canvas, imagery, texture or NASA colour filters are introduced. Glass saturation is removed. No edits to Navigator, global CSS, maps, runtime, scene orchestration, science, assets, storage keys or internal IDs. `scripts/build-standalone.mjs` changes **only** its document title. The original favicon remains; no dedicated Lunar Window logo was supplied.

## Integration API

```tsx
import { LunarWindowBrand } from '@/components/branding/lunar-window-brand';
import { LunarWindowLoader } from '@/components/branding/lunar-window-loader';

// Replace only the children of the existing .brand link.
<LunarWindowBrand />
// Or preserve the integrator's exact icon/orbit markup:
<LunarWindowBrand icon={<span className="brand-orbit"><Sun size={17} /></span>} />

// Replace the existing pending-data startup branch when reading the demo.
<LunarWindowLoader />
```

`LunarWindowBrand({ icon?: ReactNode })` returns a fragment: the existing Sun-orbit identity and the Lunar Window wordmark/subtitle. It creates no link, button, wrapper or new navigation. `LunarWindowLoader({ icon?: ReactNode })` returns the startup main, a framed brand card and a polite native `role="status"`: **Reading the precomputed demonstration…**. Mount/unmount according to real loading state; retain the current actual error/retry path. An optional `icon` passes through to the brand; `null` deliberately omits it.

Navigator wiring is reserved to the integrator. This branch therefore does not yet replace the visible SolarReach wordmark/startup strings in Navigator. Keep legacy SolarReach storage/export/internal identities. The specified upstream commit `d7273fb` is absent from this checkout (`git show` reports invalid object); the exact loader text and brand direction come from the user's instruction, not an unverified upstream inspection.

Layout imports the theme **after** `globals.css`. Standalone imports it **after** Navigator so esbuild emits it after component styles; the existing builder appends that CSS after the Tailwind output. Metadata and offline document title both read **Lunar Window — Lunar Landing Site Navigator**. No production/offline artifact was regenerated.

## Verification

- `npm test`: **728 passed**, zero failed/skipped/cancelled, including five new brand/theme checks.
- `npm run typecheck -- --incremental false`: **PASS**.
- `npm run lint`: **PASS**.
- `npm run math:check`: **314 expressions**, identity `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f`.
- `git diff --check`: **PASS**.
- Tests render the real brand, loader, NativeMath and expanded EquationLesson; exercise actual standalone dependency bundling with `write:false`; parse all owned CSS; verify semantic token references, imagery-filter exclusion and reduced motion. Text and meaningful semantic colours exceed 4.5:1 across all seven opaque surfaces. Control-border token exceeds 3:1 on default, hover and selected surfaces. These are token checks, not a whole-product WCAG claim.
- Installed cached `slop-scan` 0.3.0: **5 findings**, inspected. Three directory fan-out metrics; NASA errors preserve contextual causes; scenario validation intentionally rejects invalid imports with null. No owned-source finding remains. Logs `/tmp/refine-dark-slop-lint.log`. No packages installed.

Own isolated headless Chrome, `file:` scratch specimen only: `/tmp/refine-dark-specimen-ryY8ag/`. `desktop.png`, `mobile.png`, `loader.png`, `report.json` cover actual native component markup plus representative existing class/module surfaces, 1600 px and 390 px, a real expanded native lesson/chart/table, error/disabled/focus/hover and reduced motion. Final invalid state has `rgb(255,179,163)` text/border, focus is a 2 px orange outline, reduced-motion transition is `0s`; document widths equal viewport widths. No HTTP requests. This is a specimen with scratch layout, not a screenshot of the integrated app or evidence for all production interactions. Scratch preparation: `/tmp/refine-dark-preview.mjs`; latest output `/tmp/refine-dark-preview-report.log`.

Integrator retains web/offline rebuilds, real state/dialog/tooltip interaction, full responsive/200% checks and actual assistive-technology review. The existing legacy `sky-views.tsx` canvases paint fixed palette pixels internally; their pixels were deliberately preserved within this ownership boundary. If those optional legacy scientific sketches also need dark drawing colours, their owner must change drawing constants without image filters. NASA appearance and current map work belong to the other lanes.

## Owned files

- New `app/mission-theme.css`; `app/layout.tsx`; `standalone/main.tsx`; document title only in `scripts/build-standalone.mjs`.
- New `components/branding/lunar-window-brand.tsx`, `lunar-window-loader.tsx`, `branding.css`.
- Existing `components/audience/audience.module.css`, `components/replanning/workspace.module.css`.
- Existing workbench modules: `alternatives`, `audience-guide`, `data-connections`, `globe-navigation`, `physics-reference`, `solar-system-view`, `teaching-workbench`, `touchdown-lab`, `visibility-windows`.
- New `tests/refinement-brand.test.ts` and this document.

Delivery bundle: `/tmp/refine-dark-brand.bundle`, containing only this branch's work since `6c9227a`. No push or merge.
