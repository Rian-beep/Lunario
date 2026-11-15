# Integrated evaluation: scientific checks

15 November 2026. The original scientific baseline remains archived. These receipts supplement it for the current stricter station parser and three additional reconstructed descent extracts. They do not qualify a mission.

- **288 resource comparisons pass**, including independent power, energy conservation, RF units, station coordinates and atmosphere reference cases. Original thresholds are unchanged.
- **75 archived station epochs / 225 components pass** against the retained independent CSPICE producer. The archived observer bytes, requests, acquisition metadata and hashes are retained beside this report. Maximum azimuth, elevation and range discrepancies are in `stations-archived.json`.
- **Fresh provider comparison remains incomplete:** this parent attempt obtained 50 epochs; Canberra returned HTTP 503. The previous worker attempt independently obtained Goldstone and Canberra but Madrid failed. These are distinct attempts; they are not combined into a fictitious simultaneous successful run. `stations-live.json` retains the actual outcome.
- **740 CLPS source states pass:** independent `spkezr` fixed-frame queries reproduce all committed Athena, Blue Ghost 1 and Odysseus positions and velocities from the hash-pinned NASA/PDS kernels. This uses a different API path from the extract producer's state transform, but shares CSPICE and source models. It checks source transfer, not independent tracking observations. Measured midpoint display discrepancies are retained, not asserted as continuous physical error bounds.
- Station acceptance-policy changes carry **station-comms-2**, independently of the unchanged canonical **planning-5** assessment. Invalid or future-issued evidence and unsupported EOP coverage cannot become a positive station-capacity claim.

Reproduce from `navigator/`:

```
npx tsx scripts/audit-resources-compare.ts
npx tsx tests/comms-evaluation/compare-sources.mts
npx tsx tests/comms-evaluation/compare-sources.mts --live
python scripts/evaluation-integration/verify-clps.py SOURCE_KERNEL_DIRECTORY OUTPUT_JSON
python3 scripts/compile-scientific-verification.py --check
```

The CLPS replay requires SpiceyPy 8.4.0/CSPICE N0067 and NumPy; sources are named and SHA-256 pinned in each trajectory. The lightweight publication check validates reviewed identities and receipt outcomes without fetching providers. Source changes invalidate it. Updating a hash alone cannot bypass failed outcome gates.

Still unqualified: physical terrain errors and effective resolution, lunar source-frame registration, site-specific station rays and RF hardware, station bookings, future weather, physical thermal survival, actual touchdown/plume/soil behavior and historical attitude/burn telemetry. The finite sensitivity cases communicate assumptions, not probabilities. Automated audience checks are not a human learning or assistive-technology study.
