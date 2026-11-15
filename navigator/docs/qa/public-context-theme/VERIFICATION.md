# Public context, original loader and two-theme release

15 November 2026. Extends Rian Lunario main `29f499ce767aac4fa0000652542afa264ea50637`. Original branding source `aeb673fff6de377e5dba0982c0c55c8b0d874ee8` is preserved: no original loader script/CSS or original SVG artwork was edited. The original white SVG is exported for dark UI surfaces.

## Changes and limits

Original animation now runs per document, with a 3000 ms minimum plus authored exit; ordinary mode/theme changes retain the document-owned overlay identity and do not replay it. The original reduced-motion behavior is retained. Root static shell receives the same minimum/removal of session-only configuration.

The light reference palette is unchanged. Dark uses near-black/grey surfaces and orange selected states, shared frame shapes and existing icons/placement. Optional localStorage preference is independent of mission persistence, canvas imagery and rendering parameters.

Public location stories reuse sourced mission dates/outcomes; nearby observed touchdown pins are compared within 5 km on a sphere, with source uncertainty disclosed. Candidate regions, approximate attempts and custom coordinates do not acquire fictional historical landings. Three DSN ground-complex stories explain commands/data, handovers, two-ended geometry, link margin and radio/weather dependencies. Regional weather remains explicit-fetch, a model forecast, UTC-covered and separate from unsupported mission dates. No new station-visibility, scheduling, measured weather or dB link-margin calculation is claimed.

## Regression evidence

- 797/797 source tests pass, including 8 original-brand/loader tests, 4 Public-context tests and 2 theme tests. Original loader regression was observed red with the old session/minimum configuration and green after the correction.
- ESLint, production build, standalone build and typecheck pass; 314 native MathML expressions retain SHA256 `a55b52f3bafbbc401531949e92479c49014ee0fb59afa60dc8451c22be992f7f`.
- Existing complete Public flight verifier passes all 16 web/file journey groups on the first candidate: all 22 numeric controls, real-size Follow through full ascent/descent, contact/breakup continuation, playback, edited-input persistence and original reload animation. Its artifact SHA256 is `0cc55f3fca6cc543f91d797850c12518aa4597c44f3090df11bfc5c9a90e92ee`. Final surface fixes are checked separately below.
- Startup edge verifier passes reduced motion, session-storage denial and catalog-error/retry recovery against production.

The new actual-browser test first caught an inaccessible Public mission-story disclosure: the existing location heading passes pointer events to the map. The story section now explicitly accepts pointer events. Earlier test-only failures used the visible “Sites” text instead of its accessible Show site drawer label, and did not dismiss the existing post-reload introduction. Those harness errors were corrected without force-clicking or weakening interaction gates.

Slop scan reviewed: the new optional preference storage catch deliberately keeps the theme usable when localStorage is unavailable. Original vendor catches and existing unrelated scanner findings are retained, not silently rewritten.

Target-device, screen-reader and unprompted human learning/enjoyment studies remain open. These tests do not certify operational landing planning or DSN pass availability. Hosting remains teammate-owned.

## Final artifact and Public browser journey

Final application source `6b52443`, standalone artifact commit `76cf7be`. Final offline HTML: **81,164,024 bytes**, SHA256 **a7270fc95067acfacb422a368eb8f24c72a3d54c2ba0418b45e881cbbeea5342**. The final production bundle uses `.next-lunario-theme-release`.

Actual Chrome 157 browser checks pass for web and disconnected file: original first/normal/hard-reload overlay, three-second minimum, old session key ignored, original white wordmark on dark, persistence, clickable Apollo 12 history/Surveyor 3 pin, all three station stories, no unsolicited weather request, an explicitly synthetic dated weather response shown separately from unsupported mission weather, and no scene remount or loader replay on a theme change. The disconnected file sends **zero HTTP requests** and disables weather fetching. See `browser.json`, `startup.json`, and `flight-summary.json`.

The timing probe records synchronous original-overlay insertion rather than relying only on MutationObserver delivery, which can be delayed by initial offline work. The minimum gate remains 3000 ms; the original vendor bytes are untouched. The weather test reopens the disclosure after using the outside theme button, consistent with normal outside-click dismissal.

Visual review additionally found scoped legacy caption colours taking precedence over palette tokens. Dark-only rules now fix the audience caption/source text, unboxed 3D legend and map-imagery button without recolouring imagery. Actual-browser Educator/Planner caption contrast assertions require at least 4.5:1 in both web and disconnected-file journeys. The full 797-test source suite was rerun after these final surface changes and passed with zero failures; final production/offline builds and ESLint also pass.

An additional production-browser storage-denial check confirms the Dark control still changes the in-document theme without a browser exception when localStorage is unavailable; persistence is naturally unavailable in that case.

The final offline artifact also passes **8/8 native viewport tests**: 12 actual Chrome 200% HTTP/disconnected-file HUD/location states at 800×496 CSS px / DPR 2, fixed 1× lander framing, horizontal-axis focus clearance and inspector scrolling. See `native-200.json`; no viewport emulation or relaxed assertions were used.
