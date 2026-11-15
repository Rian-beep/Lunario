# Lunario — Lunar Landing Site Navigator

Explore lunar south-pole landing sites on a map, inspect measured terrain in 3D, and compare how landing dates affect sunlight, direct-to-Earth visibility, electrical resources and a generic lunar flight preview.

Built for the [2026 NASA Space Apps Lunar Landing Site Navigator challenge](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/). This is an educational and preliminary engineering workbench, not a NASA operational or flight-qualified product. The original team handoff and development chronology are preserved in Git history and `HANDOFF.md`.

## Release and team handoff

See [the current handoff and full to-do list](docs/IN-FLIGHT.md) for completed software, qualification gaps and independent teammate tasks. Hosting is owned by the teammate.

## Run

Use Node 20.19+ (Node 22 recommended):

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:4317/](http://127.0.0.1:4317/). Bundled ephemeris and terrain data are already included; no Python pipeline or multi-gigabyte DEM download is required to run the app.

## Use

- Explore 40 sourced lunar landing-mission records, including all six Apollo landings, together with the polar candidates and reference sites. Choose **Whole Moon** for global context, or **South pole** for the polar map. Mission outcomes and approximate/planned locations are labelled.
- Choose a catalog site or enter lunar coordinates. Switch between the 2D map, 3D surface and split view without losing the scenario.
- Select a UTC landing epoch and stay. Play or scrub the environmental timeline; sunlight and Earth-view strips show sampled operational windows.
- Each mode opens a dismissible introduction; reopen it from **Mode guide**.
- **Public** explains the geometry and results. **Educator** adds prediction/observation experiments. **Planner** exposes array, load, storage, antenna and optional free-space radio assumptions.
- Hover, focus or tap an **i** beside a variable or graph axis for its meaning, units, intuition and applicable limits. Planner explanations distinguish physical requirements from vehicle-specific pass criteria.
- Open horizon analysis for explicitly labelled azimuth/elevation and UTC-time plots, legends, sample readouts and a numerical table. Flight altitude/speed and power/storage plots state their units and time origins.
- Save multiple site/date/hardware scenarios to the comparison tray. Select/reorder/sort columns, choose a reference, set a sunlight screening threshold and add numeric user metrics with units. Export selected comparison data or a scenario/provenance JSON record.
- In 3D, use the header’s **Moon / Earth / Lander** focus buttons and open **Camera & lighting** for NASA’s **Moon** globe, local **Orbit** and **Surface** cameras, flight framing, a close-up lander camera and vehicle follow. The nominal7m NASA lander stays at fixed1× scale as the camera zooms. **Inspection light** reveals terrain independently of the epoch; **Epoch light** follows the supplied Sun direction. The NASA globe has a nominal visualization scale; local LOLA relief is measured.
- Choose **Earth** in the header for physically sized bodies and JPL Earth–Moon range, then select **Goldstone**, **Madrid** or **Canberra** directly. Ground-complex details include coordinates, station context and explicitly dated model weather. Current forecasts never stand in for a future mission date; station visibility, allocations and weather fade remain separate evidence requirements.
- Open **Learn** in the header in any audience mode for defined symbols, SI units, frames and model assumptions. Public keeps equations optional; Educator and Planner expose technical detail.
- Open **Engineering screens & evidence closure** in Planner for scoped footprint, touchdown, propulsion/transfer, support-capacity, thermal, plume and traverse calculations. Choose calculated/input variables in **Compare engineering variables**; exports retain scenario identity and provenance.
- Select **Lander** to configure an editable assisted 300 m terminal approach. Revisit without losing edits, or explicitly reset the preset. Manual ascent/descent retain initial speed, heading/pitch, mass, engine and burn controls. **Follow** preserves your camera offset through flight and the bounded terrain-contact replay, including bounce and illustrative breakup. Green/red/amber path outcomes refer to entered contact assumptions, not landing approval. Flight seconds are separate from environmental hours.

**Educator → Teaching studio** provides a full-workspace prediction/result experiment with the current scenario, native equations, gradient units, controlled finite responses and compatible local notebooks. **Planner → Engineering evidence** accepts separate dated station geometry, lunar masks, radio/weather/allocation/rate and critical-window evidence, plus declared finite bounds. Export these supplemental envelopes separately; they do not silently alter the canonical mission verdict. Public stays focused on plain-language causes and next actions in dismissible header guidance.

Scenarios and comparison views are stored in the browser on this device. Share links encode scenario inputs. There is no hosted account database.

## Offline file

```sh
npm run standalone
```

Open `public/solarreach-navigator.html` directly. It embeds the catalog, numerical terrain, NASA’s original topographic globe and 8K image, NASA’s original Apollo Lunar Module asset, its local decoder, evidence manifest and renderer; no server is needed. The timeline starts compact; expand it for dates and visibility strips, or dismiss it and restore it with **Show timeline**. Its view preference is saved on this device.

Supported optional online imagery remains separate from the bundled fallback. See verification evidence before relying on any claim about a particular generated bundle.

## Replan a delayed mission

Open **Replan mission** in the header in any audience mode. The reference is captured independently of the candidate. Change candidate arrival/site, or use **+1 day / +7 days**, without changing the active mission or shortening the stay. Compare actual stored energy/reserve, power/load and antenna contact at the same elapsed mission hour; choose absolute UTC only where the stays overlap. Expand saved-case choices, inspect the first known violation and open/save the exact candidate. Unsupported evidence stays unknown and changed requirements cannot improve a shared ranking.

In **Planner**, inspect **Mission assessment** before the raw resource inputs. Open **Find whole-mission arrival windows** to test a calendar of complete stays with fixed hardware. The ±1/±7-day controls preserve stay length. Select a candidate to inspect requirement margins, open its exact state, or compare it against the controlled baseline.

**Sensitivity & tested alternatives** evaluates your explicit capacity, load, date and height values. Results describe tested cases, never probabilities or an untested minimum. **Export, import & print evidence** provides a decision JSON package, CSV and printable record; import recomputes against installed evidence. External landing assessments retain their author/source/scope and remain distinct from calculated resource results.

Prepared-only records without horizons remain unassessed. Explicit coarse global context can calculate an approximately4.3km numerical horizon; it remains conditional evidence. Custom polar points can compare their borrowed prepared horizon with a calculation at their exact coordinates. Use a prepared polar baseline for the resource-planning demonstration. See [model conventions](docs/MODELS.md), [demonstration](docs/DEMO.md) and [implementation status](docs/qa/planning/IMPLEMENTATION-STATUS.md).

## NASA and partner resources

| Resource | Role |
|---|---|
| [NASA original topographic Moon](https://svs.gsfc.nasa.gov/14959/) | Original million-triangle globe and 8K visualization image; nominal globe scale |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | DE441 Sun/Earth ephemerides and fresh observer checks |
| [NASA GSFC LOLA / PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) | Numerical terrain and original horizon masks |
| [NASA Moon Trek](https://trek.nasa.gov/moon/) | Supported WMTS services for LROC lunar imagery |
| [LROC QuickMap](https://quickmap.lroc.asu.edu/) | Challenge-linked independent exploration; underlying LROC imagery is served through Moon Trek |
| [Canadian Space Agency](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Attributed lunar exploration/teaching context |

QuickMap and CSA are not represented as numerical APIs. Imagery acquisition lighting is historical, not simulated illumination for the selected date. Source and coverage notes remain visible in the app.

## Validation and numerical limits

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run verify:horizons
```

The catalog spans 2026–2027 in hourly samples. Darkness and blackout durations touching the selected-date boundary are shown as lower bounds; a46day stay can show≥1,104h without implying the run ends then. Catalog horizons use the original 40/240 m LOLA products and 0/2/10 m observer heights. Custom points use a nearest-cell 2 m horizon, with distance shown. Meshes use separately prepared numerical terrain; input resolution and resampling differ from the source horizon model and map imagery.

Every relevant visibility/resource result retains a smooth-sphere comparison. No terrain image, coarse slope or shadow wash certifies a landing ellipse. Geometry, storage and radio screening are different from closed-loop trajectory design and operational station support. See [model contracts](docs/MODELS.md) and [validation evidence](docs/qa/) for exact assumptions and observed checks.

## Repository map

- `components/navigator.tsx` — shared scenario state and workbench shell
- `components/polar-map.tsx` — interactive polar map
- `components/workbench/` — 3D scene, audience tools, charts, variable help, comparison controls
- `lib/astro.ts`, `lib/catalog.ts` — original astronomy and catalog decoding
- `lib/mission.ts`, `lib/flight.ts`, `lib/terrain.ts` — numerical resource/trajectory/terrain models
- `public/data/` — bundled data and provenance
- `scripts/` — bounded terrain/imagery preparation, Horizons validation and offline build
- `tests/` — analytic and failure-case regressions
- `pipeline/` — original full Horizons/LOLA catalog generator
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/MODELS.md` — developer and scientific contracts
- `docs/superpowers/` — approved design and execution plan

## Status

Final integration and verification are recorded in [implementation status](docs/qa/planning/IMPLEMENTATION-STATUS.md). Automated results apply to the identified build and offline artifact. Actual screen-reader use and independent fine-terrain/frame qualification remain separate incomplete gates; this is not an operational NASA mission-approval tool.

## Lunario identity and reference style

The cream/peach interface uses the supplied reference’s orange title strips, ink outlines, offset shadows and mint selections. It preserves existing controls and original NASA image colours. The main workspace fills the viewport; narrower screens dock and scroll the inspector internally. Global local-terrain context and the globe share the original NASA 8K atlas. Six south-polar site centres additionally include real NAC imagery sampled at about 2.09 m/output pixel; arbitrary points can retain only coarse global coverage.

Educator → Teaching studio → Create a problem set and teaching materials captures the exact scenario and computed results. Select goals, edit prompts/hints and export separate printable student sheets and teacher answer keys, or teacher JSON with exact inputs. Student HTML contains no hidden answers. Internal storage and decision schemas remain compatible with earlier SolarReach work.

The public flight correction passes 790 source tests and 16 web/offline journey groups, including all 22 numeric variable controls and complete Follow playback. See [public flight verification](docs/qa/public-flight-usability/VERIFICATION.md). The earlier branding release retains its 50 resource/contact/playback checks and 12 flight/branding journeys with exact artifact attribution in [the brand ledger](docs/qa/lunario/VERIFICATION.md). The earlier 82 workflow journeys and 49/99/104-check visual matrices retain their original build identity in [the historical refinement ledger](docs/qa/refinement/FINAL-VERIFICATION.md), [the full remaining TODO list and team handoff](docs/IN-FLIGHT.md), and [refinement acceptance](docs/REFINEMENT-PLAN.md). Hosting remains with the teammate; qualified mission evidence and human acceptance remain incomplete.

Lunario’s original outlined SVG logo, favicon, Geist font and “Prepare for landing” polar-grid/typewriter/lift-away loader come from [Rian’s Lunario repository](https://github.com/Rian-beep/Lunario), pinned to `aeb673f`. Onboarding waits for the real loader completion; every document load/reload, reduced motion and error recovery are handled without introducing fake mission telemetry. See [branding provenance](public/branding/lunario/provenance.json) and [current verification](docs/qa/lunario/VERIFICATION.md).

In **Lander → Flight experiments**, choose a reference and explicitly **Load reference**, predict the result, then **Play experiment**. Try assisted descent, manual burn, ascent, weak thrust, sideways overshoot or contact/bounce. Change one input and compare actual contact speed, target error and fuel state. Open **i** or **Engineering intuition & variable significance** for meanings, units and assumptions. **Follow vehicle** stays local; playback waits for a framed view, and **Replay experiment** resets an already-running clock. Breakup is illustrative rigid-body contact with entered limits, not structural qualification.

Public flight controls are task-first: select **Lander** to see Play without scrolling past technical reports. Each flight variable has adjacent **i** help describing its effect, including settings that only change acceptance limits or motion after contact. A changed-setting card compares the previous calculation; a plain-language prediction lists every failed touchdown check and missing ground evidence. The scene follows automatically when playback starts.

The original loader holds for at least three seconds before its lift-away on first load and reload (including cache-bypassing reload). Changing audience, variables or camera within the loaded document does not replay it. The original reduced-motion still version keeps its shorter timing.

### Interface appearance and Public context

Use the header’s Dark/Light button to switch between the light mint/cream reference and near-black/orange. The preference persists in this browser and affects UI surfaces, not NASA imagery or mission calculations. Original Lunario dark/white wordmarks are used on their corresponding surfaces.

Public site selections expand a dismissible location story: historical mission context, source links and nearby published touchdown pins. In Earth focus, selecting a DSN complex opens its role and communication explanation. These are ground antennas, not satellites. Weather is requested explicitly and dated; a separate current forecast never fills an unsupported future mission instant.
