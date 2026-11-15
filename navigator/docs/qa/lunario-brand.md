# Lunario original branding and startup

Worker scope: `components/branding/*`, `public/branding/lunario/*`, `tests/lunario-branding.test.ts`, and this document. No Navigator, theme/layout, scene, numerical, storage identity, dependency, generated offline HTML or build-script edits. Root owns integration, production builds and browser verification.

## Source and offline embedding

Original source: [Rian-beep/Lunario](https://github.com/Rian-beep/Lunario/tree/aeb673fff6de377e5dba0982c0c55c8b0d874ee8), exact commit `aeb673fff6de377e5dba0982c0c55c8b0d874ee8` (locally fetched as `refs/remotes/lunario/main`). Inspected README, index, site CSS, outlined wordmark/mark SVGs and loader JS/CSS. The original dashboard is explicitly a placeholder; its branding is reused without importing its placeholder claims or layout.

`public/branding/lunario/` retains exact original bytes and relative paths for the README, index, site CSS, five logo variants, loader script/stylesheet and the loader's Geist Mono WOFF2. `provenance.json` pins repository, revision, byte counts and SHA-256 for every vendor file. Tests independently pin those hashes. Original loader JS SHA-256: `7f7dfa0d123841c838f8c7a79db6456b582c297c674a0749f16ac4f44249a149`; CSS: `28ff62158122a223d875acf0da3ae42944aa1b7568bf90a68b596788c3a253f1`; dark wordmark: `f84ad5fa1e02b6ab53d677a96c3eb495c7c994e1ec42f97c4c5aa11251069656`.

Generate the runtime module with:

```bash
node components/branding/generate-lunario.mjs
node components/branding/generate-lunario.mjs --check
```

The generator verifies vendor hashes before writing/checking `lunario-vendor.generated.ts`. It embeds the actual `logo-dark.svg` and `logo-mark-dark.svg` as SVG data URIs, exact JS as a string, and exact CSS with **only** its relative font URL replaced by a WOFF2 data URI. The outlined wordmark has no font dependency. The loader builds its own original SVG polar grid, ridge, ring and typewriter content. No runtime external asset request, CDN, source map, decorative altitude or fabricated progress is added. Root's existing esbuild traversal can bundle these ordinary TypeScript imports directly; it needs no network, asset loader or new builder rule. The vendor reference index/site CSS are retained for audit and never injected as app styles.

## Root integration

Existing imports remain valid:

```tsx
import { LunarWindowBrand } from "./branding/lunar-window-brand";
import { LunarWindowLoader, LunarioStartup } from "./branding/lunar-window-loader";
```

`LunarWindowBrand({icon?: ReactNode})` renders the **actual original dark-ink outlined Lunario SVG**, with `alt="Lunario"`. The legacy icon prop is accepted and deliberately ignored because the original logo already includes its mark. Use inside the existing home link on Root's cream/peach reference UI; change that link's accessible name to Lunario. No replacement Sun icon, separately typeset lettering or subtitle is rendered. Styles use only branding selectors; no app tokens or layout rules change.

`LunarioStartup({ready: boolean})` renders no React DOM. Mount it alongside **all** Navigator return branches:

```tsx
<>
  <LunarioStartup ready={loaded || Boolean(error)} />
  {error ? errorContent : loaded ? navigatorContent : <LunarWindowLoader />}
</>
```

Use actual existing loaded/error state names. Both success and error are terminal readiness: an error must remain visible after the original loader lifts away. Mounting a separate Startup in each conditional branch is also safe: the vendor overlay is appended directly to `document.body`, persists across branch remounts and receives readiness from the next mount. Prefer one shared sibling where practical. Do not condition Startup on loading alone, manually call `show()`, or remove its body overlay in React cleanup.

`LunarWindowLoader({icon?: ReactNode})` is a static accessible fallback with the original logo, `aria-busy="true"` and native loading copy **Prepare for landing**. It covers real loading when the session animation has already been skipped. It does not initialize the overlay by itself; Root must mount Startup alongside it and keep Startup present for terminal branches. Props types are exported (`LunarWindowBrandProps`, `LunarWindowLoaderProps`, `LunarioStartupProps`).

## Lifecycle contract

`updateLunarioStartup` records initialization on the document using a namespaced `Symbol.for`, before appending the original inline script. React Strict Mode effect replay, branch remounts and even another copy of the wrapper in the same document reuse that record. Script initialization occurs once per document, with:

- `data-auto-hide="false"`: real application readiness controls dismissal.
- `data-once="session"`: the upstream `lunario-loader-seen` key controls tab-session replay.
- `data-altitude="0"`: the upstream decorative descent telemetry line is disabled.

The script executes synchronously when appended, so the wrapper calls the actual `window.Lunario.loader.hide()` immediately on the first `ready=true`, including an already-ready mount. There is no polling, artificial progress, load-event readiness inference, `window.onload` replacement, or cleanup that prematurely hides a still-loading app. Once readiness is true, later mounts cannot reopen the overlay. The vendor itself completes its minimum duration/typewriter/lift-away, cancels its animation frame, removes its overlay, releases its body scroll lock and dispatches `lunario:loaded`.

The default upstream minimum is 1800 ms plus lift-away (520 ms without telemetry). A ready call does not cut off the original typing. Upstream reduced motion types immediately, keeps the ring still, caps the minimum at 700 ms and uses a 300 ms fade without content lift. Session-suppressed initialization provides the upstream resolved no-op `hide()` API. If sessionStorage is blocked, the upstream catch permits the animation; the document record still prevents duplicates. A new document with blocked storage may replay because browser tab-session persistence is unavailable. No vendor storage identity or source behavior is altered.

## Verification and integration follow-up

Seven new tests pass. They verify exact original hashes, regenerated runtime drift, original outlined SVG features, embedded source/font identity, legacy prop compatibility and SSR fallback, esbuild browser traversal without external assets, and manual-readiness lifecycle. Lifecycle tests execute the unmodified vendor script against a controlled DOM/timer fixture: repeated initialization, delayed readiness, already-ready/error terminal readiness, session suppression, blocked storage, reduced motion, original visual elements, absent altitude, scroll unlock and zero remaining scheduled callbacks after dismissal. These are DOM-boundary regression checks, not actual React/browser/layout acceptance.

Fresh required checks on 2026-11-15: `npm test` **769/769 PASS**, zero failed/skipped; `npm run typecheck -- --incremental false` **PASS**; `npm run lint` **PASS**, zero warnings; `npm run math:check` **PASS**, 314 expressions, SHA-256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f`. Generator drift check and `git diff --check` pass. `slop-scan` is not installed on the worker PATH.

These full checks include Root-owned working-tree companion edits to `tests/refinement-brand.test.ts` and `eslint.config.mjs`: Root retired the rejected Lunar Window/Sun assertions (replaced by the actual-brand tests here), retained theme/title checks for integration, and ignored the byte-exact vendor JS in lint. The initial run failed that obsolete brand expectation; it was not an unrelated/pre-existing failure. Companion files are deliberately **not staged, committed or bundled by this worker**; Root must retain their updates during integration. Without that companion test update, the base suite still requires the rejected identity.

Root must run first-session/reload, actual Strict Mode/navigation remount, reduced-motion, terminal-error, blocked-storage and disconnected `file://` browser checks. Confirm the correct outlined logo against source, original grid/ridge/ring/typewriter/lift-away, no altitude/progress, no external requests, usable loaded/error content, no duplicate overlay, and mobile/200% rendering. No worker browser, server, production build, dependency installation, push or merge was run; no visual or user acceptance is claimed.
