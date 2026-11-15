# Station weather card

Worker delivery on `codex/station-weather`, 14 November 2026. Root owns integration into the primary Earth DSN card, browser verification and the generated offline HTML. This lane changes only the new component, request helper, focused tests and this handoff.

```tsx
import { StationWeather } from "./station-weather";

<StationWeather
  station={selectedStation}
  epochMs={earthMoonContext?.epochMs}
  offline={offline}
/>
```

`station` is the selected `DsnStation`; `epochMs` is the actual selected mission/playhead UTC Unix millisecond instant, or `undefined`. Do not substitute `Date.now()` for a missing mission instant. The optional `offline` flag disables fetching immediately. The component additionally guards `file:` and `navigator.onLine === false`, including inside the click handler before any HTTP call.

## Behavior and data authority

- Only an explicit fetch/refresh click calls the unchanged `lib/dsn.ts::fetchDsnWeather`. It retains its seven-day request, UTC/unit checks, 200,000-character response bound, maximum 192 contiguous hourly samples and `parseDsnWeather` validation. No new provider, weather science, geometry or assessment algorithm was added.
- `dsnWeatherAt` selects both mission-time and current-hour rows. Its intervals include the sample timestamp and exclude the next hour. Mission values appear only within the returned UTC coverage. Missing mission time, out-of-range mission time and null measurements remain unavailable. No nearest-hour extrapolation or replacement with today’s weather occurs.
- The selected instant and the actual hourly sample time are shown separately. Values remain hourly model samples, not exact-instant measurements. Temperature is at 2 m, wind speed at 10 m; precipitation is the preceding hour total ending at the sample timestamp. All values retain °C, km/h, mm and % labels.
- A separate current dated forecast and expandable 24-hour table use the device clock, independent of mission time. The table contains at most 24 returned rows beginning with the current UTC hour. Partial and expired coverage explicitly report missing hours. It is a real returned forecast when fetched, never a fabricated long-range mission prediction.
- Fetched timestamp, actual returned coverage with exclusive end, fetch age and the clock check timestamp are visible. Age and expiry update when React renders the card; there is no refresh timer, network polling or automatic request on mount, station change, date change or reconnect. Fetch age is not model issue time or a guarantee of accuracy. An expired retained forecast is explicitly an older model forecast, not historical observations.
- A keyed station session includes station ID, representative antenna and all coordinates/height. Changing pins replaces the session during reconciliation, preventing a frame of another pin’s forecast. Unmount aborts the old caller-owned `AbortController`; cancellation and generation checks ignore late success and failure, even if a transport ignores abort. An unexpected response station ID is rejected.
- Cancel aborts immediately and reports cancellation; an earlier successful forecast is retained during refresh, cancellation and failure with its original dates. Error messages do not echo provider payloads or URLs. Only one forecast is retained in one mounted station session; there is no cache, persistence or collection of source URLs. Returning to a pin requires a new explicit fetch.
- Offline/file mode disables the fetch control and never calls HTTP. Existing in-memory forecast values may still be read while offline; changing pins drops them. Connectivity listeners update the disabled state and abort an in-flight request when offline. Before those effects run, the request guard still prevents HTTP. Passing `offline` explicitly gives the integrator an immediately disabled first-render control for offline delivery.

## Explanation and presentation

The compact card inherits the warm paper theme, uses the existing shadcn Button, 14 px body/table/control text, 13 px minimum labels, responsive metric wrapping and a bounded keyboard-focusable table scroller. No CSS imports, shared styles, package edits, animations or network fonts are required. Native details/summary controls keep both the forecast table and radio engineering explanation collapsed initially. Fetch status uses a status region; rapidly scrubbed mission weather is not a live announcement.

The explanation cites the same [JPL 810-005/105 Rev. E](https://deepspace.jpl.nasa.gov/dsndocs/810-005/105/105E.pdf) used by the existing Earth/Moon view. Its sections 2.1 and 2.3 support the qualitative atmospheric-water, frequency-band and antenna-wind context. No attenuation, margin, antenna limit, station-to-Moon visibility, service availability or booking is computed from these weather values. Cloud percentage is never converted to radio margin. Forecast sampling/units and attribution link to [Open-Meteo documentation](https://open-meteo.com/en/docs).

## Verification and integration gates

Worker checks:

- `npx tsx --test tests/station-weather.test.ts tests/dsn.test.ts`: 20 passed, zero failed or skipped. Fourteen new tests cover SSR future/current/out-of-coverage/null/expired/partial reports, source/units, request inactivity, mocked existing fetch/parser, cancellation/abort, late generation races, station separation, offline guards and provider failure/bounds.
- `npm run typecheck -- --incremental false`: passed.
- `npm run lint`: passed.
- `npm test`: 480 passed, zero failed or skipped.
- Explicit owned-file staged diff and whitespace checks: passed before commit.

These are synthetic fixtures and mocked HTTP responses. No actual weather request, browser, server, Simulator, Metro, build or offline artifact was run by this worker. No ephemeris or geometry changed, so no new Horizons check is claimed. `slop-scan` is not installed/configured in this checkout.

Root must wire this into the primary card and remove/replace any duplicate weather placeholder there. Verify actual provider fetch and returned 24-hour values, real mission-time coverage/noncoverage, rapid pin changes and cancellation, offline file zero HTTP, keyboard/focus behavior, narrow layout, 200% zoom, contrast and screen-reader output. Worker SSR success is not browser visual proof or user acceptance.
