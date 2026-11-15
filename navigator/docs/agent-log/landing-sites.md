# Lunar landing catalog handoff

Date: 2026-11-14. Workspace: `landing-sites`, branch `codex/landing-sites`.
Baseline: `1c2ae8deb802d6860b8d0db1a5fd4cb73f948d8a`.
Ownership: only `lib/landing-sites.ts`, `tests/landing-sites.test.ts`, and this log.

## Result and integration contract

`LANDING_SITES` exports 40 sourced mission records: 24 `landed`, four `partial`,
and 12 `attempt`. All six Apollo landing missions are included. Programs also
cover all seven Surveyors, the seven successful Soviet Luna landings plus Luna
23's damaged touchdown and six failed Luna attempts, Chang’e 3/4/5/6,
Chandrayaan-2/3, SLIM, SpaceIL Beresheet, HAKUTO-R 1/2, and the three verified
CLPS touchdowns (Odysseus, Athena, Blue Ghost 1).

This is a catalog of landing missions with sourced positions, approximate
regions or a clearly labeled historical target. It is **not** a complete list of
all spacecraft impacts, every launched landing attempt, or hardware on the Moon.
No terrain horizons, illumination values or elevations have been invented.
`demHeightM` is optional in the requested API but is absent from every record.
Published LROC elevations were deliberately not repurposed as this application's
sampled DEM height.

- Coordinates are degrees north/east, longitude in `[-180, 180]`. Subtracting
  360 from a published 0–360 east longitude changes notation, not reference frame.
- `date` describes the surface event in UTC. Surveyor 4's date is the loss of
  contact/attempt date, because touchdown was never confirmed.
- `landed` means a nominal landing; `partial` denotes a damaged or off-nominal
  touchdown with surface operation (Luna 23, SLIM, Odysseus, Athena).
- `partial` is an editorial touchdown classification, **not an agency's mission
  success rating**. JAXA's SLIM pinpoint demonstration succeeded; its final
  attitude was off-nominal. NASA also describes Odysseus as a successful soft
  landing. Both qualifications are retained in provenance/copy.
- `attempt` means failed or unconfirmed landing. A precise crash location does
  not turn a failed mission into a successful landing.
- Keep `approximate`, `coordinateKind`, `summary`, and `sourceNotes` visible to
  consumers. An observed coordinate (`approximate: false`) still has measurement
  uncertainty; decimal places are not proof of absolute accuracy.
- `coordinateKind: "planned-target"` is used only for Surveyor 4. Its numeric
  marker is **not an actual landed spacecraft location**. Other unlocated early
  missions use `approximate-region`; Luna 25 uses an observed crater with
  `approximate: true` because NASA calls the attribution likely.
- One landing record per mission: Luna 17/21 use their landers, not Lunokhod final
  positions; Chang’e entries use landers, not Yutu positions; Apollo entries use
  lunar modules, not ALSEP, reflectors or parked rovers. Hops and carried probes
  are not separately counted.
- `odysseus` and `athena` intentionally retain existing IDs for parent
  de-duplication. No other existing planner IDs are reused.
- Parent owns adaptation into catalog/scenario and the whole-Moon map. These
  records do not supply terrain masks, and none of those integration files was
  changed here. In particular, a historical pin outside the existing terrain
  grid must not acquire a fabricated terrain horizon from a nearby polar site.

## Primary sources checked

1. [NASA NSSDCA spacecraft-on-Moon table](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html):
   mission dates, coarse historical regions, landed versus impact distinctions,
   and caveats for Luna 5/9/15 and Surveyor 4. The latest surface event listed in
   the retrieved table was HAKUTO-R Mission 2, 5 June 2025.
2. [LROC Anthropogenic Features, 28 July 2016](https://lroc.im-ldi.com/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf):
   observed Surveyor, Luna and Chang’e 3 lander positions; Apollo cross-check.
   The table uses ME coordinates. Its uncertainty column is not a warrant for
   submeter absolute accuracy: the methodology also mentions approximately
   ±15 m orbital position uncertainty. No single accuracy number was invented.
3. [NASA Apollo coordinates](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html)
   and [Apollo landing dates](https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html):
   all six LM positions in DE421 ME and landing dates. Apollo 13 did not land;
   its S-IVB impact is excluded. Apollo 16 uses 20 April 1972 from the Apollo
   summary, correcting the artifact table's 21 April date for this catalog.
4. [NASA Surveyor history](https://nssdc.gsfc.nasa.gov/planetary/lunar/surveyor.html),
   [Surveyor 2 mission](https://science.nasa.gov/mission/surveyor-2/),
   [contemporary JPL Surveyor 2 report](https://science.nasa.gov/solar-system/moon/surveyor-2-impacts-moon/),
   [Surveyor 4 mission](https://science.nasa.gov/mission/surveyor-4/): dates and
   failure/target evidence. Surveyor 2 is 23 September UTC using NASA's key date
   and JPL's predicted 20:18 PDT on 22 September; other NASA narratives/table say
   22 September. This conflict is recorded rather than silently erased.
5. [Luna 23 imagery](https://lroc.im-ldi.com/images/461): vehicle on its side,
   maintained contact, unsuccessful sample return.
6. [Chang’e 4 refinement](https://lroc.im-ldi.com/images/1168): lander
   `-45.4562, 177.5885`, 13 m uncertainty at 95% confidence. This 2020 refinement
   supersedes the `-45.4561` latitude retained in the NASA table and the
   [earlier stereo result](https://lroc.im-ldi.com/images/1100).
7. [Chang’e 5](https://lroc.im-ldi.com/images/1172) and
   [Chang’e 6](https://lroc.im-ldi.com/images/1374): observed lander coordinates
   and stated accuracy. Chang’e 6 landed 1 June UTC, 2 June in China.
8. [Beresheet](https://lroc.im-ldi.com/images/1101),
   [Chandrayaan-2 Vikram](https://lroc.im-ldi.com/images/1131),
   [HAKUTO-R 1](https://lroc.im-ldi.com/images/1302),
   [RESILIENCE/HAKUTO-R 2](https://lroc.im-ldi.com/images/1456): observed impact
   marks/debris, not successful landings.
9. [NASA Luna 25 crater](https://www.nasa.gov/humans-in-space/nasas-lro-observes-crater-likely-from-luna-25-impact/):
   observed crater **likely** from Luna 25, far from its planned polar target.
10. [Chandrayaan-3](https://lroc.im-ldi.com/images/1314),
    [SLIM location](https://lroc.im-ldi.com/images/1358),
    [JAXA touchdown report](https://global.jaxa.jp/press/2024/01/file/jaxa_doc01_20240125_e.pdf),
    [JAXA successful mission account](https://global.jaxa.jp/about/president/presslec/202409.html).
    SLIM's date is 19 January UTC, 20 January in Japan.
11. [Odysseus location](https://lroc.im-ldi.com/images/1360),
    [NASA account of its resting attitude](https://science.nasa.gov/image-article/apod-2024-february-24-odysseus-to-the-moon/),
    [Blue Ghost 1](https://lroc.im-ldi.com/images/1407),
    [Athena](https://lroc.im-ldi.com/images/1408): post-landing positions and
    touchdown evidence, not preflight target coordinates.

## Cutoff review, exclusions and unavailable coordinates

Review cutoff is 14 November 2026; no subsequent verified touchdown was found in
the primary sources searched. This is a bounded source review, not a guarantee
that every agency has published every event or position.

- [NASA's current events](https://www.nasa.gov/events/) lists Griffin-1 for late
  2026 and IM-3, Blue Ghost 2 and Blue Moon Mark 1 for 2027. Schedules alone are
  not landing evidence. [NASA's 26 October 2026 IM-3 account](https://science.nasa.gov/learning-resources/science-activation/nasa-sees-interns-tackle-real-world-challenges-in-lunar-exploration/)
  also calls its touchdown scheduled for 2027. No actual touchdown coordinates
  were verified for these missions or Draper's future delivery; none is inserted
  with a guessed event date or position.
- CNSA's [13 July 2026 Chang’e 7 update](https://www.cnsa.gov.cn/n6758823/n6758838/c10762022/content.html)
  reports launch-site preparation. Its [October 2026 overview](https://www.cnsa.gov.cn/n6758823/n6758844/n10777482/c10778367/content.html)
  describes the mission as planned. No confirmed Chang’e 7 touchdown/location
  was verified; no polar planning-region center is presented as its actual site.
- Luna 9 and Luna 13 have no confirmed spacecraft coordinates in the reviewed
  sources. Their historical numeric regions are explicitly approximate. Luna 9
  may be at least 10 km from its reported point; the direction is unknown.
- Luna 5 and Luna 15 have conflicting reported regions; Luna 7/8/18 and Surveyor
  2 are historical estimates. Surveyor 4's actual location is unknown, so its
  published intended target is explicitly labeled instead.
- Peregrine never reached the lunar surface. Luna 4 and Luna 6 missed the Moon;
  launch failures and OMOTENASHI's unverified surface fate have no confirmed
  surface pin here. Do not invent coordinates to make a mission count complete.
- Intentional impactors (Luna 2, Ranger, LCROSS, rocket stages), postmission
  orbital decay and discarded Apollo stages are outside the landing-mission
  catalog. The parent's existing LCROSS entry is not duplicated.

## Verification and delivery

Passed on Node v20.20.2, with `UV_THREADPOOL_SIZE=1`,
`NODE_OPTIONS=--v8-pool-size=1`, and `GOMAXPROCS=1`:

- `npm run typecheck -- --incremental false` (no build-info file mutation).
- `node --import tsx --test --test-concurrency=1 tests/*.test.ts`: all seven
  test files passed. This Node runner printed file-level totals, so each file
  was also executed directly, serially, with `node --import tsx`: **39
  individual tests passed**, including all nine new landing-catalog tests.
- `node node_modules/eslint/bin/eslint.js lib/landing-sites.ts tests/landing-sites.test.ts`.
  Markdown is outside the repository's ESLint configuration.

The new tests cover unique IDs, coordinate/date bounds, all six Apollo missions,
Apollo 13 exclusion, program coverage, primary provenance, approximate/target
caveats, outcome distinctions, lander versus rover/target positions, UTC dates,
and absence of invented terrain values.

Delivery is an isolated conventional commit parented directly to the baseline,
in `/tmp/solarreach-landing-sites.bundle`, on bundle ref `codex/landing-sites`.
Shared worktree Git metadata remains untouched. Parent can fetch the bundle ref
and cherry-pick its commit. The commit contains only the three owned files.
No push or integration into the root catalog is performed here.

No package, science-geometry, root catalog, scenario, UI or build files are owned
or edited. No server, browser, Simulator, Metro or native build is used. No
Horizons rerun is required: ephemeris and geometry were not changed.

Instruction parity check passed. Shared-memory recall tool required unavailable
approval, so recall used the canonical vault files. The existing `SolarReach.md`
hub describes a different terrestrial solar-sales project; it was not treated
as lunar-navigator history. This owned log preserves this task's decisions and
handoff; writing the cross-project vault is outside this sandbox's writable
roots and the explicit three-file ownership.
