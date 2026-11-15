# External data connections

Data connections are explicit, cancellable user reads. Opening the app or this panel does not fetch NOAA data automatically. The adapter supplies solar context independently of mission calculations; it does not change canonical assessment inputs/results. Direct-file offline use disables live reads. A failed CORS/network/provider request produces an error and preserves the existing numerical workflow; there is no hidden server proxy or credential requirement.

`DataConnections` accepts `{missionStartUtc, missionEndUtcExclusive, offline?, mode?: 'public'|'teach'|'plan'}`. It resets/cancels pending output when the selected period changes, discards late generations, provides a cancel control and never polls the provider. A local 30-second display clock can update the freshness label after an explicit read; it performs no network activity.

## Contracts and validity

`lib/providers/contract.ts` defines a generic `ProviderEnvelope<T>` with provider/parser identity, request identity and selected UTC interval, actual observation interval, issued/retrieved/expiry timestamps, kind, coverage, units, source URLs/hash, warnings and nullable data. Observation/forecast/climatology/display-composite/geometry/allocation are different kinds. Request keys include the exact selected interval and parser version. Freshness and selected-period overlap are evaluated separately. Unsupported/empty data remains unavailable rather than 0 or a nominal pass. All interval ends are exclusive.

The NOAA adapter reads only the official primary GOES six-hour X-ray JSON endpoint. It selects the 0.1–0.8nm channel, positive finite W/m² values and strict valid UTC timestamps no later than retrieval. Invalid/negative/zero/future rows are discarded with a count; conflicting duplicate samples fail. Latest class uses the standard A/B/C/M/X flux thresholds. It records actual observations without interpreting a class as lunar radio attenuation. Source bytes are SHA-256 hashed when WebCrypto is available; unavailable hashing remains explicit null. Payloads are limited to1 MB, arrays to 5000 rows, fetch/body reads to 12 seconds by default (configurable validated test ceiling 30 seconds). Both caller abort and timeout are enforced through fetch and streaming body reads. There are no stored credentials, fallback values or silent stale caches.

The 10-minute stale threshold is an explicit display policy, not NOAA accuracy or a physical hazard threshold. Latest observations remain dated even when stale. Discrete samples are always partial context: the adapter does not extrapolate beyond the latest sample, does not call the six-hour sample span continuous evidence, and does not present it as selected-future-date coverage. A single sample consequently has no nonzero interval coverage, while still showing its actual observed instant/value.

## Communications boundaries

Four separate cards retain four evidence questions: Moon-side terrain LOS uses the existing antenna-height assessment; Earth-station geometry uses the existing dated DSN view; weather and X-rays are contextual observations; scheduled support requires mission allocation and compatible hardware evidence that is not connected here. Geometry does not imply booking, weather does not supply a band-specific dB loss, and a flare class cannot establish delivered capacity or a failed contact. These cards report evidence boundaries, not a second assessment engine.

The source registry distinguishes installed adapters, prepared evidence and reference links. Existing local DSS coordinates, frame conventions and DSN geometry remain authority; no rounded upstream station coordinate or independent Moon geometry replaces them.

## Reviewed upstream additions

Read-only remote HEAD verification on 14 November 2026 confirmed `upstream/main` at `d7273fbd2835bcac9e1c51c9253ab5d2bce1aa3f`. Useful source families include `sun/data/flares.ts`, `sun/data/sunSurface.ts`, `sun/data/sunMap.ts`, Sun API/image adapters and Earth forecast/history/climatology providers. The original Sun parser lacks an observation-age cutoff and strict flare timestamps; the local adapter therefore has its own bounded/validated contract. This module does not copy upstream renderer packages or routes.

SDO synoptic maps are rotation composites, not a simultaneous full-Sun measurement. Future integration must retain acquisition/rotation/channel metadata, inspect FITS WCS/scaling and keep missingness separate from filled display pixels. Upstream `fillGaps` copies nearby samples for display, and its FITS parser does not apply BSCALE/BZERO or interpret coordinate metadata. Do not infer calibrated scientific values or trustworthy time-dependent surface geometry from that display path. Upstream station weather/climatology is also not a future DSN support schedule. Optional credentials must remain server-owned if a future authenticated provider is added.

Primary references: [NOAA GOES X-ray flux](https://www.swpc.noaa.gov/products/goes-x-ray-flux) documents the channels and 1-minute averages, ionospheric HF effects and associated radio bursts; it does not supply a DSN link-loss formula. [NASA SDO synoptic maps](https://sdo.gsfc.nasa.gov/data/synoptic/) establishes the source product role. [NASA DSN](https://www.nasa.gov/communicating-with-missions/dsn/) and the existing JPL station-coordinate provenance support station identity, independently of allocation.

Validation: seven focused synthetic provider tests cover class thresholds/timestamps, stale/future/missing/conflicting rows, half-open overlap/keys, strict UTC, actual response-byte limits and hashing, HTTP/JSON errors, abort/timeout through stalled body reads, registry and communications separation. Synthetic payloads test parser behavior and do not claim a successful live NOAA read. Actual browser/CORS/provider availability and UI accessibility remain integration checks. No server, build, browser, dependency installation or app wiring was performed by this workstream.

Fresh local validation: all seven focused tests pass; full project `tsc --noEmit --incremental false` and targeted ESLint pass without warnings. These checks validate source and synthetic responses, not live provider availability or integrated browser rendering.

Source hashing uses the exact bounded response-byte chunks, including any UTF-8 byte-order mark; malformed UTF-8 is rejected rather than replaced before parsing. A dedicated fixture checks that byte identity.
