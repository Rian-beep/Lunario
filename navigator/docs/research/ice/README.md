# Published ice evidence catalogue

Worker scope: `codex/map-ice`, based on `6a3927f99b326b2fc9c210f78254a61ca7c29928`, reviewed 15 November 2026. No UI, assessment, imagery, ephemeris, package or offline-build changes.

The deliverable is **169 M3-associated PSR location markers plus one LCROSS impact-water marker**, not an ice-concentration map. Success means reproducing published positive-detection associations and coordinates, carrying source limitations into the data, rejecting corrupt/missing evidence, and allowing offline embedding with no fetch.

## Source and interpretation

[Lemelin et al. (2021)](https://doi.org/10.3847/PSJ/abf3c5) publish 169 PSRs associated with 820 M3 detections. The [author dataset, Zenodo 4646092 version 1](https://doi.org/10.5281/zenodo.4646092), supplies geographic location fields and positive detection counts. Those are exported directly. The paper's association includes detections inside or within 280 m of a PSR. A representative point is neither an individual detection nor a deposit boundary. M3 sampling is approximately 280 m; the PSR mask is 240 m. Per-point observation times are unavailable. The extraction omits hydrogen, modeled depths and mission rankings. It does not locate the other 299 M3 detections outside these PSR associations.

The underlying spectral evidence is [Li et al. (2018)](https://doi.org/10.1073/pnas.1802345115); [NASA/JPL](https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles/) confirms the surface-ice identification. **No individual Li M3 pixel coordinates were extracted here.** Lemelin's methods state these were available from Li on request; the public PSR archive supplies associations instead.

[Colaprete et al. (2010)](https://doi.org/10.1126/science.1186986) establish water in LCROSS ejecta. The separate marker uses [Marshall et al. (2012)](https://doi.org/10.1007/s11214-011-9765-0), section 4 / Table 3: longitude −48.7093°, latitude −84.6796°, with 1σ location uncertainty 44 m along longitude and 115 m along latitude. The [NASA NSSDCA impact table](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html) independently lists the equivalent 311.2907° east longitude. Neither an ice footprint nor an abundance is exported; `resolutionM`, `value`, and `unit` are null. This is the Centaur impact, not the later shepherding-spacecraft impact or a returned sample.

## Geometry decision and exact gaps

Use the author DBF `Longitude` and `Latitude` fields, in that order, unchanged. These are representative locations associated with PSRs; no centroid definition or detection-at-marker claim is added. Unnamed locations use **PSR record N**, explicitly the 1-based archive row, not a claimed match to the paper's numbered PSRs.

Do not turn the supplied SHP outline into an ice extent. A diagnostic on original SHP record 1 gives approximately 539,106.85 m² projected polygon area, while the corresponding DBF `Area_m2` is 39,437 m². The boundary semantics have not been resolved sufficiently to export it as a PSR boundary either. No buffering, outline synthesis or map digitization is performed. The locked contract permits these honest representative-location markers. Exact ice-pixel geodata, verified detection footprints and per-pixel observation dates remain missing; absence of catalogue markers means unknown coverage, not absence of ice.

Original WKT, seven member SHA256/byte identities, ZIP SHA256/bytes, source URLs, credits and licences are preserved in `pipeline/ice/source-manifest.json`. The runtime registry also carries original SHA256/bytes. Archive metadata API `https://zenodo.org/api/records/4646092` reports **CC-BY-4.0**. Credit all six authors and the DOI in the integrated source details. LCROSS PDFs are hashed but not redistributed or relicensed; only factual coordinates/time are transcribed in `pipeline/ice/lcross.json`.

The archive WKT describes `GCS_Moon` / `D_Moon_2000`, 1,737,400 m sphere, prime meridian 0, and a south-polar stereographic projection. The odd projected name `Moon2000_npole` is preserved verbatim in the manifest; it is not used to infer a north-pole frame. This extraction reads geographic DBF fields without reprojection. LCROSS reports Mean Earth selenocentric coordinates. No exact datum equivalence or DE frame conversion between datasets is asserted. Decimal preservation is not positional accuracy.

Other candidates checked:

| Candidate | Finding / disposition |
| --- | --- |
| [Zenodo 13760875](https://doi.org/10.5281/zenodo.13760875) | API metadata is public, CC-BY-4.0. Files include 15,966,871-byte `TH_PSJ_2024.mat`, 75,059,173-byte `e_mat_shukla_real.mat`, and MATLAB code. Inspected code references the Lemelin PSR counts. The MAT files were not downloaded or parsed; they are not claimed to provide an independent usable ice-pixel catalogue here. The smaller original association archive suffices. |
| [Aharonson et al. (2026)](https://doi.org/10.1038/s41550-026-02822-9) | Data availability points to PDS LAMP/M3, PSR ages [Zenodo 14885276](https://doi.org/10.5281/zenodo.14885276), and digital LAMP ice identifications at [CU Scholar](https://scholar.colorado.edu/concern/datasets/dr26z0429). The latter returned HTTP 403 during direct retrieval on this workstation. No LAMP locations or PSR-age-derived ice claims are exported. |
| LEND / Lunar Prospector hydrogen archives | Not used. Hydrogen inference is not a direct surface-ice detection. No optional proxy or giant archive is included. |

## Integration API and offline behavior

`lib/ice/index.ts` exports the locked `IceFeature` shape, `IceSource`, `IceCatalog`, `ICE_SOURCES`, `ICE_DATA_URL`, `parseIceCatalog`, and `loadIceCatalog`. It has no React dependency, browser globals at import, eager HTTP, assessment path or shared cache.

```ts
import data from "@/public/data/ice/catalog.json";
import { ICE_SOURCES, parseIceCatalog } from "@/lib/ice";

const ice = parseIceCatalog(data); // Offline-safe; accepts a decoded object or JSON text.
const source = ICE_SOURCES.find((item) => item.id === ice.features[0].sourceId);
```

Integrator owns embedding. Include the actual JSON in the offline bundle, or import it statically as above. Do not use a leading-slash HTTP asset fetch in the `file:` build. Connected-mode `loadIceCatalog({signal, fetcher})` fetches `ICE_DATA_URL` once, validates status and contents, forwards cancellation, and propagates errors. It does not cache or swallow failures; UI owns availability/retry and stale-publication behavior. The module itself makes no HTTP request until that convenience function is called.

Render evidence markers with distinct legend labels, e.g. “M3-associated PSR location” and “LCROSS impact-water detection”. Keep feature description and source processing notes reachable. Display positive M3 counts as counts, not percentages, mass, confidence, a gradient or an interpolation weight. Marker size must be a symbol, not a claimed ground footprint. Do not fill nearby cells, paint an entire PSR as ice, infer reserves/extractability, or change scientific assessment scores from this evidence. Preserve existing map navigation, modes and NASA imagery.

The parser validates source identity/method, ranges, finite numbers, required nulls, units, positive M3 integer counts, sampling resolution, strict UTC, unique IDs and supported geometry structure. Although the shared shape includes `Polygon`, **both currently bound sources are restricted to Point**. Future footprint evidence requires its own verified source/extractor update. Polygon structural checks do not establish topological validity, ground accuracy or scientific meaning.

## Reproduction and checks

Requires Python 3 standard library and existing project tools only. No dependency installation. The ZIP is 488,316 bytes and is downloaded into memory with a 1 MB bound; it and the PDFs are not committed.

```bash
# Downloads the pinned small original ZIP and regenerates both compact assets:
python3 -B pipeline/ice/build_catalog.py

# Or use an already-downloaded original without any network:
python3 -B pipeline/ice/build_catalog.py --source-zip /tmp/lunario-ice-source/lemelin.zip --check

npx tsx --test tests/ice/*.test.ts
npm run typecheck -- --incremental false
npm run lint
git diff --check
```

Extraction checks the complete ZIP and all seven members against pinned hashes before reading four fields. Missing/nonfinite/sentinel coordinates and nonpositive/fractional detection counts fail. Output is deterministic, has no run timestamp, and is compared byte-for-byte by `--check`. LCROSS transcription and exact source pins live in the owned pipeline directory. The TypeScript focused command also executes seven Python parser tests, without downloading anything. Root `npm test` does not discover `tests/ice/*.test.ts`; run the explicit command above.

Fresh receipts and tested commit are in `/tmp/lunario-map-ice-findings.md`; the portable source bundle is `/tmp/lunario-map-ice.bundle`, since `6a3927f`. Browser/file embedding, visual behavior and user acceptance remain integrator work. No Horizons gate is claimed: no geometry or ephemeris calculation changed.

Worker verification on 15 November 2026: focused TypeScript command **10/10 passed**, including **7/7 Python source-parser tests**, zero skipped; nonincremental typecheck and full repository lint both exited 0. Cached-source and fresh-download `--check` each matched both assets byte-for-byte. `catalog.json` is 79,461 bytes, SHA256 `cd1d58e8f99e94cdb5c87dde1d97113c7c74bdcf0024d1c8f0da3dab5a1717c8`; `sources.json` is 4,329 bytes, SHA256 `661a4e9be0ef1be186c3a1e5c69cd4633de68c342f552b8dc126f194011c463e`. `slop-scan` was unavailable on PATH and in project binaries; no tooling was installed. Manual inspection found no swallowed errors or empty catches. These are worker source/data checks, not browser or user acceptance. Durable decisions are recorded in this owned research note; the shared memory vault was not edited under the explicit owned-path restriction.
