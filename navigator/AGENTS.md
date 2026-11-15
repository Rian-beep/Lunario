# AGENTS.md

Instructions for coding agents working in this repository. Read this file before editing.

## What this project is

Lunario (legacy internal names SolarReach and Lunar Window) is a client-side planning tool for the Moon’s south pole. It compares landing sites and dates by showing where the Sun and Earth sit relative to the local horizon, so a person can judge solar-power potential and direct-to-Earth communication.

Every sunlight and Earth-visibility result is shown twice: once with a LOLA terrain horizon, and once on a smooth sphere. The difference is the point of the tool. On 15 November 2026 the user identified Rian-beep/Lunario as the actual branding source, superseding the previous Lunar Window adaptation. Preserve the original outlined SVGs and loader from aeb673f. Preserve legacy SolarReach storage/data identities and upstream attribution. Do not invent products, features, or claims. This is not a NASA operational system.

## Stack

- Next.js 15.5, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui (Base UI primitives in `components/ui`).
- Science and UI state run in the browser. There is no database and no auth.
- The precomputed catalog is static JSON plus a PNG hillshade in `public/data/`.
- Dataset build: Python 3.12 (developed on 3.12.3) with numpy, tifffile, imagecodecs, numba, and Pillow. See `pipeline/requirements.txt`.
- Node: developed on Node 22.23.4. Node 20 or newer is the expected range.
- Offline bundle: esbuild plus the Tailwind CLI, via `npm run standalone`.

## Repo layout

| Path | Role |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx`, `app/globals.css` | Next.js shell, fonts, theme |
| `components/navigator.tsx` | App state: sites, date span, playhead, modes, compare, best dates, CSV |
| `components/polar-map.tsx` | South-polar map: pan, zoom, graticule, scale bar, markers, lighting wash |
| `components/global-map.tsx` | Offline whole-Moon map and historical landing markers |
| `components/workbench/scene/` | NASA globe, numerical local terrain and lunar flight visualization |
| `lib/alternatives.ts`, `components/workbench/alternatives.tsx` | Site/date contingency engine and matrix |
| `components/sky-views.tsx` | 360° horizon, elevation chart, optional 2D oblique sketch |
| `components/about-panel.tsx` | Data & method copy |
| `components/ui/` | shadcn primitives. Do not restyle them into a second component library |
| `lib/astro.ts` | Sun/Earth geometry, disk fraction, horizon sample, scores, CSV |
| `lib/lighting.ts` | Coarse map lighting from the existing horizon grid |
| `lib/catalog.ts` | Catalog types and base64 decoding |
| `pipeline/build_dataset.py` | Horizons download, LOLA ray march, catalog and hillshade |
| `public/data/catalog.json` | Precomputed ephemeris, site masks, custom-site grid |
| `public/data/map.png` | LOLA hillshade, polar stereographic |
| `public/solarreach-navigator.html` | Generated single-file offline app |
| `scripts/build-standalone.mjs` | Inlines JS, CSS, maps, catalogs, local terrain, imagery and NASA globe |
| `standalone/main.tsx` | Entry bundled into the offline file |
| `HANDOFF.md` | Challenge context, what is done, what is not |
| `CODEX_PROMPT.md` | Paste-ready kickoff prompt |

## Setup and run (macOS)

Install Node 22 (or at least Node 20) and Python 3.12. Homebrew is the straightforward path: `brew install node python@3.12`.

```bash
npm install
npm run dev
```

The dev server binds `0.0.0.0:4317`. Open `http://127.0.0.1:4317`. The catalog in `public/data/` is already built. You do not need the Python pipeline to run the app.

Rebuild the offline file after UI or catalog changes:

```bash
npm run standalone
```

That writes `public/solarreach-navigator.html`. It must open by double-click with no server and no network tiles.

Rebuild the dataset only when ephemeris, geometry, or terrain masks change. The LOLA GeoTIFFs are not in git (hundreds of megabytes):

- `LDEM_80S_40MPP_ADJ.TIF` (40 m, 80°S–pole)
- `LDEM_60S_240MPP_ADJ.TIF` (240 m, used when a ray leaves the 40 m mosaic)

Download both from [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90). Put them in `/tmp/lunar-src/`, or change `FINE_PATH` and `COARSE_PATH` at the top of `pipeline/build_dataset.py`.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r pipeline/requirements.txt
python3 pipeline/build_dataset.py
```

Horizons responses are cached at `/tmp/lunar-src/ephem.npz`. A full rebuild needs network access to `ssd.jpl.nasa.gov` and the two GeoTIFFs.

### Checks

Typecheck (this is the check that has been kept green):

```bash
npx tsc --noEmit
```

Lint:

```bash
npm run lint
```

Horizons verification. Run this after any change to ephemeris parsing or to Sun/Earth geometry in `lib/astro.ts` or `pipeline/build_dataset.py`. It re-queries Horizons observer tables and compares them with the derived azimuth and elevation. Do not treat a skipped run as a pass.

```bash
python3 - << 'PY'
from pipeline.build_dataset import expected_times, load_ephemeris, validate_against_observer, SITES
times = expected_times()
ephem = load_ephemeris(times)
print(validate_against_observer(times, ephem, SITES))
PY
```

The last recorded result, 14 Nov 2026, was 112 samples, maximum absolute error 0.0007° in elevation and 0.005° in azimuth. If a new run is materially worse, fix the geometry before shipping numbers.

Run `npm test` for the TypeScript numerical, persistence and scene regression suite. Run `npm run typecheck -- --incremental false` and `npm run lint`. `npm run verify:horizons` checks the decoded client data against fresh observer tables; the Python pipeline also retains its startup checks. Record fresh results rather than treating earlier counts as permanent.

## Coding conventions

- TypeScript is strict. Match existing names and file boundaries. Do not add a second data path that disagrees with `lib/astro.ts`.
- The Python pipeline and the TypeScript geometry must implement the same Sun and Earth formulas. `poseAt` interpolates for animation; it does not replace the hourly Horizons-derived samples.
- UI copy is specific. No lorem, no “Welcome to your app.” Public and Educator modes stay in plain language. Planner may show azimuths and sampling notes.
- shadcn primitives live in `components/ui`. Use them for buttons, inputs, sliders, and tabs.
- Use the accepted cream/peach, orange-strip, heavy-ink, offset-shadow and mint reference theme in app/mission-theme.css; preserve icons and placement. Do not recolor NASA imagery. Sun is amber and filled. Earth is blue and a ring. Do not encode sunlit versus shadow, or good versus bad, by red versus green alone.
- Comments only where the science or a limit would be unclear from the code.

## Rules that do not bend

- Do not invent measurements, site coordinates, illumination percentages, or mission claims. If a number is not computed from Horizons plus the LOLA masks, label it as an approximation or do not show it.
- Keep the terrain result next to the smooth-sphere result. Do not hide the sphere numbers to make a site look better.
- The offline HTML must keep working with no network tile dependency. Map imagery is the committed hillshade, not a live NASA tile service.
- Keep accessibility behaviour that is already implemented: keyboard scrubbing (arrows, shift-arrows), map keyboard pan and zoom, Space toggles play except when a field or button is focused, the aria-live region announces play/pause and sunlit versus shadowed only when that state changes, playback does not start on load, and `prefers-reduced-motion` steps time with no trails. Sun and Earth stay distinguishable by shape as well as colour.
- Do not claim the app is “accessible by design” or WCAG-conformant. Actual screen-reader use, complete canvas alternatives, target-device acceptance and a global contrast audit remain outstanding. Automated native 100%/200% reflow, keyboard and selected rendered-text contrast checks pass for the identified release; preserve their exact scope rather than claiming general conformance. See `docs/qa/refinement/FINAL-VERIFICATION.md` and `docs/IN-FLIGHT.md`.
- Rerun the Horizons check after any change to the ephemeris or the geometry.
- Do not add auth, a database, or a second component library.
- Site pins that are not published coordinates must stay labeled as derived (the Shackleton rim crest is a LOLA sample from this pipeline, not a NASA pin).

## Parallel ownership

The Mac integrator owns the running preview, shared planning contracts, builds and generated offline HTML. Sol workers use isolated worktrees and explicit file ownership. Eight earlier Clevo deliveries are integrated; do not replay their bundles. Current task ownership and scientific gates are recorded in `docs/qa/planning/IMPLEMENTATION-STATUS.md`. No worker may start Simulator, Metro, shared browser sessions or another app server. Preserve the map-first layout, Lunario reference theme and dismissible controls.

## Planning authority

`lib/assessment.ts::evaluateScenario` is the only full-mission assessment entry point. Reuse it in all search, comparison, sensitivity, teaching and export flows. Schema 2 keeps subsystem heights separate from display observer height. `planning-4` includes interval operations, explicit coarse terrain and scoped analytical engineering screens; increment this identity for numerical or constraint-meaning changes. Never infer landing readiness from a regional slope, image, generic trajectory or external reported pass. Read `docs/MODELS.md` and ADRs 0005/0006 before scientific changes.
