# Space Apps criteria review — Lunario

Review date: 15 November 2026 (Europe/London). Scope: the integrated product (static site shell + `navigator/` workbench delivered by Luke), scored against the **Lunar Landing Site Navigator** challenge objectives and the shared local/global judging rubric (1–5, equally weighted).

This is an internal team assessment for presentation planning, not an official judge score.

## Executive verdict

| Rubric | Score (1–5) | One-line read |
| --- | ---: | --- |
| Impact | **4** | Strong mission-planning + education reach; not yet proven at population scale. |
| Creativity | **5** | Multi-audience workbench + flight/replan loop goes well beyond a static horizon plot. |
| Validity | **4** | Scientifically grounded and heavily tested; still educational / not flight-qualified. |
| Relevance | **5** | Directly hits site×date comparison, Sun/Earth vs horizon, NASA data as the core engine. |
| Presentation | **3** | Product and About story are strong; live demo polish and judge narrative still decide this. |
| **Rubric average** | **4.2** | Competitive Advanced/Intermediate entry if the demo tells one clear story. |

---

## Challenge objectives checklist

| Objective | Status | Evidence in Lunario |
| --- | --- | --- |
| Interactive site selection & comparison | **Met** | ~40 sourced landing records (incl. all six Apollo landings), polar candidates, custom lunar coordinates, saved scenario comparison tray with export. |
| Date and time flexibility | **Met** | UTC landing epoch + stay; timeline scrub/play; ±1/±7 day replan; mission calendar / arrival-window search in Planner. |
| Sun and Earth position vs horizon | **Met** | Horizon analysis with azimuth/elevation vs UTC, numerical table, terrain vs smooth-sphere comparison. |
| Power and communication assessment | **Met** | Solar elevation / sunlight windows, storage and load screening, Earth visibility / DSN complexes (Goldstone, Madrid, Canberra), Planner hardware assumptions. |
| Multiple visualization approaches | **Met** | Whole-Moon and south-pole 2D maps, measured LOLA 3D surface, NASA topographic globe, charts, comparison workspaces. |
| Temporal dynamics | **Met** | Environmental timeline strips; epoch lighting; flight Follow playback; replan contingency timelines. |
| Accessibility across skill levels | **Met** | Public / Educator / Planner modes, Learn panel, variable **i** help, teaching studio exports. |
| NASA / challenge data integration | **Met (core)** | JPL Horizons (DE441), LOLA / PGDA horizons & terrain, NASA SVS Moon globe + imagery path via Moon Trek; QuickMap/CSA attributed as exploration context. |

Gaps called out honestly in product docs (do not over-claim in the demo):

- Not an operational NASA landing-approval tool; fine landing-ellipse / structural / DSN-allocation evidence remains open.
- Catalog span is bounded (documented 2026–2027 hourly samples); darkness/blackout at stay edges are lower bounds.
- Hosted performance and cold-user studies are still teammate-owned acceptance gates.
- Dashboard on GitHub Pages embeds the ~78 MB offline bundle; first load can be slow.

---

## Global judging criteria (detail)

### Impact — **4 / 5**

**Why not lower:** Addresses a real CLPS / south-pole planning pain (rapid site×date trade when schedules slip). Serves planners, educators, and the public in one product. Replan / contingency workflows match the challenge’s “hardware delays force replanning” narrative.

**Why not 5:** “Changes the world / extensive reach” needs evidence of use beyond the team (studies, classroom packs in the wild, planner adoption). Until those exist, outstanding impact is aspirational.

**Raise the score:** Run 3–5 cold Public/Educator sessions; ship one printable classroom pack from Teaching studio; name one concrete reference mission the demo optimizes for.

### Creativity — **5 / 5**

Novel combination relative to QuickMap / Moon Trek / raw Horizons: map-first workbench, audience modes, teaching exports, editable flight contact experiments, mission replan with held hardware, engineering-evidence envelopes that refuse to silently rewrite the verdict. Distinct visual identity (cream/peach/orange Lunario language) without abandoning NASA asset fidelity.

### Validity — **4 / 5**

**Strengths:** Airless horizon from LOLA products; Horizons ephemerides; smooth-sphere vs terrain honesty; large automated suite (source release ~790 tests) plus documented web/offline journey checks; explicit unknown/missing-evidence states.

**Limits to state aloud:** Educational / preliminary engineering workbench; illustrative contact/breakup ≠ structural qualification; station weather/model context ≠ reserved DSN pass; coarse global terrain ≠ fine hazard map.

**Why not 5:** Rubric’s “fully developed and ready for real-world implementation” implies operational readiness Lunario correctly refuses to claim.

### Relevance — **5 / 5**

Maps almost 1:1 onto the challenge statement. NASA data is not decoration: Horizons + LOLA drive assessments; NASA globe/lander assets and Moon Trek imagery path are integrated with provenance. South-pole geometry, power, and direct-to-Earth windows are the product spine.

### Presentation — **3 / 5** (today) → target **5** with demo craft

Judges score the **demo and full project**, not only the code.

**Already in place:** About page narrative, clear problem framing, mode guides, provenance/export language, Dashboard now mounts the full navigator in-site.

**Still needed for a 5:**

1. **90-second spine:** Problem (south-pole light/comms) → pick site+date → show Sun/Earth vs ridge → flip date by +7 days → show power/contact change → one educator/public beat.
2. **Preload the Dashboard** before judges arrive (78 MB offline file).
3. **One slide** mapping each rubric column to a live click.
4. **Honest limits slide** (builds Validity trust).
5. Practice with a non-author timing the story.

---

## Demo script (suggested)

1. Open **Dashboard** (already loaded). Stay in **Public**.
2. Select a south-pole candidate; show polar map + horizon Sun/Earth.
3. Scrub timeline: sunlight strip vs Earth-view strip; call out time-to-sunset / Earthset if shown.
4. **Replan mission**: +7 days, same stay/hardware — compare stored energy / contact.
5. Switch **Educator** → open Learn / one equation intuition; or **Planner** → Mission assessment.
6. Close on: “When launch slips, teams need this comparison in minutes, not a Horizons scavenger hunt.”

---

## Integration note (this delivery)

The website **Dashboard** tab embeds `navigator/public/solarreach-navigator.html` (verified offline release, SHA256 `30994eb901aec5d6e593d2b01364fd96f2bd6e07bfdfb41208a0b2d919a01fc9`) under the shared Lunario nav. About remains the story page. Prefer a Next.js host for `navigator/` when available; Pages keeps working via the offline bundle.
