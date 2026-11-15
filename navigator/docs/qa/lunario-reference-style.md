# Lunario reference treatment

Source: `/tmp/lunario-reference.webp`, inspected 15 November 2026. This correction supersedes the charcoal-dashboard interpretation for the UI. The actual lunar viewport stays black.

The existing panel bodies now use opaque peach paper, cream fields and inset cream mats, 2 px dark ink frames, and an orange shadow offset by 4 px with an ink edge. Actual drawer headings, inspector navigation, comparison headings, Learn headings and disclosure summaries carry orange title strips. Selected tabs use mint with an ink frame; the header and timeline retain warm yellow/chartreuse backing accents. The header is cream for the separately owned dark Lunario logo. Body and display fonts remain unchanged in this lane.

Orange title paint and dark burnt-orange text/action ink use separate tokens: small text and chart lines need more contrast than a decorative strip. Scoped title-strip labels use dark ink. Sun remains amber and filled; Earth remains blue and a ring. No blanket SVG recolouring, NASA/image/canvas filters, synthetic map detail, reference image background, or watermark is introduced. The standalone loader retains its own dark space palette; this stylesheet adds no loader selectors.

No placement, size, padding, margin, display, grid, stacking, gesture or pointer rules are added. Borders and paint change within the existing panels. Existing dismiss buttons, icons, responsive rules, HUD anchoring and inspector resizing stay in their original markup. Native MathML, variable tooltips, charts, teaching, comparison, evidence/replanning panels and contact verdicts inherit the shared light reading tokens. Existing stage annotation landmarks in the celestial explorer and touchdown lab receive pale text independently; their controls and tooltips remain solid cream/peach with dark ink.

## Verification scope

`tests/lunario-reference-style.test.ts` checks CSS parsing, the reference palette, real heading/selection selectors, hard frames/shadows, the absence of geometry or imagery treatment, readable stage annotation scopes, focus/reduced-motion/forced-colour hooks, and mathematical contrast between the declared colours. All measured normal/secondary/semantic text pairs on the six light reading/selection/status surfaces exceed 4.5:1. Dark ink on the orange strip is approximately 6.94:1. These are token calculations, not a rendered contrast audit or a claim of WCAG conformance.

Root supplied a companion worktree update to `tests/refinement-brand.test.ts`, retiring its superseded branding/dark-only assertions and testing primary action text against its actual foreground token. This lane does not modify, stage or bundle that file. The new reference test reads root tokens independently from any later scoped declarations.

Root owns browser review at 800/1280/1920, native 200% reflow, actual science/MathML text contrast, all dialog/popover states, 2D/3D/split and real NASA scene verification, dark logo integration, production/offline builds and final visual acceptance. This worker starts no browser, app server or production build. Passing the source contracts is not creative acceptance.

## Fresh completion checks — 15 November 2026

- `npm test`: 766 passed, 0 failed, 0 cancelled, 0 skipped (763 top-level tests; nested tests included in the 766 total).
- `npm run typecheck -- --incremental false`: passed.
- `npm run lint`: passed, no diagnostics.
- `npm run math:check`: passed, 314 native MathML expressions; SHA-256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f`.

These fresh results supersede the earlier stale red log. The passing full suite includes the four reference-style contracts and four Root companion refinement tests. Root's updated `tests/refinement-brand.test.ts` remains unstaged and excluded from this worker's commit/bundle; integration must retain it. No scientific code or imagery changed. Rendered verification and production/offline builds remain Root's responsibility.
