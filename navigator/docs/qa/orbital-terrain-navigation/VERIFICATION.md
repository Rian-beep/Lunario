# Orbital context, lunar navigation and chart proportions

15 November 2026. Source integrates team/main 885c401, including the team's Public header, delayed-landing demo, dark default, loader, orange-accent logo and About-header changes. Hosting remains teammate-owned. Earlier release receipts are historical.

## Scope and causes

- Add six dated CelesTrak GP spacecraft identities, including Starcloud-1, with descriptions and mission sources. SGP4 marker placement, selected common-frame orbit, independent UTC playback, explicit cached provider refresh and offline JSON import. Markers are annotations, not spacecraft models or qualified lunar relay infrastructure.
- Restore visible pole/site labels in both overview modes, direct N/S/E/W controls and coordinate/north readout. Reserved navigation identifiers prevent a south-pole catalogue record sharing a React key with the orientation label; browser checks originally caught a stale label after rotating north.
- Refine measured close terrain cooperatively without remounting the scene or blanking its previous geometry. Covering data spacing and hysteresis govern tessellation. A precision-safe polar shader fixes near-pole texture quantization. Hide the kilometre-scale selection ring near the surface. No fabricated rocks or new global fine terrain.
- General workspace button sizing had overridden the information controls: explicit square bounds now retain circles. SVG dimensions and uniform meet scaling preserve text, strokes and circles; the plot viewbox follows actual available width.
- Resolve the newly merged “Earth in view” label to its existing complete variable explanation. Browser journeys follow the current Public inspector and Planner replanning contracts rather than requiring superseded header controls.

The merged Public inspector entry originally left the lander kilometres away. Flight entry now uses the canonical lander-focus action; Follow retains a local viewing offset only after a focus transition has settled. The browser journey caught this before release.

## Independent numerical checks

18 states (six spacecraft × −60/0/+60 minutes) generated independently with Python sgp4/Vallado WGS72 are committed with the fixture. Maximum position implementation disagreement: 0.000207424 km (~0.207 m), below the 1 m test tolerance. This is cross-implementation agreement, not actual spacecraft location accuracy. TEME→GMST Earth-fixed display is approximate; Earth/Moon display attitude remains illustrative. ±72 h is a display policy, not an accuracy guarantee or current-service claim.

Malformed/duplicate/wrong known identity, unsupported frame, invalid epoch/calendar, stale/future prediction, source outage, concurrent refresh, cached attempt, common-frame track and separate-clock cases are tested. The initially investigated NORAD 43413 resolves to debris and was excluded; TDRS-13 is 42915, Starcloud-1 66303. No contact readiness enters the canonical mission assessment from these markers.

## Evidence

Source suite: 822 passed, zero failures/skips. Production build, MathML check (314 expressions), typecheck and lint passed. Web/offline orbital-navigation journey passed with six identities, stale hiding, independent playback, pole/POI/longitude controls, preserved renderer identity and measured close refinement. Disconnected file made zero HTTP requests. See browser.json and source-tests.txt. Provider browser refresh uses an explicitly labelled fixture; source tests cover provider cache/failure semantics. No claim of a live provider availability test.

The chart browser verifier measures actual information-button bounds and SVG screen transformation at 1600, 1280 and 800 CSS pixels in web/file. All six rendered web/file width cases pass (chart-proportions.json). Flight replay passes all16 groups across web and file (flight.json), including all22 flight inputs and no uncaught browser errors or disconnected HTTP. Native zoom:8/8 pass, including all12 actual200% HUD/location states over HTTP and disconnected file, focused axes and inspector scrolling (native-200.json).

Slop scan completed: nine findings inspected (slop-review.txt). Directory fan-out is a metric; NASA decoding wraps errors with causes; strict scenario parsers intentionally return null; optional theme/session preference storage falls back without preventing operation; original vendor loader is preserved; unrelated existing framing-verifier wrappers remain outside this change. No numerical-model identity increment or Horizons rerun: lunar ephemeris, masks and evaluator geometry are unchanged. Projection tests compare display texture coordinates against the existing CPU projection.

## Limits and follow-up

Fine terrain is limited to bundled measured coverage and resolution (the covering nominal 5 m product is resampled near 8 m). Tessellation cannot recover sub-grid obstacles or fine terrain at an unsupported custom point. At metre-scale camera distances source imagery can remain visibly soft. Qualified landing footprints, real vehicle/control/structural data, service compatibility, antenna masks, bookings, RF weather loss and actual device/screen-reader/user acceptance remain in docs/IN-FLIGHT.md. Fresh GP data does not close those gaps.

## Final release identity

{
  "artifact": "public/solarreach-navigator.html",
  "bytes": 81236036,
  "sha256": "8de622395941c418dcdaf73ad95454c3909f6974ebaf4bec336ebdaec2a3be8d",
  "nextBuildId": "Wp9jW32A8PlWQhUC7HeZr",
  "runtimeSourceCommit": "26d88918a7c8f8f18e87d279d1c17ab463aff5a4",
  "teamBase": "885c4017cd5f2c7c707e774d1af34f7358885042",
  "sourceTests": 822,
  "nativeZoomTests": 8,
  "flightGroups": 16,
  "chartWidthsPerTransport": [
    1600,
    1280,
    800
  ]
}

All checks above use this artifact and its corresponding production build. Following the full suite, a removed unused test import retained all16 focused audience test passes; final lint has zero errors or warnings. Earlier failed browser attempts are described above and were fixed before this receipt.
