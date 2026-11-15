# AUD01 — reachable site drawer

15 November 2026. Worker `/tmp/lunario-eval-audience/navigator`, branch
`codex/eval-audience`. Required integration ref merged first by fast-forward to
`8cfb59a` (`refs/remotes/mac/evaluation-integration`).

## Change and cause

At 390×844, fixed drawer controls consumed the available height and flex shrinking
reduced `.site-list` to **0 px**. At native desktop 200%, the drawer also inherited
`grid-row: 2` from an earlier layout although the workspace now has one row. Its
containing area collapsed: the entire drawer measured **2 px**, preventing even
ordinary search-field clicks.

The production change is confined to the existing ≤1080 px rules in
`app/globals.css`: reset the obsolete grid area, scroll the complete drawer, keep
children at their natural heights, remove the nested list scroll/max-height, and
place the drawer above map controls and legends. Preserve left/bottom placement,
width, percentage height limits, inspector arrangement, fonts, theme, borders,
icons and content. Above 1080 px, the existing desktop list scrolling is unchanged.

## Actual verification

The new `scripts/evaluation-audience/site-drawer.mjs` runs the **actual Navigator
source and committed public data**. It bundles its test entry and compiles CSS in
memory, serves them through isolated Playwright request interception, and launches
fresh Chrome contexts. There is no listening app server, shared browser profile,
Simulator, Metro, production build or regenerated offline artifact.

| Browser surface | Dark | Light | Baseline with identical final runner |
| --- | --- | --- | --- |
| 390×844 CSS px, touch emulation, DPR 2 | PASS | PASS | Both fail: result list 0 px |
| Normal desktop, 1600×993 CSS px, DPR 1 | PASS | PASS | Both pass |
| Native desktop 200%, 800×496 CSS px, DPR 2 | PASS | PASS | Both fail: search cannot receive click; drawer 2 px |

**6/6 fixed cases pass; unchanged integration CSS gives 2 pass / 4 fail.** Each
fixed case exercises all of the following in Public mode:

- Open the drawer, type a search, select Malapert using a real touch tap or mouse
  click, verify persisted site identity and automatic dismissal.
- Tab to search, type a missing name, observe the empty result, recover with
  Shackleton, Tab to a visible result, select with Enter and verify selection.
- Change and reset the native site filter using keyboard events.
- Clear the search to expose all 47 sites, expand custom coordinates, and verify
  that the list retains positive height. Reach the footer by actual touch swipes
  on mobile and keyboard traversal on desktop; activate Source details and verify
  the real data panel opens.
- Dismiss with keyboard while the inspector is open; reopen and perform a second
  ordinary site selection with the inspector still open. Then verify explicit
  touch/mouse close as well.
- Check document width, visible control hit testing, zero uncaught page errors
  and zero missing local assets. Native 200% additionally uses mouse-wheel events
  to reveal the searched result before clicking it.

No forced clicks, DOM clicks, direct focus workaround, CSS/page-scale zoom, mocked
site handlers or hidden-state changes are used. Keyboard traversal observes the
existing help panels' 250 ms blur-dismissal transition before checking hit tests.
Native zoom is established through a temporary Chrome profile preference: the
outer window and surface screenshot remain 1600 px wide, layout width halves
1600→800, DPR doubles 1→2, and visual viewport scale stays 1. End-of-case geometry
retains those values. Temporary profiles are removed.

Search and footer screenshots were visually inspected in both themes across the
three surfaces. The constrained drawer uses its existing bottom-left location;
the heading, search, results and footer can scroll through that same area.
Exact measurements, source/test hashes, and screenshot hashes are in
[AUD01-VERIFICATION.json](AUD01-VERIFICATION.json). Raw JSON, logs and unmodified
screenshots remain in `/tmp/lunario-fix-audience-{base,final}-wheel/` and the
adjacent `.log` files; production artifacts were not edited or regenerated.

| Focused check | Fresh result |
| --- | --- |
| `node --test tests/evaluation-audience/*.test.mjs` | 5 pass, 0 fail/skipped/cancelled |
| `node_modules/.bin/tsx --test tests/audience-context.test.ts tests/audience-workspaces.test.ts` | 21 pass, 0 fail/skipped/cancelled |
| `npm run typecheck -- --incremental false` | Exit 0 |
| `node_modules/.bin/eslint scripts/evaluation-audience/site-drawer.mjs` | Exit 0, no diagnostics |
| `node --check scripts/evaluation-audience/site-drawer.mjs` | Exit 0 |
| Existing Tailwind CLI compiles actual CSS in the browser regression | Exit 0 |
| Cached `slop-scan` 0.3.0, `scan scripts/evaluation-audience --json` | 0 findings |
| `git diff --check` | Exit 0 |

Reproduce from `navigator/` with installed dependencies and Chrome:

```bash
AUDIENCE_DRAWER_OUT=/tmp/lunario-fix-audience-final-wheel \
  node scripts/evaluation-audience/site-drawer.mjs
AUDIENCE_DRAWER_CSS_REF=8cfb59a \
  AUDIENCE_DRAWER_OUT=/tmp/lunario-fix-audience-base-wheel \
  node scripts/evaluation-audience/site-drawer.mjs
```

The second command is expected to exit 1. It substitutes only the unchanged
integration CSS; all other application source/data and the final runner remain
identical. The receipt verifies matching source-bundle and runner hashes.

## Scope and handoff

This closes AUD01 at the source-level browser regression seam. Testing is Linux
headless Chrome, Public-mode drawer flows, touch emulation and actual native
desktop browser zoom. It is not physical iOS/Android or virtual-keyboard testing,
screen-reader use, all-audience acceptance, a global accessibility audit or
WCAG/mission certification. No full-suite/full-repository lint, 3D, Horizons or
final hosted/offline publication pass is claimed; science is unchanged.

Only `app/globals.css` and new evaluation-audience script/docs are delivered.
The integrator owns rebuilding and replaying the final hosted and offline app.
The historical audience report and its other findings remain unchanged.

Production fix and browser regression: `ced8e18`. The separate evidence commit
adds this report and its JSON receipt. Delivery bundle:
`/tmp/lunario-fix-audience.bundle`, `HEAD` excluding integration base `8cfb59a`.

Earlier diagnostic runs remain in `/tmp/lunario-fix-audience-*`. These include a
harness-only missing stdin flag, intermediate CSS failures before the grid reset,
and test timing/search-reset mistakes. They are not counted as passes; the final
same-runner before/after matrix is the acceptance evidence for this bounded fix.
