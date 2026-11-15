# Handoff: SolarReach Lunar Landing Site Navigator

This file is the project brief for someone continuing the work. `AGENTS.md` is the coding contract. Neither file changes how the app behaves.

## Context

2026 NASA Space Apps Challenge, challenge **Lunar Landing Site Navigator**.

Brief: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/

Team: Luke (Brand Name Changes) and one collaborator.

Branding: **SolarReach**, a clean-energy brand in development from the studio Brand Name Changes. Do not invent SolarReach products, features, or performance claims. The navigator is a challenge entry under that name, not a NASA product and not an existing SolarReach product.

The challenge, in short: missions to the Moon’s south pole face extreme lighting and communication constraints. Tools that compute Sun and Earth positions exist, but their interfaces are hard to use. Build an intuitive tool so mission planners, educators, and the public can compare landing sites and dates quickly, showing Sun and Earth relative to the local horizon, to judge power and direct-to-Earth contact.

## Why this challenge

The team chose this challenge because it had about 1,000 global entrants, against about 2,500 for the alternative game challenge. Those headcounts were supplied by the team for this handoff. They were not re-counted against the Space Apps site when these notes were written.

The team builds web apps and has no game experience. The work uses existing NASA maps and ephemerides. It does not train a new illumination model.

## Space Apps rules that matter here

Global Awards require at least one NASA data source from the challenge Resources tab. **JPL Horizons qualifies**, and the app uses it for every Sun and Earth position. LOLA topography from the NASA GSFC Planetary Geodesy Data Archive supplies the terrain. Credit both in the product. Do not drop Horizons in favour of an uncredited approximation.

A Space Apps forum thread warned that project work should not predate the hackathon weekend. The weekend is **14 November 2026**. Be honest about timing: this repository is a **validation prototype built on 13–14 November 2026**, before and at the start of that weekend. Do not describe it as work that began earlier, and do not delete that fact to make the entry look compliant. If the team submits, they should read the current rule themselves and decide what to say.

## The challenge page

During the original build the challenge URL returned **HTTP 500**. The prototype followed the public challenge summary, the written brief, and the resource list (Horizons, PGDA illumination and Earth-visibility maps, Moon Trek, LOLA, SPICE). **Re-read the live page, including Details and Resources, before treating this checklist as complete.** If the live text adds an objective, this list is missing it.

## Requirements

| Requirement | Status | Where |
| --- | --- | --- |
| Intuitive comparison of south-polar sites and dates for planners, educators, and the public | Met | `components/navigator.tsx` modes Public, Educator, Planner |
| Sun and Earth positions relative to the local horizon | Met | `lib/astro.ts` (`sunAzEl`, `earthAzEl`, `horizonAt`); drawn in `components/sky-views.tsx` |
| Power potential: fraction of time sunlit, longest dark period | Met | `summarize` in `lib/astro.ts`; score cards in `navigator.tsx`. “Any sunlight” means any part of the solar disk above the horizon. Center-of-Sun and mean disk fraction are also shown |
| Direct-to-Earth windows: fraction of time Earth is visible, windows listed | Met | Same `summarize`. Primary test is Earth’s **center** above the terrain. Planner also shows an any-limb test. Windows are listed under the horizon |
| Smooth-sphere result beside the terrain-corrected result | Met | Score cards, compare table, best-dates table, educator copy. Do not remove the sphere column |
| Real terrain horizon from LOLA, not a made-up mask | Met | `pipeline/build_dataset.py` ray march on PGDA LOLA GeoTIFFs. Catalog masks in `public/data/catalog.json` |
| Real Sun and Earth directions from Horizons (or equivalent), checked | Met | Horizons DE441 sub-solar point, sub-Earth point, range, and solar diameter. `validate_against_observer` in the pipeline |
| Precomputed static data, app runs client-side | Met | `public/data/catalog.json`, `public/data/map.png` |
| Site picker on a south-polar map | Met | `components/polar-map.tsx` |
| Interactive map: pan, zoom (wheel, pinch, drag, +/−, keyboard), graticule, scale bar | Met | `components/polar-map.tsx` |
| Clickable site markers; selected site highlighted; compare sites marked | Met | `polar-map.tsx`; compare ids come from `navigator.tsx` |
| Click the map to set a custom point south of 80°S, plus typed lat/lon | Met | `polar-map.tsx`, custom form in `navigator.tsx`. Custom terrain is the nearest grid cell, not a new ray march |
| Live lighting overlay from the DEM and Horizons at the scrubber time | Met, coarse | `lib/lighting.ts`. Nearest cell on the ~1°×2° horizon grid. Stated on the map and in `components/about-panel.tsx` |
| No network tiles; offline file still works | Met | Hillshade is `public/data/map.png`. `scripts/build-standalone.mjs` inlines JS, CSS, map, and catalog |
| Date or date-range picker and a time scrubber | Met | `TimeControls` in `navigator.tsx` |
| Play / pause, speeds (1 hour, 6 hours, 1 day per second), no autoplay | Met | Playhead effect in `navigator.tsx`. Speeds are hours of mission time per second |
| While playing: Sun and Earth move on the 360° view with a fading trail; map lighting, chart cursor, and a live score line update | Met | `HorizonPanorama` trail; lighting uses `Math.floor(playhead)`; running totals use `sliceSeries` |
| Optional 3D or oblique horizon | Partly met | `ObliqueSketch` in `sky-views.tsx` is a **2D sky-dome sketch**. It is off until the user enables it. There is no 3D terrain mesh |
| Elevation-over-time chart | Met | `ElevationChart` in `sky-views.tsx` |
| Compare 2 or 3 sites on the same dates | Met | Compare tab in `navigator.tsx` |
| Best dates inside a range | Met | `rankWindows` / `distinctWindows` in `lib/astro.ts`; Best dates tab |
| CSV export | Met | `csvFor` in `lib/astro.ts` |
| Accessible interaction: keyboard, visible focus, aria-live, reduced motion, shape plus colour | Partly met | Implemented as coded below. Not yet audited. See “Outstanding accessibility” |
| Responsive layout | Met | Stacks under the `lg` breakpoint in `navigator.tsx` |
| About / data page with sources and method | Met | Data & method tab, `components/about-panel.tsx` |
| NASA data source from the Resources tab, credited | Met | Horizons is queried and credited. LOLA/PGDA is credited. Moon Trek and LROC QuickMap are linked, not used as live tiles |
| Artemis and CLPS sites with verified coordinates, plus custom lat/lon | Partly met | Published points are in `SITES` in `pipeline/build_dataset.py`. NASA has not published a pin for every 2024 Artemis III region polygon, so those polygons are not invented. The Shackleton rim crest is a derived LOLA sample and is labeled as such |
| Peaks of near-eternal light (over 80%) shown as a terrain effect, without faking the number | Partly met | The best 40 m sample found is **76.2%** any-disk sunlight over 2026–2027, against **57.4%** on a smooth sphere, at −89.77°, 204.00°E. Finer maps report small areas above 80%. The app does not invent an 80% figure |
| Honest labeling of approximations | Met | About page, map caption, site source strings |
| Optional NASA 3D lander models | Not met | Not built |

## Features built so far

**First build (13 Nov 2026)**

- Catalog of published sites plus a derived rim sample and a near-pole reference.
- Hourly Horizons-derived Sun and Earth azimuth and elevation, 1 Jan 2026 through 1 Jan 2028.
- Per-site LOLA horizon masks at 0, 2, and 10 m, every 1° of azimuth.
- Coarser custom-site grid at 2 m, every 3° of azimuth.
- 360° horizon, elevation chart, power and communications scores, sphere beside terrain.
- Compare up to three sites, best-date search, CSV, Public / Educator / Planner, About page.
- Single-file offline HTML.

**Map and motion update (14 Nov 2026)**

- Pan and zoom (drag, wheel, pinch, on-map +/− and Reset, arrow keys and +/− when the map is focused).
- Graticule and kilometre scale bar.
- Marker styling for the selected site and for comparison sites.
- Click-to-place south of 80°S.
- Coarse lighting wash for the current hour (`lib/lighting.ts`), with a checkbox to hide it.
- Play / Pause, three speeds, smooth Sun and Earth motion with a short trail, chart cursor, hourly lighting update, and a “through the playhead” score line.
- Space toggles play. Reduced motion steps and disables trails. The oblique sketch stays optional and 2D.

## Data sources and method

- **JPL Horizons, DE441.** Hourly sub-solar latitude and longitude, sub-Earth latitude and longitude, Earth–Moon range, and solar angular diameter. Topocentric azimuth and elevation are computed in `pipeline/build_dataset.py` and again in `lib/astro.ts`. Earth includes lunar parallax. The Sun’s parallax is ignored (it is far below the terrain uncertainty). Observer tables were checked with `validate_against_observer`.
- **LOLA DEMs, PGDA product 90.** `LDEM_80S_40MPP_ADJ.TIF` and `LDEM_60S_240MPP_ADJ.TIF`. South-polar stereographic, MOON_ME, radius 1737.4 km, the same frame Horizons calls MEAN_ME. https://pgda.gsfc.nasa.gov/products/90
- **PGDA product 69** (Mazarico et al.), the 18.6-year average illumination and Earth-visibility maps: https://pgda.gsfc.nasa.gov/products/69 . Those averages are **not** copied into the app. The app recomputes 2026–2027 from the DEMs and Horizons, so the percentages will not match product 69.
- **Horizon grid.** Catalog sites: ray march at the published coordinate, azimuth step 1°, steps 40 m then 160 m then 400 m, out to 250 km, observer heights 0, 2, and 10 m. Custom points and the map wash: precomputed cells about every 1° of latitude from 80°S to the pole and every 2° of longitude (tighter rings near the pole), azimuth step 3°, observer 2 m. A cell is sunlit when any part of the solar disk is above that horizon.
- **Hillshade.** Downsampled from the 40 m mosaic to `public/data/map.png`.

Site coordinates, each cited in the catalog:

- Malapert Massif, −86°, 0°E. LROC featured image 1294.
- Connecting Ridge, −89.53432°, 209.94767°E. LPSC 2024 abstract 1695.
- Peak Near Shackleton, −89.01701°, 126.27302°E. LPSC 2024 abstract 1695.
- de Gerlache–Shackleton ridge, −89.495°, 222.5°E. LPSC 2022 abstract 1079.
- IM-1 Odysseus, −80.13°, 1.44°E. NASA LRO report. LOLA height in this build is 2,592 m; NASA reported 2,579 m.
- IM-2 Athena, −84.7906°, 29.1957°E. LROC NAC.
- LCROSS Centaur in Cabeus, −84.6796°, 311.2907°E. Marshall et al. 2012.
- Geographic south pole reference, −89.99°, 0°E. A reference point, not a landing site.
- Shackleton rim crest, −89.77°, 204.00°E. Derived by this pipeline’s grid search. Not a NASA pin. Full-series any-disk sunlight **76.2%**, smooth sphere **57.4%**.

## Verified results

- Connecting Ridge, **29 June 2027 11:00 UTC through 13 July 2027**: **97.6%** of hourly samples have any sunlight with terrain, **0%** on a smooth sphere. That window is the opening demo (`meta.demo` in the catalog).
- Horizons check, re-run 14 Nov 2026: **112 samples**, maximum absolute error **0.0007° elevation** and **0.005° azimuth**.
- Cabeus over calendar 2027: **0%** sunlit with terrain. Smooth-sphere any-disk sunlight about **51.4%**. Smooth-sphere Sun-center fraction about **49.8%**. The “about half” smooth-sphere result is computed, not typed in as 49%.

## Known limits

- The 40 m DEM smooths knife-edge ridges. Lighting in this catalog tops out at **76%** on the derived crest. Studies at a few metres report small areas above 80%. Do not paste 80% in to match those papers.
- The map lighting overlay is the coarse ~1° by 2° grid, not a per-pixel shadow cast. It looks blocky when zoomed in. The caption says so.
- The sky view is 2D. The oblique sketch is a perspective drawing of azimuth and elevation, not a terrain mesh.
- No NASA 3D lander models.
- IM-1 and IM-2 both ended on their sides. Scores are for an upright observer at the coordinate.
- Custom points snap to the nearest grid cell. The distance is shown.
- The series is two years, not the 18.6-year nodal cycle used for PGDA product 69.
- Earth “in view” is geometric visibility of Earth’s center (or, in Planner, any limb). It is not a Deep Space Network schedule.
- Hourly samples. A window edge can be off by up to an hour. Playback interpolates between those hours for the drawings only.
- Rays can miss a narrow distant ridge (step grows to 400 m), which slightly overestimates sunlight.
- The challenge page was down (HTTP 500) when the brief was first implemented.

## Outstanding accessibility work

Do not claim “accessible by design” until these are done:

- Screen-reader testing of the whole flow (map, scrubber, play, compare, dates, about), on at least one desktop screen reader.
- A text or table alternative for the horizon canvas and the elevation chart. The scores are text, but the drawings are not.
- A WCAG contrast audit of the paper palette, muted text, and the amber and blue overlays.
- A check at 200% browser zoom, desktop and a narrow viewport, including the map controls and the date table.

What is already in the code, and should stay: keyboard scrubbing, map keyboard pan and zoom, visible focus, Space toggles play outside fields and buttons, aria-live for play/pause and for sunlit versus shadowed only when that state changes, no autoplay, reduced motion steps without trails, and Sun versus Earth distinguished by shape as well as colour.

## Suggested next steps

1. Open the live challenge page and diff it against the checklist above. Add anything the Details tab requires that this table does not.
2. Decide, with the current Space Apps rule in hand, how to describe a prototype dated 13–14 Nov 2026.
3. Do the four accessibility items before any accessibility claim.
4. If the team wants a true above-80% crest, ray-march a finer LOLA tile (PGDA 5 m site DEMs, product 78 / the 5 m landing-site set) at one published ridge coordinate, and label the resolution. Do not reuse the 76% figure as if it were that product.
5. Keep sphere and terrain side by side. Keep Horizons as the ephemeris. Rerun `validate_against_observer` if geometry changes.
6. A 3D lander from https://science.nasa.gov/3d-resources/ is optional. Skip it if it needs a network fetch the offline file cannot survive.
7. Do not switch the map to live Moon Trek or QuickMap tiles. Those viewers are references. The offline file must stay self-contained.

## Links

- Challenge brief: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- Horizons API: https://ssd.jpl.nasa.gov/api/horizons.api
- PGDA product 69 (polar illumination and Earth visibility): https://pgda.gsfc.nasa.gov/products/69
- PGDA product 90 (LOLA south-polar DEMs used here): https://pgda.gsfc.nasa.gov/products/90
- NASA Moon Trek: https://trek.nasa.gov/moon/
- LROC QuickMap: https://quickmap.lroc.asu.edu/
- NASA 3D resources: https://science.nasa.gov/3d-resources/
